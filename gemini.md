# Gemini Live API — Complete Reference

---

## What Is the Gemini Live API

The Gemini Live API is a stateful, bidirectional streaming API built on
WebSockets. Unlike the standard `generateContent` REST API, it maintains a
persistent connection where you continuously send audio/video/text and receive
real-time audio/text responses back — creating natural, low-latency voice
conversations.

- **Official docs:** `https://ai.google.dev/gemini-api/docs/multimodal-live`
- **Get API key:** `https://aistudio.google.com`

---

## Models

### Current Recommended Model

| Model ID | Status | Notes |
|----------|--------|-------|
| `gemini-3.1-flash-live-preview` | ✅ **Recommended** | Latest. Native audio, thinking via `thinkingLevel`, 128k context window |

### Deprecated / Shutting Down (do not use for new projects)

| Model ID | Shutdown |
|----------|----------|
| `gemini-2.5-flash-native-audio-preview-12-2025` | Migrate to 3.1 |
| `gemini-live-2.5-flash-preview` | December 9, 2025 |
| `gemini-2.0-flash-live-001` | December 9, 2025 |

> **Key fact:** Native audio models skip the STT → LLM → TTS pipeline entirely.
> Audio goes in, audio comes out natively. This is why latency is dramatically lower.

---

## SDKs

### Python SDK (current)

```bash
pip install google-genai
```

### JavaScript / TypeScript SDK (current)

```bash
npm install @google/genai
```

> ⚠️ Legacy SDKs `google-generativeai` (Python) and `@google/generative-ai` (JS)
> are deprecated. Use the new ones above.

---

## Audio Format

This is critical. Wrong format = garbled or silent output.

| Direction | Format | Sample Rate | Channels | Bit Depth |
|-----------|--------|-------------|----------|-----------|
| Input (you → Gemini) | Raw PCM, little-endian | 16,000 Hz | Mono | 16-bit |
| Output (Gemini → you) | Raw PCM, little-endian | 24,000 Hz | Mono | 16-bit |

```python
# Python constants — do not change these
FORMAT       = pyaudio.paInt16
CHANNELS     = 1
SEND_SAMPLE_RATE    = 16000   # input to Gemini
RECEIVE_SAMPLE_RATE = 24000   # output from Gemini
CHUNK_SIZE   = 1024
```

---

## WebSocket Endpoint

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
```

For features requiring `v1alpha` (proactive audio, ephemeral tokens):

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
```

---

## Session Lifecycle

```
1. Open WebSocket connection
2. Send BidiGenerateContentSetup (first message — config)
3. Stream audio/video/text input continuously
4. Receive audio/text/function call responses
5. Handle interruptions, VAD events, tool calls
6. Session expires after 10 min → implement resumption for longer sessions
```

---

## Session Setup (First Message)

The very first message after connecting MUST be the setup config.
You cannot change config while the connection is open (except via session resumption).

### Full Config Reference

```json
{
  "setup": {
    "model": "models/gemini-3.1-flash-live-preview",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "temperature": 1.0,
      "maxOutputTokens": 8192,
      "topP": 0.95,
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Kore"
          }
        },
        "languageCode": "en-US"
      }
    },
    "systemInstruction": {
      "parts": [{ "text": "You are a helpful assistant." }]
    },
    "tools": [],
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
        "endOfSpeechSensitivity": "END_SENSITIVITY_HIGH",
        "prefixPaddingMs": 20,
        "silenceDurationMs": 100
      }
    },
    "sessionResumption": {
      "handle": "previous-session-handle-if-resuming"
    },
    "contextWindowCompression": {
      "triggerTokens": 25600,
      "slidingWindow": { "targetTokens": 12800 }
    }
  }
}
```

### Config Parameter Reference

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Must be `models/gemini-3.1-flash-live-preview` |
| `responseModalities` | array | `["AUDIO"]` or `["TEXT"]` — only ONE per session |
| `temperature` | number | 0.0–2.0. Default 1.0 |
| `maxOutputTokens` | number | Max tokens per response |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | See voices table below |
| `speechConfig.languageCode` | string | e.g. `en-US`, `hi-IN`, `fr-FR` |
| `systemInstruction` | object | System prompt |
| `realtimeInputConfig` | object | VAD settings — see VAD section |
| `sessionResumption.handle` | string | Pass previous handle to resume a session |
| `contextWindowCompression` | object | Enables compression for sessions > 15 min |

---

## Voices

Native audio models (3.1) support 30 HD voices across 24 languages.

| Voice Name | Gender | Personality |
|------------|--------|-------------|
| `Puck` | Male | Upbeat |
| `Charon` | Male | Informative |
| `Kore` | Female | Firm |
| `Fenrir` | Male | Excitable |
| `Aoede` | Female | Breezy |
| `Leda` | Female | Youthful |
| `Orus` | Male | Firm |
| `Zephyr` | Female | Bright |
| `Autonoe` | Female | Bright |
| `Despina` | Female | Smooth |
| `Erinome` | Female | Clear |
| `Algieba` | Male | Smooth |
| `Iocaste` | Female | Informative |
| `Algenib` | Male | Gravelly |
| `Rasalgethi` | Male | Informative |
| `Laomedeia` | Female | Upbeat |
| `Achernar` | Female | Soft |
| `Schedar` | Male | Even |
| `Gacrux` | Male | Mature |
| `Pulcherrima` | Female | Forward |
| `Achird` | Male | Friendly |
| `Zubenelgenubi` | Male | Casual |
| `Vindemiatrix` | Female | Gentle |
| `Sadachbia` | Male | Lively |
| `Sadaltager` | Male | Knowledgeable |
| `Sulafat` | Female | Warm |

Preview all voices at: `https://aistudio.google.com`

---

## Python SDK — Full Setup & Streaming

### Install

```bash
pip install google-genai pyaudio
```

### Basic Session

```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")

MODEL = "gemini-3.1-flash-live-preview"

CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="Kore"
            )
        )
    ),
    system_instruction=types.Content(
        parts=[types.Part(text="You are a helpful assistant.")]
    )
)

async def main():
    async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:

        # Send a text message
        await session.send_realtime_input(text="Hello, how are you?")

        # Receive the response
        async for response in session.receive():
            if response.data:
                # response.data = raw 24kHz PCM audio bytes
                play_audio(response.data)
            if response.text:
                print("Transcript:", response.text)
            if response.server_content and response.server_content.turn_complete:
                break

asyncio.run(main())
```

### Streaming Audio In and Out

```python
import asyncio
import pyaudio
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")

FORMAT            = pyaudio.paInt16
CHANNELS          = 1
SEND_SAMPLE_RATE  = 16000   # input to Gemini
RECV_SAMPLE_RATE  = 24000   # output from Gemini
CHUNK_SIZE        = 1024

pya = pyaudio.PyAudio()

MODEL  = "gemini-3.1-flash-live-preview"
CONFIG = types.LiveConnectConfig(response_modalities=["AUDIO"])

async def run():
    async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:

        # Open mic input stream
        mic_stream = pya.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE
        )

        # Open speaker output stream
        speaker_stream = pya.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RECV_SAMPLE_RATE,
            output=True
        )

        async def send_audio():
            while True:
                chunk = await asyncio.to_thread(
                    mic_stream.read, CHUNK_SIZE, False
                )
                await session.send_realtime_input(
                    audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                )

        async def receive_audio():
            async for response in session.receive():
                if response.data:
                    speaker_stream.write(response.data)
                if response.server_content and response.server_content.interrupted:
                    # User interrupted — stop playback immediately
                    print("Interrupted!")

        await asyncio.gather(send_audio(), receive_audio())

asyncio.run(run())
```

---

## JavaScript SDK — Full Setup & Streaming

### Install

```bash
npm install @google/genai mic speaker
```

### Basic Session

```javascript
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "YOUR_API_KEY" });

const MODEL  = "gemini-3.1-flash-live-preview";
const CONFIG = {
  responseModalities: [Modality.AUDIO],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: "Kore" }
    }
  },
  systemInstruction: "You are a helpful assistant."
};

async function main() {
  const session = await ai.live.connect({ model: MODEL, config: CONFIG });

  // Send text input
  session.sendRealtimeInput({ text: "Hello!" });

  // Receive responses
  for await (const response of session) {
    if (response.data) {
      playAudio(response.data); // raw 24kHz PCM bytes (Buffer)
    }
    if (response.text) {
      console.log("Transcript:", response.text);
    }
  }

  await session.close();
}

main();
```

---

## Raw WebSocket — No SDK

```python
import asyncio
import json
import websockets

API_KEY    = "YOUR_API_KEY"
MODEL_NAME = "gemini-3.1-flash-live-preview"
WS_URL     = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta."
    f"GenerativeService.BidiGenerateContent?key={API_KEY}"
)

async def main():
    async with websockets.connect(WS_URL) as ws:

        # 1. Send setup as first message
        await ws.send(json.dumps({
            "setup": {
                "model": f"models/{MODEL_NAME}",
                "generationConfig": {
                    "responseModalities": ["AUDIO"]
                },
                "systemInstruction": {
                    "parts": [{"text": "You are a helpful assistant."}]
                }
            }
        }))

        # 2. Send audio input
        await ws.send(json.dumps({
            "realtimeInput": {
                "audio": {
                    "data": "<base64-encoded-16kHz-PCM>",
                    "mimeType": "audio/pcm;rate=16000"
                }
            }
        }))

        # 3. Receive responses
        while True:
            msg = json.loads(await ws.recv())

            if "serverContent" in msg:
                parts = msg["serverContent"].get("modelTurn", {}).get("parts", [])
                for part in parts:
                    if "inlineData" in part:
                        audio_b64 = part["inlineData"]["data"]
                        # decode and play audio
                    if "text" in part:
                        print("Text:", part["text"])

                if msg["serverContent"].get("turnComplete"):
                    print("Turn complete")

asyncio.run(main())
```

---

## Sending Input

### Send Audio (real-time mic stream)

```python
await session.send_realtime_input(
    audio=types.Blob(data=pcm_bytes, mime_type="audio/pcm;rate=16000")
)
```

```javascript
session.sendRealtimeInput({
  audio: {
    data: Buffer.from(pcmBytes).toString("base64"),
    mimeType: "audio/pcm;rate=16000"
  }
});
```

### Send Text

```python
await session.send_realtime_input(text="What time is it?")
```

```javascript
session.sendRealtimeInput({ text: "What time is it?" });
```

### Send Video Frame (max 1 fps)

```python
await session.send_realtime_input(
    video=types.Blob(data=jpeg_bytes, mime_type="image/jpeg")
)
```

### Signal Audio Stream End (mic paused)

Send this when the user mutes — flushes cached audio in the model.

```python
await session.send_realtime_input(audio_stream_end=True)
```

### send_realtime_input vs send_client_content

| Method | Use For |
|--------|---------|
| `send_realtime_input` | All real-time streaming (audio, video, text during conversation) |
| `send_client_content` | Seeding initial context/history only — not for ongoing turns in Gemini 3.1 |

---

## Receiving Output

Server events can contain multiple parts simultaneously. Always process all parts.

```python
async for response in session.receive():

    # Audio chunk (24kHz PCM bytes)
    if response.data:
        speaker.write(response.data)

    # Text transcript of model speech
    if response.text:
        print("Model:", response.text)

    # User speech transcript (input transcription)
    if response.server_content:
        sc = response.server_content

        # Model finished its turn
        if sc.turn_complete:
            print("--- turn complete ---")

        # User interrupted the model
        if sc.interrupted:
            clear_audio_buffer()

        # Input transcript (what the user said)
        if sc.input_transcription:
            print("User said:", sc.input_transcription.text)

        # Output transcript (what the model said)
        if sc.output_transcription:
            print("Model said:", sc.output_transcription.text)

    # Function/tool call from the model
    if response.tool_call:
        handle_tool_call(response.tool_call)

    # Usage metadata
    if response.usage_metadata:
        print("Tokens used:", response.usage_metadata.total_token_count)
```

---

## Voice Activity Detection (VAD)

VAD lets the model detect when the user starts and stops speaking.
It enables natural interruptions — if the user speaks while the model is
talking, the model stops immediately.

### Automatic VAD (default — recommended)

```python
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(
            disabled=False,                            # VAD on
            start_of_speech_sensitivity="START_SENSITIVITY_HIGH",
            end_of_speech_sensitivity="END_SENSITIVITY_HIGH",
            prefix_padding_ms=20,
            silence_duration_ms=100
        )
    )
)
```

| Sensitivity Value | Options |
|-------------------|---------|
| `startOfSpeechSensitivity` | `START_SENSITIVITY_LOW`, `START_SENSITIVITY_HIGH` |
| `endOfSpeechSensitivity` | `END_SENSITIVITY_LOW`, `END_SENSITIVITY_HIGH` |

### Manual VAD (you control when speech starts/ends)

Use this when you have your own VAD or want precise control.

```python
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(
            disabled=True   # disable automatic VAD
        )
    )
)

# Then manually signal speech boundaries:
await session.send_realtime_input(activity_start=types.ActivityStart())
await session.send_realtime_input(audio=types.Blob(...))  # stream audio
await session.send_realtime_input(activity_end=types.ActivityEnd())
```

### Handling Interruptions

When the user interrupts the model mid-response:

```python
async for response in session.receive():
    if response.server_content and response.server_content.interrupted:
        # Clear your audio playback buffer immediately
        audio_queue.clear()
        speaker.stop()
        print("Model was interrupted")
```

> ⚠️ You MUST clear your playback buffer when an interruption arrives.
> If you don't, the model will keep playing stale audio.

---

## Audio Transcription

Enable text transcripts of what the user said and what the model said:

```python
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    input_audio_transcription=types.AudioTranscriptionConfig(),   # user speech → text
    output_audio_transcription=types.AudioTranscriptionConfig()   # model speech → text
)

# Receive them:
async for response in session.receive():
    if response.server_content:
        if response.server_content.input_transcription:
            print("User:", response.server_content.input_transcription.text)
        if response.server_content.output_transcription:
            print("Model:", response.server_content.output_transcription.text)
```

---

## Function Calling (Tool Use)

### Define Tools in Config

```python
tools = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="get_weather",
                description="Get the weather for a city",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "city": types.Schema(type="STRING", description="City name")
                    },
                    required=["city"]
                )
            )
        ]
    )
]

CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    tools=tools
)
```

### Handle Tool Calls in the Response Loop

```python
async for response in session.receive():
    if response.tool_call:
        results = []
        for fn in response.tool_call.function_calls:
            # Execute your function
            if fn.name == "get_weather":
                result = get_weather(fn.args["city"])
            else:
                result = {"error": "unknown function"}

            results.append(
                types.FunctionResponse(
                    id=fn.id,
                    name=fn.name,
                    response=result
                )
            )

        # Send results back — model continues responding
        await session.send_tool_response(
            function_responses=results
        )
```

> ⚠️ Function calling is **synchronous only** in Gemini 3.1.
> The model stops generating until you send the tool response.

---

## Session Management

### Session Limits

| Limit | Value |
|-------|-------|
| Default session length | 10 minutes |
| Max with resumption | 24 hours of stored state |
| Audio chunk size (recommended) | 20–40 ms chunks for lowest latency |

### Session Resumption

Prevents losing conversation state on network drops or timeouts.
The server sends a session handle periodically — save it and use it to reconnect.

```python
# Enable in config
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    session_resumption=types.SessionResumptionConfig()
)

saved_handle = None

async for response in session.receive():
    # Save handle whenever server sends one
    if response.session_resumption_update:
        update = response.session_resumption_update
        if update.resumable and update.new_handle:
            saved_handle = update.new_handle
            print("Saved handle:", saved_handle)
```

```python
# Reconnect using saved handle
CONFIG_RESUME = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    session_resumption=types.SessionResumptionConfig(
        handle=saved_handle
    )
)

async with client.aio.live.connect(model=MODEL, config=CONFIG_RESUME) as session:
    # Session continues from where it left off
    pass
```

### Context Window Compression

Enable for sessions longer than 15 minutes to avoid hitting the context limit:

```python
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    context_window_compression=types.ContextWindowCompressionConfig(
        trigger_tokens=25600,     # compress when context exceeds this
        sliding_window=types.SlidingWindow(target_tokens=12800)
    )
)
```

### GoAway Signal

The server sends a `GoAway` message before it closes the connection.
Listen for it to reconnect gracefully:

```python
async for response in session.receive():
    if response.go_away:
        time_left = response.go_away.time_left
        print(f"Server closing in {time_left}s — reconnecting...")
        # reconnect with saved handle
```

---

## Thinking (Gemini 3.1 only)

Gemini 3.1 supports thinking depth control for more deliberate responses.
Default is `minimal` for lowest latency.

```python
CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    generation_config=types.GenerationConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level="minimal"   # minimal, low, medium, high
        )
    )
)
```

> `thinkingLevel` replaces `thinkingBudget` from older models.

---

## Ephemeral Tokens (Client-Side Auth)

Never expose your API key in browser or mobile apps.
Use ephemeral tokens instead — short-lived, single-use keys.

### Step 1 — Create token on your server

```python
import requests

response = requests.post(
    "https://generativelanguage.googleapis.com/v1beta/ephemeralTokens",
    headers={"x-goog-api-key": "YOUR_API_KEY"},
    json={
        "model": "models/gemini-3.1-flash-live-preview",
        "config": {
            "response_modalities": ["AUDIO"]
        }
    }
)

token = response.json()["name"]           # send this to the client
expires = response.json()["expireTime"]   # short-lived
```

### Step 2 — Use token on the client (browser/mobile)

```javascript
// Client-side — safe, no real API key exposed
const session = await ai.live.connect({
  model: "gemini-3.1-flash-live-preview",
  apiKey: ephemeralToken,   // use token, not real key
  config: { responseModalities: ["AUDIO"] }
});
```

---

## Pricing (Google AI Studio / Gemini API)

| Usage | Price |
|-------|-------|
| Free tier (AI Studio) | Available — rate limited |
| Audio input | $0.50 / 1M tokens |
| Audio output | $2.00 / 1M tokens |
| Text input | $0.50 / 1M tokens |
| Text output | $2.00 / 1M tokens |

---

## Supported Languages

The Live API supports 70+ languages. Native audio models (3.1) automatically
detect and switch languages mid-conversation without configuration.

Common language codes for non-native models:

| Language | Code |
|----------|------|
| English (US) | `en-US` |
| Hindi | `hi-IN` |
| French | `fr-FR` |
| Spanish | `es-ES` |
| German | `de-DE` |
| Japanese | `ja-JP` |
| Korean | `ko-KR` |
| Chinese (Simplified) | `zh-CN` |
| Arabic | `ar-XA` |
| Portuguese (Brazil) | `pt-BR` |

---

## Common Errors & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| No response from model | VAD disabled but no ActivityStart/End sent | Send `activity_start` and `activity_end` manually |
| Model keeps talking after interruption | Playback buffer not cleared | Clear audio queue immediately on `interrupted` signal |
| Garbled audio output | Wrong sample rate on your speaker | Use exactly 24000 Hz for output |
| Garbled audio input | Wrong format sent | Use 16kHz, mono, 16-bit PCM |
| Session drops after 10 min | No session resumption | Implement `session_resumption` and save handles |
| Context limit error | Session too long | Enable `context_window_compression` |
| 403 error | Wrong or missing API key | Check key in header or query param |
| 1008 policy error (Vertex AI) | Billing not enabled | Enable billing on GCP project |

---

## Best Practices

- Stream audio in **20–40 ms chunks** to minimize latency
- Always **clear playback buffer** on `interrupted` signal
- Use **`send_realtime_input`** for all real-time input — never `send_client_content` during a live session
- Enable **session resumption** for any production use case
- Enable **context window compression** for sessions > 15 minutes
- Send **`audioStreamEnd`** when the mic is paused to flush cached audio
- Use **ephemeral tokens** for any client-side (browser/mobile) deployment — never embed real API keys
- Use **headphones** when testing locally to prevent echo/self-interruption

---

## Quick Reference

| Task | Code |
|------|------|
| Connect | `client.aio.live.connect(model=MODEL, config=CONFIG)` |
| Send audio | `session.send_realtime_input(audio=Blob(data=..., mime_type="audio/pcm;rate=16000"))` |
| Send text | `session.send_realtime_input(text="hello")` |
| Signal mic paused | `session.send_realtime_input(audio_stream_end=True)` |
| Manual VAD start | `session.send_realtime_input(activity_start=ActivityStart())` |
| Manual VAD end | `session.send_realtime_input(activity_end=ActivityEnd())` |
| Receive all | `async for response in session.receive()` |
| Send tool result | `session.send_tool_response(function_responses=[...])` |
| Close session | `session.close()` |