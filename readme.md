# Meeting Bot API

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://github.com/aryanbrite/aryan-prototype/actions/workflows/ci.yml/badge.svg)](https://github.com/aryanbrite/aryan-prototype/actions/workflows/ci.yml)

Send a bot into any Google Meet, Zoom, or Teams meeting to capture audio and process it with Gemini in real time.  
This API handles all WebSocket connections and AI processing – your frontend only needs to call one endpoint.

## Features

- ✅ Join Google Meet, Zoom, and Microsoft Teams meetings
- 🤖 AI-powered bot using Google Gemini for real-time interaction
- 🔒 Secure implementation with input validation, sanitization, and rate limiting
- 📦 Docker support for easy deployment
- 🧪 Comprehensive test suite
- 📖 Detailed API documentation
- 🛡️ Security best practices implemented
- 📚 OSS-friendly with contributing guidelines and code of conduct

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Security](#security)

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Meeting BaaS API key
- Gemini API key

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/aryanbrite/aryan-prototype.git
cd aryan-prototype/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your API keys
```

### Frontend Setup

```bash
cd ../frontend
npm install

# Create .env.local
cp .env.example .env.local
# Edit .env.local with your configuration
```

## Usage

### Development Mode

```bash
# Start backend
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev
```

### Production Mode with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Production Start

```bash
# Build backend
cd backend
npm run build
npm start

# Build frontend
cd frontend
npm run build
npm start
```

## API Documentation

### Base URL

By default, the backend runs on `http://localhost:8000`

### Health Check

- `GET /` - Basic health check
- `GET /health` - Detailed health check with uptime and memory usage
- `GET /health/detailed` - Extended health check with dependency versions

### Main Endpoint

#### `POST /api/join`

Sends a bot into a meeting.

**Request Body:**
```json
{
  "meeting_url": "https://meet.google.com/abc-defg-hij"
}
```

**Supported Platforms:**
- Google Meet: `https://meet.google.com/*`
- Zoom: `https://zoom.us/j/*` or `https://*.zoom.us/*`
- Microsoft Teams: `https://teams.microsoft.com/*`

**Success Response:**
```json
{
  "status": "success",
  "bot_id": "unique-bot-identifier",
  "requestId": "uuid",
  "timestamp": "ISO timestamp"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid or missing meeting_url
- `500 Internal Server Error` - Server misconfiguration or service failure

### Environment Variables

Backend (`.env`):
```
# Required
MEETING_BAAS_API_KEY=your_meeting_baas_key
GEMINI_API_KEY=your_gemini_key

# Optional
MEETING_BAAS_API_URL=https://api.meetingbaas.com/v2/bots
MEETING_BAAS_API_VERSION=v2
MEETING_BAAS_AUTH_HEADER=x-meeting-baas-api-key
PUBLIC_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3000
PORT=8000
NODE_ENV=development
```

Frontend (`.env.local`):
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Deployment

### Docker Compose

The project includes a `docker-compose.yml` for easy deployment:

```bash
docker-compose up -d
```

This will start:
- Backend API on port 8000
- Frontend on port 3000

### Manual Deployment

#### Backend
```bash
# Build (if needed)
npm run build

# Start
NODE_ENV=production npm start
```

#### Frontend
```bash
# Build
npm run build

# Start
NODE_ENV=production npm start
```

## Development

### Code Style

We use ESLint for code quality. Run linting with:

```bash
# Backend
cd backend
npm run lint

# Frontend
cd frontend
npm run lint
```

### Adding Features

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add or update tests
5. Ensure all tests pass
6. Commit and push
7. Open a Pull Request

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Test Coverage

To view coverage reports:

```bash
# Backend
cd backend
npm test -- --coverage

# Frontend
cd frontend
npm test -- --coverage
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

Please read [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Meeting BaaS](https://www.meetingbaas.com/) for meeting automation
- [Google Gemini](https://ai.google.dev/) for AI capabilities
- All contributors who have helped shape this project

---

Made with ❤️ by Aryan Brite