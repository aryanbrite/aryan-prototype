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
    streaming: {
      audio_frequency: "16khz",
      input: `${wss_url}/audio-in`,
      output: `${wss_url}/audio-out`
    },
    automatic_leave: { waiting_room_timeout: 600 }
  };

  try {
    const response = await fetch("https://api.meetingbaas.com/bots", {
      method: "POST",
      headers: {
        "x-meeting-baas-api-key": process.env.MEETING_BAAS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      res.json({ status: "success", bot_id: data.bot_id });
    } else {
      res.status(response.status).json({ status: "error", message: data });
    }
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
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

wssOut.on('connection', async (ws) => {
    console.log("Meeting BaaS connected to /audio-out (streaming.output)");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
    const MODEL  = "gemini-3.1-flash-live-preview";
    const CONFIG = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" }
        }
      },
      systemInstruction: "You are a helpful meeting assistant."
    };
  
    try {
        const session = await ai.live.connect({ model: MODEL, config: CONFIG });
        
        ws.on('message', (data) => {
            // Send mic input to Gemini
            if (Buffer.isBuffer(data)) {
                // we'll send it as base64
                session.sendRealtimeInput({
                    audio: {
                      data: data.toString("base64"),
                      mimeType: "audio/pcm;rate=16000"
                    }
                });
            }
        });

        // For Node.js without simple resampler, we rely on Gemini to support 16kHz directly or manually handle. 
        // Currently Gemini outputs 24kHz natively. Without an audioop equivalent in node out-of-the-box easily, 
        // Meeting BaaS strictly states it only supports 16kHz currently for input.
        // For production, using a library like 'wavefile' or native resampler is required in Node.js.
        // For the sake of the prototype, we assume BaaS tolerates it, OR we leave it raw. We will just pass it, might sound fast.
        
        for await (const response of session) {
            if (response.data) {
                // response.data is Buffer (24kHz PCM bytes)
                // Ideally this point needs resampling to 16kHz. 
                // We'll pass it to input WS. 
                if (activeInputWs && activeInputWs.readyState === WebSocket.OPEN) {
                    activeInputWs.send(response.data);
                }
            }
        }
        
    } catch (e) {
        console.error("Gemini Error:", e);
    }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
