# AI Video Generator

Generate professional AI-powered videos from any topic with Gujarati narration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Native App                             │
│                    (VideoCreator.js)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ POST /api/create-video
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js/Express API                          │
│                       (index.js)                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Gemini 2.5 Flash → Generate scenes (JSON schema)            │
│  2. Image API → Generate scene images (720x1280)                │
│  3. ElevenLabs TTS → Gujarati audio for each scene              │
│  4. FFmpeg → Create clips & concatenate final video             │
└─────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd ai-video-service
npm install
```

### 2. Configure Environment Variables

Edit the `.env` file with your API keys:

```env
# Google Gemini API Key (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs TTS API Key (Required)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here

# Image Generation API (Optional - falls back to placeholder)
IMAGE_API_KEY=your_image_api_key_here
IMAGE_API_URL=https://api.example.com/generate-image

# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000
```

### 3. Start the Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

### 4. Test the API

```bash
curl -X POST http://localhost:3000/api/create-video \
  -H "Content-Type: application/json" \
  -d '{"topic": "The History of Ancient Egypt"}'
```

## API Endpoints

### POST `/api/create-video`

Creates an AI-generated video from a topic.

**Request Body:**
```json
{
  "topic": "Your video topic here"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "videoUrl": "http://localhost:3000/output/final_video_1234567890.mp4",
  "scenesCount": 5,
  "message": "Video created successfully"
}
```

### GET `/api/health`

Health check endpoint.

## React Native Integration

Import the `VideoCreator` component into your React Native app:

```jsx
import VideoCreator from './VideoCreator';

function App() {
  return <VideoCreator />;
}
```

**Note:** Update `API_BASE_URL` in `VideoCreator.js` to match your server URL.

## Project Structure

```
ai-video-service/
├── .env                 # Environment variables
├── package.json         # Node.js dependencies
├── index.js             # Express server & video pipeline
├── VideoCreator.js      # React Native component
├── temp/                # Temporary processing files
└── output/              # Generated video files
```

## Dependencies

- **@google/generative-ai** - Gemini AI SDK
- **axios** - HTTP client
- **express** - Web server
- **fluent-ffmpeg** - FFmpeg wrapper
- **ffmpeg-static** - Static FFmpeg binary
- **dotenv** - Environment configuration
