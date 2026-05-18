# Meeting Bot API

**Base URL:** `https://api.deyweaver.live`

Send a bot into any Google Meet, Zoom, or Teams meeting to capture audio and process it with Gemini in real time.  
This API handles all WebSocket connections and AI processing – your frontend only needs to call one endpoint.

---

## Authentication

No authentication is required from the frontend.  
All necessary API keys (`MeetingBaas`, `Gemini`) are stored securely on the server.

---

## Endpoint

### `POST /api/join`

Sends a bot into a meeting. The bot will:
- Join the meeting using the provided URL.
- Capture the speaker’s audio.
- Stream the audio to Gemini for real‑time transcription and analysis.
- Automatically leave when the meeting ends (or after a timeout in the waiting room).

#### Request

- **Method:** `POST`
- **Content-Type:** `application/json`

**Body parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meeting_url` | string | Yes | Full URL of the meeting (e.g., `https://meet.google.com/abc-defg-hij`) |

**Example:**

```json
{
  "meeting_url": "https://meet.google.com/abc-defg-hij"
}
```

#### Success Response

- **Status:** `200 OK`
- **Body:**

```json
{
  "status": "success",
  "bot_id": "unique-bot-identifier"
}
```

The `bot_id` can be used later to query the bot’s status (if such a route becomes available).

#### Error Responses

- **400 Bad Request** – `meeting_url` is missing.

```json
{
  "error": "meeting_url is required"
}
```

- **500 Internal Server Error** – Server misconfiguration (e.g., missing API keys) or MeetingBaas/Gemini service failure.

```json
{
  "status": "error",
  "message": "MEETING_BAAS_API_KEY not set"
}
```

---

## Integration Examples

### 1. Next.js / React (TypeScript)

Add the backend URL to your environment variables:

```env
# .env.local
NEXT_PUBLIC_API_URL=https://api.deyweaver.live
```

Then use this component anywhere in your app:

```tsx
'use client';
import { useState } from 'react';

export default function MeetingBot() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult('Sending bot to meeting...');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_url: meetingUrl }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        setResult(`Bot joined! ID: ${data.bot_id}`);
      } else {
        setResult(`Error: ${data.message || JSON.stringify(data)}`);
      }
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin}>
      <input
        type="text"
        value={meetingUrl}
        onChange={(e) => setMeetingUrl(e.target.value)}
        placeholder="Paste Google Meet link"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Joining...' : 'Send Bot'}
      </button>
      {result && <p>{result}</p>}
    </form>
  );
}
```

### 2. Vanilla HTML / JavaScript

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meeting Bot</title>
</head>
<body>
  <h1>Join Meeting with Bot</h1>
  <form id="botForm">
    <input type="text" id="meetingUrl" placeholder="https://meet.google.com/abc-defg-hij" required>
    <button type="submit">Send Bot</button>
  </form>
  <p id="result"></p>

  <script>
    const API_URL = 'https://api.deyweaver.live';
    const form = document.getElementById('botForm');
    const resultEl = document.getElementById('result');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const meetingUrl = document.getElementById('meetingUrl').value;
      resultEl.textContent = 'Sending bot...';

      try {
        const res = await fetch(`${API_URL}/api/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meeting_url: meetingUrl }),
        });
        const data = await res.json();
        if (data.status === 'success') {
          resultEl.textContent = `Bot joined! ID: ${data.bot_id}`;
        } else {
          resultEl.textContent = `Error: ${data.message || JSON.stringify(data)}`;
        }
      } catch (err) {
        resultEl.textContent = `Network error: ${err.message}`;
      }
    });
  </script>
</body>
</html>
```

### 3. cURL (command line)

```bash
curl -X POST https://api.deyweaver.live/api/join \
  -H "Content-Type: application/json" \
  -d '{"meeting_url": "https://meet.google.com/abc-defg-hij"}'
```

---

## Notes

- **CORS:** The server allows requests from any origin (`*`), so browser‑based calls work without issues.
- **Rate Limiting:** Currently none, but please use responsibly. Contact us if you plan high‑volume usage.
- **Bot Behavior:** The bot appears in the meeting as a participant, records the speaker’s audio, and streams it to Gemini. The audio is processed in near‑real time, but the final transcription / summary may be available later via a future status endpoint.
- **Supported Platforms:** Google Meet, Zoom, Microsoft Teams (URL must be accessible to the bot; password‑protected meetings might require additional configuration – contact us for help).

---

## Support

For issues, feature requests, or to obtain API keys for self‑hosted deployments, open an issue on our GitHub repository:  
[https://github.com/aryanbrite/aryan-prototype](https://github.com/aryanbrite/aryan-prototype)
