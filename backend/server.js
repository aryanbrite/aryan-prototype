require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const WebSocket = require('ws');
const { GoogleGenAI, Modality } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://your-domain.com';
const wss_url = PUBLIC_URL.replace("https://", "wss://").replace("http://", "ws://");

const server = createServer(app);

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'meeting-bot-backend'
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'meeting-bot-backend',
    public_url: PUBLIC_URL
  });
});

// Use a raw ws server or two paths. Using two endpoints manually. 
const wssIn = new WebSocket.Server({ noServer: true });
const wssOut = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/audio-in') {
    wssIn.handleUpgrade(request, socket, head, (ws) => {
      wssIn.emit('connection', ws, request);
    });
  } else if (request.url === '/audio-out') {
    wssOut.handleUpgrade(request, socket, head, (ws) => {
      wssOut.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Parse sample rate out of a mimeType like "audio/pcm;rate=24000" or "audio/pcm; 24000hz"
function parseRateFromMimeType(mimeType) {
  if (!mimeType) return null;
  try {
    const m = /rate=(\d+)/i.exec(mimeType);
    if (m) return parseInt(m[1], 10);
    const hz = /(\d{3,5})\s*hz/i.exec(mimeType);
    if (hz) return parseInt(hz[1], 10);
  } catch (e) {}
  return null;
}

// Very small/naive PCM16LE resampler using linear interpolation.
// Accepts a Buffer of 16-bit signed little-endian PCM samples.
function resamplePcm16LE(buffer, srcRate, dstRate) {
  if (!buffer || srcRate === dstRate) return buffer;
  const srcSamples = Math.floor(buffer.length / 2);
  const dstSamples = Math.floor(srcSamples * dstRate / srcRate);
  const out = Buffer.alloc(dstSamples * 2);
  for (let i = 0; i < dstSamples; i++) {
    const srcPos = (i * srcRate) / dstRate;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, srcSamples - 1);
    const frac = srcPos - i0;
    const s0 = buffer.readInt16LE(i0 * 2) / 32768;
    const s1 = buffer.readInt16LE(i1 * 2) / 32768;
    const sample = s0 + (s1 - s0) * frac;
    const s16 = Math.max(-1, Math.min(1, sample)) * 32767 | 0;
    out.writeInt16LE(s16, i * 2);
  }
  return out;
}

function getPcm16Rms(buffer) {
  if (!buffer || buffer.length < 2) return 0;
  const sampleCount = Math.floor(buffer.length / 2);
  if (sampleCount === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = buffer.readInt16LE(i * 2) / 32768;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / sampleCount);
}

function previewWsMessage(data, maxLen = 200) {
  try {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
  } catch (e) {
    return '[unprintable message]';
  }
}

let activeInputWs = null;
let warnedMissingInputWs = false;

// Endpoint for bot joining
app.post('/api/join', async (req, res) => {
  const { meeting_url } = req.body;
  if (!meeting_url) {
    return res.status(400).json({ error: 'meeting_url is required' });
  }

  const payload = {
    meeting_url: meeting_url,
    bot_name: "Zach",
    recording_mode: "speaker_view",
    automatic_leave: { waiting_room_timeout: 600 }
  };

  if (process.env.MEETING_BAAS_API_VERSION === 'v2') {
    payload.streaming_enabled = true;
    payload.streaming_config = {
      audio_frequency: 16000,
      input_url: `${wss_url}/audio-in`,
      output_url: `${wss_url}/audio-out`
    };
  } else {
    payload.streaming = {
      audio_frequency: "16khz",
      input: `${wss_url}/audio-in`,
      output: `${wss_url}/audio-out`
    };
  }

  try {
    const meetingBaasApiUrl =
      process.env.MEETING_BAAS_API_URL ||
      (process.env.MEETING_BAAS_API_VERSION === 'v2'
        ? 'https://api.meetingbaas.com/v2/bots'
        : 'https://api.meetingbaas.com/bots');

    const meetingBaasKey = process.env.MEETING_BAAS_API_KEY;
    const headers = { 'Content-Type': 'application/json' };

    if (process.env.MEETING_BAAS_API_VERSION === 'v2') {
      if (!meetingBaasKey) {
        return res
          .status(500)
          .json({ status: 'error', message: 'MEETING_BAAS_API_KEY (v2) not set' });
      }
      const authHeader = process.env.MEETING_BAAS_AUTH_HEADER || 'x-meeting-baas-api-key';
      headers[authHeader] = meetingBaasKey;
    } else {
      if (!meetingBaasKey) {
        return res
          .status(500)
          .json({ status: 'error', message: 'MEETING_BAAS_API_KEY not set' });
      }
      const authHeader = process.env.MEETING_BAAS_AUTH_HEADER || 'x-meeting-baas-api-key';
      headers[authHeader] = meetingBaasKey;
    }

    console.log('MeetingBaaS call:', meetingBaasApiUrl, 'version=', process.env.MEETING_BAAS_API_VERSION || 'v1', 'headers=', Object.keys(headers), 'keyPresent=', !!meetingBaasKey);

    const response = await fetch(meetingBaasApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = text;
    }

    if (response.ok) {
      const botId = data.data?.bot_id || data.bot_id || data.id || data.botId || null;
      res.json({ status: 'success', bot_id: botId, raw: data });
    } else {
      console.error('MeetingBaaS error', response.status, data);
      res.status(response.status).json({ status: 'error', message: data });
    }
  } catch (err) {
    console.error('Join error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

wssIn.on('connection', (ws) => {
  console.log("Meeting BaaS connected to /audio-in (streaming.input) — Ready to speak");
  activeInputWs = ws;
  warnedMissingInputWs = false;
  // If we had buffered model audio while no /audio-in was connected, flush it now.
  try { flushPendingModelAudioToMeeting(ws); } catch (e) {}
  ws.on('close', () => {
    if (activeInputWs === ws) activeInputWs = null;
    console.log("/audio-in closed");
  });
  ws.on('message', (msg) => {
    // just dummy wait
  });
});

// If Gemini produced audio before a /audio-in client connected, stash it here
let pendingModelAudioToMeeting = [];
let pendingModelAudioBytes = 0;
const MAX_PENDING_MEETING_BYTES = 16000 * 2 * 5; // keep up to ~5s of audio

// Flush any pending model audio when a new /audio-in connects
// (attach to the same connection handler to avoid duplicating event logic)
// Note: we flush here rather than replaying old model prompts to avoid feedback loops.
// We simply forward any short buffered audio that arrived while no input ws was present.
const flushPendingModelAudioToMeeting = (ws) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (pendingModelAudioBytes === 0) return;
  try {
    const buf = Buffer.concat(pendingModelAudioToMeeting);
    ws.send(buf);
    console.log('Flushed buffered Gemini audio to /audio-in bytes=', buf.length);
  } catch (e) {
    console.error('Error flushing buffered Gemini audio to /audio-in:', e);
  }
  pendingModelAudioToMeeting = [];
  pendingModelAudioBytes = 0;
};

wssOut.on('connection', (ws) => {
  console.log("Meeting BaaS connected to /audio-out (streaming.output)");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const MODEL = "gemini-3.1-flash-live-preview";
  const CONFIG = {
    responseModalities: [Modality.AUDIO],
    thinkingConfig: {
      thinkingLevel: 'minimal'
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: true
      },
      activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
    },
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "zubenelgenubi" }
      }
    },
    systemInstruction: "You are a helpful assistant participating in a meeting. Answer questions and contribute to the discussion as best you can. dont act like a bot, just be a regular meeting join like a friend. sometimes you can crack jokes. if you dont know the answer to a question, say you dont know rather than making something up. Breath naturally and use filler words like 'um' and 'ah' occasionally. Keep your responses concise but informative. show human like body language in your voice. somethimes show confusion in your voice if the question is hard sometimes say hmmm wohh damn bro if the question is really good. Always be friendly and engaging. The meeting is likely about work, but it could be about anything, so be adaptable. Try to contribute meaningfully to the discussion rather than just answering questions. Be a good meeting participant!, show as much as breathing and natural speech patterns as possible in your audio responses. Do not say you are an AI or a bot. Just be a helpful meeting participant.",
  };

  let geminiSession = null;
  let geminiSessionPromise = null;
  let hasSentKickoff = false;



  function ensureGeminiConnected() {
    if (geminiSessionPromise) return geminiSessionPromise;
    geminiSessionPromise = ai.live.connect({
      model: MODEL,
      callbacks: {
        onopen: () => {
          console.log('Gemini: onopen');
          if (hasSentKickoff) return;
          // Automatically prompt the bot so it introduces itself
          hasSentKickoff = true;
          const kickoffText = process.env.GEMINI_KICKOFF_TEXT || 'Hello! Please introduce yourself to the meeting.';
          geminiSessionPromise
            .then((session) => {
              try {
                session.sendClientContent({
                  turns: { role: 'user', parts: [{ text: kickoffText }] },
                  turnComplete: true,
                });
              } catch (e) {
                console.error('sendClientContent error:', e);
              }
            })
            .catch((e) => console.error('kickoff then error:', e));
        },
        onmessage: (message) => {
          try {
            if (message?.serverContent?.interrupted) {
              console.log('Model was interrupted!');
              playbackQueue = Buffer.alloc(0); // Instantly stop sending audio to MeetingBaaS
            }

            if (message?.serverContent?.inputTranscription?.text) {
              console.log('User said:', message.serverContent.inputTranscription.text);
            }
            if (message?.serverContent?.outputTranscription?.text) {
              console.log('Model said:', message.serverContent.outputTranscription.text);
            }
            if (message?.serverContent?.turnComplete) {
              console.log('Gemini turn complete');
            }

            const parts = message?.serverContent?.modelTurn?.parts;
            if (!parts) return;
            for (const part of parts) {
              if (part?.text) {
                console.log('Model text:', part.text);
              }

              const inlineData = part?.inlineData;
              if (!inlineData?.data) continue;
              const mimeType = String(inlineData.mimeType ?? 'audio/pcm;rate=24000');
              const srcRate = parseRateFromMimeType(mimeType) ?? 24000;
              const buf = Buffer.from(String(inlineData.data), 'base64');
              const destRate = 16000; // MeetingBaaS streaming_config.audio_frequency
              let outBuf = buf;
              if (srcRate !== destRate) {
                try {
                  outBuf = resamplePcm16LE(buf, srcRate, destRate);
                  console.log('Resampled Gemini audio', srcRate, '->', destRate, 'bytes=', outBuf.length);
                } catch (e) {
                  console.error('Resample error:', e);
                  outBuf = buf;
                }
              }
              if (activeInputWs && activeInputWs.readyState === WebSocket.OPEN) {
                playbackQueue = Buffer.concat([playbackQueue, outBuf]);
                startPlaybackRoutine();
              } else {
                if (!warnedMissingInputWs) {
                  warnedMissingInputWs = true;
                  console.warn('Gemini produced audio but no active /audio-in websocket is connected. MeetingBaaS cannot play bot speech yet.');
                }
                // Buffer model audio when there is no /audio-in connected so we can
                // forward it once a client connects. Cap buffer size to avoid OOM.
                if (pendingModelAudioBytes + outBuf.length > MAX_PENDING_MEETING_BYTES) {
                  while (pendingModelAudioToMeeting.length && pendingModelAudioBytes + outBuf.length > MAX_PENDING_MEETING_BYTES) {
                    const removed = pendingModelAudioToMeeting.shift();
                    pendingModelAudioBytes -= (removed?.length || 0);
                  }
                }
                if (pendingModelAudioBytes + outBuf.length <= MAX_PENDING_MEETING_BYTES) {
                  pendingModelAudioToMeeting.push(outBuf);
                  pendingModelAudioBytes += outBuf.length;
                  console.log('Buffered Gemini audio (no /audio-in) bytes=', outBuf.length, 'pending=', pendingModelAudioBytes);
                } else {
                  console.log('Dropping Gemini audio (buffer full) bytes=', outBuf.length);
                }
              }
            }
          } catch (err) {
            console.error('Error in Gemini onmessage handler:', err);
          }
        },
        onclose: (event) => {
          console.log('Gemini onclose', event);
          geminiSession = null;
          geminiSessionPromise = null;
          hasSentKickoff = false;
        },
        onerror: (err) => {
          console.error('Gemini onerror', err);
          geminiSession = null;
          geminiSessionPromise = null;
          hasSentKickoff = false;
        },
      },
      config: CONFIG,
    });

    geminiSessionPromise
      .then((session) => {
        geminiSession = session;
        console.log('Gemini: live session connected (promise resolved)');
      })
      .catch((err) => {
        console.error('Gemini connect error:', err);
        geminiSession = null;
        geminiSessionPromise = null;
        hasSentKickoff = false;
      });

    return geminiSessionPromise;
  }

  // Queue outbound MeetingBaaS audio destined for Gemini 
  let pendingToGeminiBuffers = [];
  let pendingToGeminiBytes = 0;
  let pendingToGeminiTimer = null;
  const CHUNK_INTERVAL_MS = 20;
  const MEETING_AUDIO_PAUSE_MS = Number(process.env.MEETING_AUDIO_PAUSE_MS || 1400);
  const SILENCE_RMS_THRESHOLD = Number(process.env.MEETING_SILENCE_RMS_THRESHOLD || 0.006);
  const SILENCE_FLUSH_MS = Number(process.env.MEETING_SILENCE_FLUSH_MS || 1400);
  const MIN_SPEECH_CHUNK_BYTES = Number(process.env.MIN_SPEECH_CHUNK_BYTES || 640);
  let meetingAudioIdleTimer = null;
  let meetingSpeechActive = false;
  let meetingSilenceMs = 0;

  // Real-time playback pacer for Gemini -> MeetingBaaS
  let playbackQueue = Buffer.alloc(0);
  let playbackTimer = null;
  let lastForwardedToMeetingAt = 0;
  const FEEDBACK_SUPPRESSION_MS = Number(process.env.FEEDBACK_SUPPRESSION_MS || 10);

  function sendGeminiRealtimeSignal(params, label) {
    if (!geminiSessionPromise) return;
    geminiSessionPromise
      .then((session) => {
        try {
          session.sendRealtimeInput(params);
          console.log(label);
        } catch (err) {
          console.error(`${label} error (sync):`, err);
        }
      })
      .catch((err) => {
        console.error(`${label} error:`, err);
      });
  }

  function endMeetingSpeech(reason) {
    if (!meetingSpeechActive) return;
    meetingSpeechActive = false;
    meetingSilenceMs = 0;
    if (meetingAudioIdleTimer) {
      clearTimeout(meetingAudioIdleTimer);
      meetingAudioIdleTimer = null;
    }
    sendGeminiRealtimeSignal({ activityEnd: {} }, `Sent activityEnd after ${reason}`);
  }

  function scheduleMeetingAudioTurnFlush() {
    if (meetingAudioIdleTimer) clearTimeout(meetingAudioIdleTimer);
    meetingAudioIdleTimer = setTimeout(() => {
      meetingAudioIdleTimer = null;
      endMeetingSpeech('meeting audio pause');
    }, MEETING_AUDIO_PAUSE_MS);
  }

  function startPlaybackRoutine() {
    if (playbackTimer) return;
    playbackTimer = setInterval(() => {
      if (!activeInputWs || activeInputWs.readyState !== WebSocket.OPEN) return;
      if (playbackQueue.length === 0) return;
      
      // Send 50ms of audio at a time (16000 rate * 2 bytes = 32000 bytes/sec -> 1600 bytes/50ms)
      const bytesToSend = Math.min(1600, playbackQueue.length);
      const chunk = playbackQueue.subarray(0, bytesToSend);
      playbackQueue = playbackQueue.subarray(bytesToSend);
      
      try {
        activeInputWs.send(chunk);
        lastForwardedToMeetingAt = Date.now();
      } catch (e) {
        console.error('Playback error:', e);
      }
    }, 50);
  }

  const flushPendingToGemini = () => {
    pendingToGeminiTimer = null;
    if (pendingToGeminiBytes === 0) return;
    
    // Ensure even byte count for 16-bit PCM
    let buf = Buffer.concat(pendingToGeminiBuffers);
    const evenBytes = buf.length - (buf.length % 2);
    if (evenBytes === 0) return;
    
    const chunkToSend = buf.subarray(0, evenBytes);
    const leftover = buf.subarray(evenBytes);
    
    pendingToGeminiBuffers = leftover.length > 0 ? [leftover] : [];
    pendingToGeminiBytes = leftover.length;

    const base64 = chunkToSend.toString('base64');
    ensureGeminiConnected()
      .then((session) => {
        try {
          const maybe = session.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
          if (maybe && typeof maybe.then === 'function') {
            maybe.catch((err) => {
              console.error('sendRealtimeInput error:', err);
              geminiSession = null;
              geminiSessionPromise = null;
              hasSentKickoff = false;
            });
          }
        } catch (err) {
          console.error('sendRealtimeInput error (sync):', err);
          geminiSession = null;
          geminiSessionPromise = null;
          hasSentKickoff = false;
        }
      })
      .catch((err) => {
        console.error('geminiSessionPromise then error:', err);
      });
  };

  // Connect immediately so the bot can speak first without waiting for meeting audio.
  ensureGeminiConnected().catch((err) => {
    console.error('Initial Gemini connect error:', err);
  });

  ws.on('message', (data, isBinary) => {
    try {
      if (!isBinary) {
        console.log('Received non-binary /audio-out message:', previewWsMessage(data));
        return;
      }

      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (chunk.length === 0) return;
      if (chunk.length % 2 !== 0) {
        console.log('Ignoring odd-length binary /audio-out payload bytes=', chunk.length);
        return;
      }

      if (Date.now() - lastForwardedToMeetingAt < FEEDBACK_SUPPRESSION_MS) {
        return;
      }

      const rms = getPcm16Rms(chunk);
      const chunkDurationMs = Math.round((chunk.length / 2 / 16000) * 1000);
      const qualifiesAsSpeech = chunk.length >= MIN_SPEECH_CHUNK_BYTES && rms >= SILENCE_RMS_THRESHOLD;

      if (qualifiesAsSpeech) {
        if (!meetingSpeechActive) {
          if (playbackQueue.length > 0) {
            playbackQueue = Buffer.alloc(0);
            console.log('Locally interrupted bot playback due to detected user speech');
          }
          sendGeminiRealtimeSignal({ activityStart: {} }, 'Sent activityStart for meeting speech');
          console.log('Detected meeting speech, rms=', rms.toFixed(4), 'bytes=', chunk.length);
        }
        meetingSpeechActive = true;
        meetingSilenceMs = 0;
      } else if (meetingSpeechActive) {
        meetingSilenceMs += chunkDurationMs;
        if (meetingSilenceMs >= SILENCE_FLUSH_MS) {
          console.log('Detected end of meeting speech after silence ms=', meetingSilenceMs);
          endMeetingSpeech(`silence ms=${meetingSilenceMs}`);
        }
      }

      pendingToGeminiBuffers.push(chunk);
      pendingToGeminiBytes += chunk.length;
      if (!pendingToGeminiTimer) {
        pendingToGeminiTimer = setTimeout(flushPendingToGemini, CHUNK_INTERVAL_MS);
      }
      if (meetingSpeechActive) {
        scheduleMeetingAudioTurnFlush();
      }
    } catch (err) {
      console.error('Error handling /audio-out message:', err);
    }
  });

  ws.on('close', () => {
    try {
      if (meetingSpeechActive) {
        geminiSession?.sendRealtimeInput?.({ activityEnd: {} });
      }
    } catch (e) {}
    try {
      geminiSession?.close?.();
    } catch (e) {}
    if (pendingToGeminiTimer) clearTimeout(pendingToGeminiTimer);
    if (meetingAudioIdleTimer) clearTimeout(meetingAudioIdleTimer);
    if (playbackTimer) clearInterval(playbackTimer);
    playbackTimer = null;
    pendingToGeminiTimer = null;
    meetingAudioIdleTimer = null;
    meetingSpeechActive = false;
    meetingSilenceMs = 0;
    pendingToGeminiBuffers = [];
    pendingToGeminiBytes = 0;
    playbackQueue = Buffer.alloc(0);
    pendingModelAudioToMeeting = [];
    pendingModelAudioBytes = 0;
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
