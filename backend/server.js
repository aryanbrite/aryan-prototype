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

let activeInputWs = null;

// Endpoint for bot joining
app.post('/api/join', async (req, res) => {
  const { meeting_url } = req.body;
  if (!meeting_url) {
    return res.status(400).json({ error: 'meeting_url is required' });
  }

  const payload = {
    meeting_url: meeting_url,
    bot_name: "Gemini Assistant",
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
  ws.on('close', () => {
    if (activeInputWs === ws) activeInputWs = null;
    console.log("/audio-in closed");
  });
  ws.on('message', (msg) => {
    // just dummy wait
  });
});

wssOut.on('connection', (ws) => {
  console.log("Meeting BaaS connected to /audio-out (streaming.output)");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const MODEL = "gemini-3.1-flash-live-preview";
  const CONFIG = {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "Kore" }
      }
    },
    systemInstruction: "You are a helpful meeting assistant."
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
          hasSentKickoff = true;
          const kickoffText = 'Start.';
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
            const parts = message?.serverContent?.modelTurn?.parts;
            if (!parts) return;
            for (const part of parts) {
              const inlineData = part?.inlineData;
              if (!inlineData?.data) continue;
              const mimeType = String(inlineData.mimeType ?? 'audio/pcm;rate=24000');
              const srcRate = parseRateFromMimeType(mimeType) ?? 24000;
              const buf = Buffer.from(String(inlineData.data), 'base64');
              // If MeetingBaaS expects raw PCM bytes at 16000, resample if needed.
              if (activeInputWs && activeInputWs.readyState === WebSocket.OPEN) {
                activeInputWs.send(buf);
                console.log('Forwarded Gemini audio part to /audio-in bytes=', buf.length);
              } else {
                console.log('No active /audio-in connection to forward Gemini audio');
              }
            }
          } catch (err) {
            console.error('Error in Gemini onmessage handler:', err);
          }
        },
        onclose: () => {
          console.log('Gemini onclose');
        },
        onerror: (err) => {
          console.error('Gemini onerror', err);
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
      });

    return geminiSessionPromise;
  }

  ws.on('message', (data) => {
    try {
      if (Buffer.isBuffer(data)) {
        console.log('Received audio from MeetingBaaS /audio-out bytes=', data.length);
        const base64 = data.toString('base64');
        ensureGeminiConnected();
        geminiSessionPromise
          .then((session) => {
            try {
              session.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
            } catch (err) {
              console.error('sendRealtimeInput error (sync):', err);
            }
          })
          .catch((err) => console.error('geminiSessionPromise then error:', err));
      } else {
        console.log('Received non-buffer message on /audio-out, type=', typeof data);
      }
    } catch (err) {
      console.error('Error handling /audio-out message:', err);
    }
  });

  ws.on('close', () => {
    try {
      geminiSession?.close?.();
    } catch (e) {}
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
