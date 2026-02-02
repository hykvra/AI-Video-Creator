# AI Video Service

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **AI-powered video generation service** that creates professional videos from any topic with multilingual narration, AI-generated visuals, and YouTube-optimized metadata.

Transform your ideas into engaging videos with just a topic! This service uses Google Gemini for script writing and image generation, Cartesia TTS for natural-sounding narration in multiple languages, and FFmpeg for professional video production.

---

## ✨ Features

### 🎬 **Multiple Video Genres**
- **Informative** - Educational content with clear explanations
- **Comedy** - Humorous content with adjustable spice levels (Mild, Medium, Spicy)
- **Storytelling** - Narrative-driven videos with emotional engagement
- **Motivational** - Inspiring content with uplifting messages
- **Did You Know** - Viral fact videos with hook-based structure

### 🌍 **Multilingual Support**
- **Gujarati** (ગુજરાતી) - Native script narration
- **Hindi** (हिंदी) - Native Devanagari script
- **English** - Professional narration

All scripts use native writing systems with proper pronunciation handling.

### 🎨 **AI-Powered Production**
- **Script Generation** - Gemini 2.5 Flash creates engaging, genre-specific scripts
- **Visual Creation** - Gemini 2.5 Flash Image generates scene-specific 9:16 vertical images
- **Voice Synthesis** - Cartesia Sonic-3 TTS for natural multilingual narration
- **Video Effects** - Ken Burns animations, smooth crossfade transitions, 24fps output
- **YouTube Optimization** - Auto-generated SEO titles, descriptions, tags, and thumbnail concepts

### 📱 **Modern Architecture**
- **Web UI** - Clean, responsive interface with real-time progress updates
- **SSE (Server-Sent Events)** - Live progress tracking during video creation
- **Preview Mode** - Review and approve scripts before video generation
- **Cloud Storage** - Optional Google Cloud Storage integration
- **Mobile-First** - 720x1280 (9:16) vertical videos optimized for social media

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **API Keys**:
  - [Google Gemini API Key](https://makersuite.google.com/app/apikey)
  - [Cartesia API Key](https://cartesia.ai)
- **FFmpeg** (automatically included via `ffmpeg-static`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rajhussainkanani/ai-video-service.git
   cd ai-video-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file** with your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   CARTESIA_API_KEY=your_cartesia_api_key_here
   CARTESIA_VOICE_ID=your_voice_id_here
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

---

## 📖 API Documentation

### **POST** `/api/create-video`

Creates an AI-generated video from a topic via Server-Sent Events.

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | Yes (except for `didyouknow`) | The video topic |
| `hook` | string | Yes (for `didyouknow` only) | Attention-grabbing question/statement |
| `fact` | string | Yes (for `didyouknow` only) | The surprising fact to reveal |
| `duration` | number | No | Target duration in seconds (30-300, default: 60) |
| `genre` | string | No | Video style: `informative`, `comedy`, `storytelling`, `motivational`, `didyouknow` (default: `informative`) |
| `comedyLevel` | string | No | Comedy intensity: `mild`, `medium`, `spicy` (default: `mild`, applies to comedy genre only) |
| `language` | string | No | Narration language: `gujarati`, `hindi`, `english` (default: `gujarati`) |
| `preview` | boolean | No | If `true`, returns script for review before video generation (default: `false`) |

**Response (Immediate):**
```json
{
  "success": true,
  "sessionId": "1234567890",
  "message": "Video creation started"
}
```

**SSE Stream Events:**

Connect to `/api/progress/:sessionId` to receive real-time updates:

- `script` - Script generation progress
- `images` - Image generation progress (per scene)
- `audio` - Audio synthesis progress
- `video` - Video encoding progress
- `upload` - Cloud storage upload (if configured)
- `complete` - Video ready with URL and YouTube metadata
- `previewReady` - Script ready for review (preview mode)
- `error` - Error occurred

---

### **GET** `/api/progress/:sessionId`

Server-Sent Events stream for video creation progress.

---

### **POST** `/api/confirm-video`

Resume video generation after script preview approval.

**Request Body:**
```json
{
  "sessionId": "1234567890"
}
```

---

### **GET** `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T10:00:00.000Z"
}
```

---

## 🎯 Usage Examples

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

When `preview: true`, the server returns the script via SSE event `previewReady`. Review the script on the web UI, then call `/api/confirm-video` with the `sessionId` to proceed with video generation.

---

## 🏗️ Architecture

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
│  5. Google Cloud Storage → Upload final video (optional)        │
└──────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
ai-video-service/
├── index.js                # Main Express server & video pipeline
├── VideoCreator.js         # React Native component (reference)
├── public/                 # Web frontend
│   └── index.html          # Web UI for video creation
├── temp/                   # Temporary processing files
├── output/                 # Generated video files (local)
├── assest/                 # Static assets (subscribe image, etc.)
├── .env.example            # Environment variables template
├── LICENSE                 # MIT License with attribution
├── CONTRIBUTING.md         # Contribution guidelines
└── README.md               # This file
```

---

## 🎥 Video Output Specifications

- **Format**: MP4 (H.264 video, AAC audio)
- **Resolution**: 720x1280 pixels (9:16 portrait)
- **Frame Rate**: 24 fps
- **Visual Effects**: Ken Burns animation (zoom/pan)
- **Transitions**: Crossfade between scenes
- **Duration**: Based on natural narration length (~15 seconds per scene)
- **Audio**: 44.1kHz, 192kbps AAC stereo

---

## ☁️ Deployment

### Google Cloud Run

The service is configured for deployment to Google Cloud Run using Cloud Build.

**Deploy Command:**
```bash
gcloud builds submit
```

**Prerequisites:**
- Google Cloud Project with Cloud Run and Cloud Build APIs enabled
- Service account with Storage permissions (for GCS uploads)
- Properly configured `.gcloudignore` (excluding `node_modules` but including `package-lock.json`)

**Environment Variables (Cloud Run):**

Set these in Cloud Run service configuration:
- `GEMINI_API_KEY`
- `CARTESIA_API_KEY`
- `CARTESIA_VOICE_ID`
- `GCS_BUCKET_NAME`
- `PORT` (automatically set by Cloud Run)

For longer videos (>90 seconds), increase the Cloud Run timeout setting:
- Default: 300s
- Maximum: 3600s

---

## 🛠️ Technologies

### Core APIs
- **[@google/genai](https://www.npmjs.com/package/@google/genai)** - Gemini SDK for script and image generation
- **[@cartesia/cartesia-js](https://www.npmjs.com/package/@cartesia/cartesia-js)** - Cartesia TTS for voice synthesis

### Cloud & Storage
- **[@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage)** - Google Cloud Storage SDK

### Media Processing
- **[fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg)** - FFmpeg wrapper for video encoding
- **[ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static)** - Static FFmpeg binary

### Server & Utilities
- **[express](https://www.npmjs.com/package/express)** - Web server framework
- **[axios](https://www.npmjs.com/package/axios)** - HTTP client
- **[dotenv](https://www.npmjs.com/package/dotenv)** - Environment configuration

---

## 💡 YouTube Metadata

Each generated video includes SEO-optimized YouTube metadata:

- **Title** - Viral, clickbait-style title (max 60 chars)
- **Description** - SEO-optimized description with keywords and hashtags (100-150 words)
- **Tags** - 10-15 high-volume search tags
- **Thumbnail Prompts** - 2 different high-CTR thumbnail concepts

Access this metadata in the final SSE `complete` event response.

---

## 🐛 Troubleshooting

### Build Fails with "npm ci" Error
**Solution**: Ensure `package-lock.json` is NOT in `.gcloudignore`. The Docker build requires this file.

### Audio Not Generated
**Solution**: Check that `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID` are correctly set in `.env`.

### Images Are Placeholders
**Cause**: Gemini 2.5 Flash Image may occasionally fail due to rate limits or content policy.
**Behavior**: The system retries 3 times before using a placeholder image.

### Video Generation Timeout
**Solution**: For longer videos (>90 seconds), increase the Cloud Run timeout setting (default: 300s, max: 3600s).

### Server Won't Start
**Solution**: 
1. Verify Node.js version: `node --version` (must be >=18.0.0)
2. Check `.env` file exists with required API keys
3. Run `npm install` to ensure all dependencies are installed

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Ways to Contribute

- 🐛 Report bugs and issues
- 💡 Suggest new features or improvements
- 📝 Improve documentation
- 🔧 Submit bug fixes or enhancements
- ⭐ Star the repository to show support

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Attribution Requirement

If you use, modify, or distribute this software or substantial portions of it, you **must** provide clear attribution to the original developers:

> "Based on AI Video Service by Hykvra Solutions LLP"

or

> "Original work by Hykvra Solutions LLP - Created by Raj Hussain Kanani"

or

> "Developed by Hykvra Solutions LLP (https://github.com/rajhussainkanani)"

This attribution should appear in your project's README, documentation, or about section in a visible location.

---

## 👨‍💻 Author

**Hykvra Solutions LLP**

Created by: Raj Hussain Kanani

- GitHub: [@rajhussainkanani](https://github.com/rajhussainkanani)
- Company: Hykvra Solutions LLP
- Year: 2026

---

## 🙏 Acknowledgments

- **Google Gemini** - For powerful AI models that make script and image generation possible
- **Cartesia** - For natural-sounding multilingual text-to-speech
- **FFmpeg** - For robust video processing capabilities
- **Open Source Community** - For the amazing tools and libraries that power this project

---

## 📞 Support

If you encounter any issues or have questions:

- 📋 [Create an issue](https://github.com/rajhussainkanani/ai-video-service/issues)
- 💬 Check existing [discussions](https://github.com/rajhussainkanani/ai-video-service/discussions)
- 📖 Review the [documentation](#-api-documentation)

---

<div align="center">

**Made with ❤️ by Hykvra Solutions LLP**

Developed by Raj Hussain Kanani

If you find this project useful, please consider giving it a ⭐!

</div>
