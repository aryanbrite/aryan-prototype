<p align="center"> <img src="https://raw.githubusercontent.com/cucumbu/brand/c3aacc716c66b45b031e62ce096c2794d7835588/logo/favicon.svg" width="128" height="128" alt="Aryan Brite website logo">
</p>

<h1 align="center">.cucumbu</h1>

<p align="center"> An AI agent that joins google meet (API).
</p>

---


<p align="center">
  <img src="https://img.shields.io/badge/Version-v1.0.0-orange?style=for-the-badge&labelColor=222222" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge&labelColor=222222" alt="License">
  <img src="https://img.shields.io/badge/Open%20Source-Yes-blue?style=for-the-badge&labelColor=222222" alt="Open Source">
<img src="https://img.shields.io/badge/Built%20With-Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white&labelColor=222222" alt="Built With Next.js">
  <img src="https://img.shields.io/badge/Hack%20Club-❤-ec3750?style=for-the-badge&labelColor=222222" alt="Hack Club">
  <img src="https://img.shields.io/badge/Made%20with-❤-red?style=for-the-badge&labelColor=222222" alt="Made with Love">
</p>

## Demo
https://github.com/user-attachments/assets/c150acdc-b093-49bb-8afe-c0a94f1a91d4

- Live interactive demo hosted on [AWS - Click here](https://main.d25jqso5xz1bf4.amplifyapp.com/)

## Authentication
Right now thie API key dont require any API keys. Its public at base url https://aryan-prototype.onrender.com
all the API keys is stored there.

## Endpoint
### POST /api/join
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

## API usecase example
to excess this from your command line 
```bash
curl -X POST https://aryan-prototype.onrender.com/api/join \
  -H "Content-Type: application/json" \
  -d '{"meeting_url": "https://meet.google.com/abc-defg-hij"}'
```

1) Clone the repository:

```sh
 git clone https://github.com/aryanbrite/aryan-prototype 
```

2) Follow instructions on backand and frontend folder readme. 

---

Made with love, bad decisions, and way too much free time.
