# Meeting BaaS — Complete API Reference

---

## What Is Meeting BaaS

Meeting BaaS (Meeting **B**ots **a**s **a** **S**ervice) is an API that lets you
deploy bots as real participants into video meetings on Google Meet, Microsoft
Teams, and Zoom. The bot can join, record audio/video, transcribe speech, stream
live audio, and leave — all controlled over HTTP.

- **Base API URL:** `https://api.meetingbaas.com`
- **Docs:** `https://docs.meetingbaas.com`
- **OpenAPI spec:** `https://docs.meetingbaas.com/api/reference`

---

## Authentication

Every request requires your API key in the header:

```
x-meeting-baas-api-key: YOUR_API_KEY
```

Get your key at **meetingbaas.com → Dashboard → API Keys**.

---

## Pricing

- **Free tier:** 4 hours on signup
- **After free tier:** $0.69 / hour
- **Free tier bot limit:** 75 bots/day
- **Recording retention (free):** 3 days

---

## API Versions

Two versions run in parallel. Both are supported:

| Version | URL | Notes |
|---------|-----|-------|
| v1 | `https://api.meetingbaas.com` | Stable, production |
| v2 | `https://api.meetingbaas.com/v2` | Recommended for new integrations |

---

## Supported Platforms

- Google Meet
- Microsoft Teams
- Zoom

---

## Endpoints

---

### 1. Join a Meeting

**`POST https://api.meetingbaas.com/bots`**

Sends a bot into a meeting immediately or at a scheduled time.

#### Full Request Body

```json
{
  "meeting_url": "https://meet.google.com/xxx-yyy-zzz",
  "bot_name": "My Bot",
  "bot_image": "https://example.com/avatar.jpg",
  "entry_message": "Hello, I have joined the meeting.",
  "recording_mode": "speaker_view",
  "reserved": false,
  "start_time": 0,
  "deduplication_key": "unique-key-optional",
  "extra": { "your_user_id": "abc123" },
  "speech_to_text": {
    "provider": "Default",
    "api_key": "optional-your-own-stt-key"
  },
  "streaming": {
    "audio_frequency": "16khz",
    "input": "wss://your-server.com/audio-in",
    "output": "wss://your-server.com/audio-out"
  },
  "automatic_leave": {
    "waiting_room_timeout": 600,
    "noone_joined_timeout": 0
  },
  "webhook_url": "https://your-server.com/webhook",
  "zoom_sdk_id": "only-for-zoom",
  "zoom_sdk_pwd": "only-for-zoom"
}
```

#### Parameter Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `meeting_url` | string | ✅ | Full URL of the meeting |
| `bot_name` | string | ✅ | Display name shown in participant list |
| `bot_image` | string | ❌ | Avatar image URL. Recommended 16:9 ratio |
| `entry_message` | string | ❌ | Chat message sent when bot joins. **Not supported on Microsoft Teams** |
| `recording_mode` | string | ❌ | `speaker_view` (default), `gallery_view`, `audio_only` |
| `reserved` | boolean | ❌ | `false` = instant pool bot. `true` = dedicated bot, arrives exactly 4 min after request |
| `start_time` | number | ❌ | Unix timestamp in ms for scheduled join. Bot arrives 4 min before this |
| `deduplication_key` | string | ❌ | Override the default 5-min duplicate block |
| `extra` | object | ❌ | Any JSON stored on the bot for your reference |
| `speech_to_text.provider` | string | ❌ | `Default` (Gladia), `Gladia`, `Deepgram`, `AssemblyAI` |
| `speech_to_text.api_key` | string | ❌ | Bring your own STT key to use your own quota |
| `streaming.audio_frequency` | string | ❌ | `16khz` — only option currently |
| `streaming.output` | string | ❌ | Your WebSocket URL — Meeting BaaS **pushes meeting audio here** |
| `streaming.input` | string | ❌ | Your WebSocket URL — **you push audio here** to make the bot speak |
| `automatic_leave.waiting_room_timeout` | number | ❌ | Seconds to wait in waiting room before leaving. Default: `600` |
| `automatic_leave.noone_joined_timeout` | number | ❌ | Seconds to wait if nobody else joins. `0` = disabled |
| `webhook_url` | string | ❌ | Per-bot webhook URL, overrides account-level default |
| `zoom_sdk_id` / `zoom_sdk_pwd` | string | ❌ | Zoom only — for your own Zoom app credentials |

#### Response

```json
{
  "bot_id": "abc123-def456-..."
}
```

#### Example — curl

```bash
curl -X POST "https://api.meetingbaas.com/bots" \
  -H "x-meeting-baas-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_url": "https://meet.google.com/xxx-yyy-zzz",
    "bot_name": "AI Notetaker",
    "entry_message": "Hello! I am here to assist.",
    "recording_mode": "speaker_view",
    "speech_to_text": { "provider": "Default" },
    "automatic_leave": { "waiting_room_timeout": 600 }
  }'
```

#### Example — Python

```python
import requests

response = requests.post(
    "https://api.meetingbaas.com/bots",
    headers={
        "x-meeting-baas-api-key": "YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={
        "meeting_url": "https://meet.google.com/xxx-yyy-zzz",
        "bot_name": "AI Notetaker",
        "entry_message": "Hello!",
        "recording_mode": "speaker_view",
        "speech_to_text": { "provider": "Default" },
        "automatic_leave": { "waiting_room_timeout": 600 }
    }
)

bot_id = response.json()["bot_id"]
print("Bot ID:", bot_id)
```

#### Example — JavaScript

```javascript
const response = await fetch("https://api.meetingbaas.com/bots", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-meeting-baas-api-key": "YOUR_API_KEY"
  },
  body: JSON.stringify({
    meeting_url: "https://meet.google.com/xxx-yyy-zzz",
    bot_name: "AI Notetaker",
    entry_message: "Hello!",
    recording_mode: "speaker_view",
    speech_to_text: { provider: "Default" },
    automatic_leave: { waiting_room_timeout: 600 }
  })
});

const { bot_id } = await response.json();
console.log("Bot ID:", bot_id);
```

---

### 2. Leave a Meeting

**`DELETE https://api.meetingbaas.com/bots/{bot_id}`**

Immediately removes the bot from the meeting.

```bash
curl -X DELETE "https://api.meetingbaas.com/bots/YOUR_BOT_ID" \
  -H "x-meeting-baas-api-key: YOUR_API_KEY"
```

---

### 3. Get Meeting Data

**`GET https://api.meetingbaas.com/bots/{bot_id}`**

Returns recording URL, full transcript, speaker list, and metadata.

```bash
curl "https://api.meetingbaas.com/bots/YOUR_BOT_ID" \
  -H "x-meeting-baas-api-key: YOUR_API_KEY"
```

#### Response

```json
{
  "bot_id": "abc123",
  "meeting_url": "https://meet.google.com/xxx-yyy-zzz",
  "status": "complete",
  "duration": 3600,
  "mp4": "https://storage.example.com/recording.mp4",
  "speakers": ["John Doe", "Jane Smith"],
  "transcript": [
    {
      "speaker": "John Doe",
      "offset": 1.5,
      "words": [
        { "start": 1.5, "end": 1.9, "word": "Hello" },
        { "start": 2.0, "end": 2.4, "word": "everyone" }
      ]
    }
  ]
}
```

---

### 4. List All Bots

**`GET https://api.meetingbaas.com/bots`**

Returns all bots under your API key with their current status.

```bash
curl "https://api.meetingbaas.com/bots" \
  -H "x-meeting-baas-api-key: YOUR_API_KEY"
```

---

### 5. Retranscribe a Bot

**`POST https://api.meetingbaas.com/bots/retranscribe`**

Re-runs transcription on an existing recording using a different STT provider.
Fires a `transcription_complete` webhook when done.

```bash
curl -X POST "https://api.meetingbaas.com/bots/retranscribe" \
  -H "x-meeting-baas-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bot_uuid": "YOUR_BOT_ID",
    "speech_to_text": {
      "provider": "Gladia",
      "api_key": "your-gladia-key"
    },
    "webhook_url": "https://your-server.com/webhook"
  }'
```

---

### 6. Delete Bot Data

**`DELETE https://api.meetingbaas.com/bots/{bot_id}/data`**

Permanently deletes the recording and transcript for a bot.

```bash
curl -X DELETE "https://api.meetingbaas.com/bots/YOUR_BOT_ID/data" \
  -H "x-meeting-baas-api-key: YOUR_API_KEY"
```

---

## WebSocket Audio Streaming

When you include `streaming.input` and `streaming.output` in your join
request, Meeting BaaS opens two WebSocket connections to your server.

### Flow

```
[ Meeting participants ]
        |
        | (WebRTC internal)
        |
[ Meeting BaaS Bot ]
        |
        |--- streaming.output ---> wss://your-server/audio-out  (you RECEIVE audio)
        |<-- streaming.input  ---  wss://your-server/audio-in   (you SEND audio / bot speaks)
```

### Audio Format

| Property | Value |
|----------|-------|
| Format | Raw PCM |
| Sample rate | 16,000 Hz |
| Channels | Mono |
| Bit depth | 16-bit signed |

> Your server must have a publicly reachable WebSocket URL.
> Use [ngrok](https://ngrok.com) to tunnel your local server during development:
>
> ```bash
> ngrok http 8765
> # use wss://xxxx.ngrok-free.app as your streaming URL
> ```

### streaming.output — Receive Meeting Audio

Meeting BaaS connects to this URL and streams raw PCM audio chunks
from the meeting in real time.

```python
import asyncio
import websockets

async def receive_audio(websocket):
    async for chunk in websocket:
        # chunk = raw 16kHz mono PCM bytes from the meeting
        process_audio(chunk)

async def main():
    async with websockets.serve(receive_audio, "0.0.0.0", 8765):
        await asyncio.Future()

asyncio.run(main())
```

### streaming.input — Send Audio (Bot Speaks)

Meeting BaaS connects to this URL and reads bytes you send.
Whatever audio you push here plays through the bot's microphone in the meeting.

```python
import asyncio
import websockets

input_ws = None

async def handle_input_connection(websocket):
    global input_ws
    input_ws = websocket
    await websocket.wait_closed()

async def bot_speak(audio_bytes: bytes):
    if input_ws:
        await input_ws.send(audio_bytes)

async def main():
    async with websockets.serve(handle_input_connection, "0.0.0.0", 8766):
        await asyncio.Future()

asyncio.run(main())
```

---

## Webhooks

Meeting BaaS pushes real-time events to your `webhook_url`.
Set a default in your dashboard, or pass `webhook_url` per bot to override.

### Event Types

| Event | When it fires |
|-------|---------------|
| `complete` | Bot finished; recording and transcript are ready |
| `failed` | Bot could not join or recording failed |
| `transcription_complete` | A retranscribe job has finished |
| `bot.status_change` | Bot changed state |

### Bot Status Values

| Status | Meaning |
|--------|---------|
| `joining` | Bot is attempting to join |
| `in_waiting_room` | Bot is waiting to be admitted |
| `in_call_not_recording` | Bot joined but not yet recording |
| `in_call_recording` | Bot is in the call and recording |
| `call_ended` | Call has ended |
| `done` | Fully completed, data is available |
| `failed` | Something went wrong |

### Payloads

#### complete

```json
{
  "event": "complete",
  "data": {
    "bot_id": "abc123",
    "meeting_url": "https://meet.google.com/xxx-yyy-zzz",
    "mp4": "https://storage.example.com/recording.mp4",
    "speakers": ["Jane Smith", "John Doe"],
    "transcript": [
      {
        "speaker": "John Doe",
        "offset": 1.5,
        "words": [
          { "start": 1.5, "end": 1.9, "word": "Hello" },
          { "start": 2.0, "end": 2.4, "word": "everyone" }
        ]
      }
    ]
  }
}
```

#### bot.status_change

```json
{
  "event": "bot.status_change",
  "data": {
    "bot_id": "abc123",
    "status": "in_call_recording"
  }
}
```

#### failed

```json
{
  "event": "failed",
  "data": {
    "bot_id": "abc123",
    "error": "Could not join meeting — waiting room timeout"
  }
}
```

#### transcription_complete

```json
{
  "event": "transcription_complete",
  "data": {
    "bot_id": "abc123"
  }
}
```

### Verifying Webhook Signatures

The signature is in the `X-MeetingBaas-Signature` header, signed with HMAC-SHA256.

```python
import hmac
import hashlib
from flask import Flask, request

app = Flask(__name__)
WEBHOOK_SECRET = "your-webhook-secret"

def verify(payload: bytes, signature: str) -> bool:
    expected = hmac.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.post("/webhook")
def webhook():
    sig = request.headers.get("X-MeetingBaas-Signature")
    if not sig or not verify(request.get_data(), sig):
        return "Unauthorized", 401

    event = request.json
    match event["event"]:
        case "complete":
            handle_complete(event["data"])
        case "bot.status_change":
            handle_status(event["data"])
        case "failed":
            handle_failure(event["data"])
        case "transcription_complete":
            handle_retranscribe(event["data"])

    return "ok", 200
```

---

## Bot Behavior Rules

- **Deduplication:** Only one bot per API key can join the same meeting within
  5 minutes. Override by providing a unique `deduplication_key`.
- **Waiting room:** The bot knocks and waits to be admitted.
  `waiting_room_timeout` controls how long before it gives up (default 600s).
- **Teams entry messages:** Not supported — Teams guests outside an org
  cannot send chat messages.
- **Reserved bots:** `reserved: true` = guaranteed dedicated instance.
  `reserved: false` = instant shared pool bot.
- **Scheduled bots:** Pass `start_time` as a Unix ms timestamp and the bot
  joins 4 minutes before that time.

---

## TypeScript SDK

```bash
npm install @meeting-baas/sdk
```

```typescript
import { createBaasClient } from "@meeting-baas/sdk";

// v1 client
const client = createBaasClient({ api_key: "your-api-key" });

// v2 client
const clientV2 = createBaasClient({
  api_key: "your-api-key",
  api_version: "v2"
});

// Join a meeting
const { success, data, error } = await client.joinMeeting({
  meeting_url: "https://meet.google.com/abc-def-ghi",
  bot_name: "My Bot",
  reserved: false
});

if (success) {
  console.log("Bot ID:", data.bot_id);
} else {
  console.error("Error:", error.message);
}

// Type-safe webhook handler (v2)
import type { V2 } from "@meeting-baas/sdk";

async function onWebhook(payload: V2.BotWebhookCompleted) {
  if (payload.event === "bot.completed") {
    console.log("Bot ID:", payload.data.bot_id);
    console.log("Transcript:", payload.data.transcription);
  }
}
```

---

## Quick Endpoint Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| Send bot to meeting | `POST` | `/bots` |
| Remove bot | `DELETE` | `/bots/{bot_id}` |
| Get recording + transcript | `GET` | `/bots/{bot_id}` |
| List all bots | `GET` | `/bots` |
| Retranscribe recording | `POST` | `/bots/retranscribe` |
| Delete bot data | `DELETE` | `/bots/{bot_id}/data` |