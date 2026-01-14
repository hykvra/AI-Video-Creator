# AI Video Generator

Generate professional AI-powered videos from any topic with multilingual narration (Gujarati, Hindi, English).

## Features

- 🎬 **Multiple Video Genres**: Informative, Comedy, Storytelling, Motivational, "Did You Know" facts
- 🌍 **Multi-language Support**: Gujarati, Hindi, and English narration
- 🎭 **Comedy Level Control**: Mild, Medium, or Spicy humor intensity
- 🎨 **AI-Generated Visuals**: Gemini 2.5 Flash Image for scene generation
- 🗣️ **Natural Voice**: Cartesia TTS with Sonic-3 model
- 🎵 **Dynamic Effects**: Ken Burns animation, crossfade transitions
- 📊 **YouTube Optimization**: Auto-generated SEO metadata, titles, tags, and thumbnail prompts
- 👀 **Preview Mode**: Review and approve scripts before video generation
- ☁️ **Cloud Storage**: Google Cloud Storage for output files
- 📱 **Mobile-First**: 9:16 vertical aspect ratio for social media

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Web Frontend (SSE)                           │
│                   (public/index.html)                            │
└───────────────────────────┬──────────────────────────────────────┘
                            │ POST /api/create-video
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Node.js/Express API                           │
│                       (index.js)                                 │
├──────────────────────────────────────────────────────────────────┤
│  1. Gemini 2.5 Flash → Generate script with YouTube metadata    │
│  2. Gemini 2.5 Flash Image → Generate scene images (720x1280)   │
│  3. Cartesia TTS (Sonic-3) → Multilingual audio narration       │
│  4. FFmpeg → Create clips with Ken Burns effect + concatenate   │
│  5. Google Cloud Storage → Upload final video                   │
└──────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd ai-video-service
npm install
```

### 2. Configure Environment Variables

Create or edit the `.env` file with your API keys:

```env
# Google Gemini API Key (Required - used for both script and image generation)
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model Configuration
GEMINI_SCRIPT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# Cartesia TTS API Key (Required)
CARTESIA_API_KEY=your_cartesia_api_key_here
CARTESIA_VOICE_ID=your_cartesia_voice_id_here

# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000

# Google Cloud Storage (Optional - for deployment)
GCS_BUCKET_NAME=your-gcs-bucket-name
```

### 3. Start the Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

### 4. Access the Web UI

Open your browser to:
```
http://localhost:3000
```

## API Endpoints

### POST `/api/create-video`

Creates an AI-generated video from a topic via Server-Sent Events (SSE).

**Request Body:**
```json
{
  "topic": "The History of Ancient Egypt",
  "duration": 60,
  "genre": "informative",
  "comedyLevel": "mild",
  "language": "gujarati",
  "preview": false
}
```

**Parameters:**
- `topic` (string, required for most genres): The video topic
- `hook` (string, required for "didyouknow" genre): Attention-grabbing question/statement
- `fact` (string, required for "didyouknow" genre): The surprising fact to reveal
- `duration` (number, optional): Target duration in seconds (30-300, default: 60)
- `genre` (string, optional): Video style - `informative`, `comedy`, `storytelling`, `motivational`, `didyouknow` (default: `informative`)
- `comedyLevel` (string, optional): Comedy intensity - `mild`, `medium`, `spicy` (default: `mild`, only applies to comedy genre)
- `language` (string, optional): Narration language - `gujarati`, `hindi`, `english` (default: `gujarati`)
- `preview` (boolean, optional): If `true`, returns script for review before generating video (default: `false`)

**Response (Immediate):**
```json
{
  "success": true,
  "sessionId": "1234567890",
  "message": "Video creation started"
}
```

**SSE Stream Events:**
Client receives real-time progress updates via Server-Sent Events on the `/api/progress/:sessionId` endpoint.

### GET `/api/progress/:sessionId`

Server-Sent Events stream for video creation progress.

**Event Types:**
- `script` - Script generation
- `images` - Image generation progress
- `audio` - Audio synthesis
- `video` - Video encoding
- `upload` - Cloud storage upload
- `complete` - Video ready with URL and metadata
- `previewReady` - Script ready for review (preview mode)
- `error` - Error occurred

### POST `/api/confirm-video`

Resume video generation after script preview approval.

**Request Body:**
```json
{
  "sessionId": "1234567890"
}
```

### POST `/api/test-images`

Test endpoint for batch image generation (no audio/video).

**Request Body:**
```json
{
  "prompts": [
    "A beautiful sunset over mountains",
    "A cute cat playing with yarn"
  ]
}
```

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

## Project Structure

```
ai-video-service/
├── .env                    # Environment variables (API keys)
├── .gcloudignore           # Google Cloud Build ignore rules
├── Dockerfile              # Docker container configuration
├── cloudbuild.yaml         # Cloud Build deployment config
├── package.json            # Node.js dependencies
├── index.js                # Express server & video pipeline
├── VideoCreator.js         # React Native component (legacy)
├── public/                 # Web frontend
│   └── index.html          # Web UI for video creation
├── temp/                   # Temporary processing files
├── output/                 # Generated video files (local)
└── assest/                 # Static assets (subscribe image, etc.)
```

## Dependencies

### Core APIs
- **@google/genai** - Gemini SDK for script and image generation
- **@cartesia/cartesia-js** - Cartesia TTS for voice synthesis

### Cloud & Storage
- **@google-cloud/storage** - Google Cloud Storage SDK

### Media Processing
- **fluent-ffmpeg** - FFmpeg wrapper for video encoding
- **ffmpeg-static** - Static FFmpeg binary

### Server & Utilities
- **express** - Web server framework
- **axios** - HTTP client
- **dotenv** - Environment configuration

## Deployment

### Google Cloud Run

The service is configured for deployment to Google Cloud Run using Cloud Build.

**Deploy Command:**
```bash
gcloud builds submit
```

**Requirements:**
- Google Cloud Project with Cloud Run and Cloud Build APIs enabled
- Service account with Storage permissions (for GCS uploads)
- `.gcloudignore` configured correctly (excluding `node_modules`, but including `package-lock.json`)

**Environment Variables (Cloud Run):**
Set these in the Cloud Run service configuration:
- `GEMINI_API_KEY`
- `CARTESIA_API_KEY`
- `CARTESIA_VOICE_ID`
- `GCS_BUCKET_NAME`
- `PORT` (automatically set by Cloud Run)

## Usage Examples

### Example 1: Informative Video in Gujarati
```json
{
  "topic": "The Science of Black Holes",
  "duration": 45,
  "genre": "informative",
  "language": "gujarati"
}
```

### Example 2: Comedy Video with Medium Spice
```json
{
  "topic": "Modern Dating in India",
  "duration": 60,
  "genre": "comedy",
  "comedyLevel": "medium",
  "language": "hindi"
}
```

### Example 3: "Did You Know" Fact Video
```json
{
  "hook": "Did you know honey never spoils?",
  "fact": "Archaeologists have found 3000-year-old honey in Egyptian tombs that is still perfectly edible!",
  "genre": "didyouknow",
  "language": "english"
}
```

### Example 4: Preview Mode (Review Script First)
```json
{
  "topic": "The Story of the Taj Mahal",
  "genre": "storytelling",
  "language": "gujarati",
  "preview": true
}
```

When `preview: true`, the server returns the script via SSE event `previewReady`. Review the script, then call `/api/confirm-video` to proceed with video generation.

## Video Output

- **Format**: MP4 (H.264 video, AAC audio)
- **Resolution**: 720x1280 (9:16 portrait)
- **Frame Rate**: 24 fps
- **Visual Effects**: Ken Burns animation (zoom/pan)
- **Transitions**: Crossfade between scenes
- **Duration**: Based on natural narration length (~15 seconds per scene)

## YouTube Metadata

Each generated video includes SEO-optimized YouTube metadata:
- **Title**: Viral, clickbait-style title (max 60 chars)
- **Description**: SEO-optimized description with keywords and hashtags (100-150 words)
- **Tags**: 10-15 high-volume search tags
- **Thumbnail Prompts**: 2 different high-CTR thumbnail concepts

Access this metadata in the final SSE `complete` event response.

## Troubleshooting

### Build Fails with "npm ci" Error
Ensure `package-lock.json` is NOT in `.gcloudignore`. The Docker build requires this file.

### Audio Not Generated
Check that `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID` are correctly set in `.env`.

### Images Are Placeholders
Gemini 2.5 Flash Image may occasionally fail. The system will retry 3 times before using a placeholder.

### Video Generation Timeout
For longer videos (>90 seconds), increase the Cloud Run timeout setting (default: 300s, max: 3600s).

## License

MIT
