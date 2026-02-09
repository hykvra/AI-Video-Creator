/**
 * AI Video Service - Main Server
 * 
 * AI-powered video generation service with multilingual narration, automated script writing,
 * AI-generated visuals, and YouTube optimization.
 * 
 * @author Hykvra Solutions LLP (Raj Hussain Kanani)
 * @license MIT
 * @copyright 2026 Hykvra Solutions LLP
 * 
 * Attribution Required: If you use, modify, or distribute this software or substantial portions
 * of it, you must provide clear attribution to the original developers:
 * "Based on AI Video Service by Hykvra Solutions LLP" or
 * "Original work by Hykvra Solutions LLP - Created by Raj Hussain Kanani"
 */

import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { CartesiaClient } from '@cartesia/cartesia-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// Configure FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Load environment variables
dotenv.config();

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
app.use(express.json());

// Serve static files from output directory
app.use('/output', express.static(path.join(__dirname, 'output')));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google Generative AI (Gemini API)
const googleAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize Cartesia client (optional - won't crash if API key missing)
let cartesia = null;
if (process.env.CARTESIA_API_KEY) {
    cartesia = new CartesiaClient({
        apiKey: process.env.CARTESIA_API_KEY
    });
    console.log('Cartesia client initialized');
}

// Ensured directories exist



// Ensure directories exist
const TEMP_DIR = path.join(__dirname, 'temp');
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Store active SSE connections
const activeConnections = new Map();

/**
 * Send progress update to SSE client via Server-Sent Events
 * 
 * @param {string} sessionId - Unique session identifier for the video creation process
 * @param {Object} data - Progress data object
 * @param {string} data.step - Current step name (e.g., 'script', 'images', 'audio', 'video', 'complete')
 * @param {string} data.status - Status of the step ('in_progress', 'completed', 'error')
 * @param {string} data.message - Human-readable progress message
 * @param {number} [data.sceneIndex] - Optional current scene index (0-based)
 * @param {number} [data.totalScenes] - Optional total number of scenes
 * @returns {void}
 * 
 * @example
 * sendProgress('abc123', {
 *   step: 'images',
 *   status: 'in_progress',
 *   message: 'Generating scene 2 of 5',
 *   sceneIndex: 1,
 *   totalScenes: 5
 * });
 */
function sendProgress(sessionId, data) {
    const connection = activeConnections.get(sessionId);
    if (connection) {
        connection.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    console.log(`[Progress] ${data.step}: ${data.message}`);
}

/**
 * Generate video script using Gemini AI
 * @param {string} topic - The topic for the video
 * @param {number} targetDuration - Target video duration in seconds
 * @param {string} genre - Video genre/style
 * @param {string} comedyLevel - Comedy intensity level (mild/medium/spicy)
 * @param {string} language - Script language (gujarati/hindi/english)
 */
async function generateScript(topic, targetDuration = 60, genre = 'informative', comedyLevel = 'mild', language = 'gujarati') {
    // Fixed 3 scenes for didyouknow, otherwise calculate based on duration
    const avgSceneDuration = 15;
    const numScenes = genre === 'didyouknow' ? 3 : Math.max(3, Math.min(15, Math.round(targetDuration / avgSceneDuration)));

    // Language configurations
    const languageConfigs = {
        gujarati: {
            name: 'Gujarati',
            fieldName: 'audio_script_gujarati',
            samplePhrases: {
                comedy: '"તમે જાણો છો શું થાય છે...", "મને યાદ છે એકવાર...", "સૌથી મજાની વાત તો એ છે કે..."',
                storytelling: '"એક વખત...", "અને પછી...", "અચાનક..."',
                motivational: '"તમે કરી શકો છો!", "યાદ રાખો...", "સફળતા તમારી રાહ જુએ છે!"'
            }
        },
        hindi: {
            name: 'Hindi',
            fieldName: 'audio_script_hindi',
            samplePhrases: {
                comedy: '"आप जानते हैं क्या होता है...", "मुझे याद है एक बार...", "सबसे मजेदार बात तो यह है कि..."',
                storytelling: '"एक बार...", "और फिर...", "अचानक..."',
                motivational: '"आप कर सकते हैं!", "याद रखें...", "सफलता आपकी प्रतीक्षा कर रही है!"'
            }
        },
        english: {
            name: 'English',
            fieldName: 'audio_script_english',
            samplePhrases: {
                comedy: '"You know what happens...", "I remember once...", "The funniest part is..."',
                storytelling: '"Once upon a time...", "And then...", "Suddenly..."',
                motivational: '"You can do this!", "Remember...", "Success awaits you!"'
            }
        }
    };

    const langConfig = languageConfigs[language] || languageConfigs.gujarati;

    // Comedy level configurations
    const comedyLevels = {
        mild: {
            style: 'light and family-friendly humor',
            imageStyle: 'colorful, cheerful cartoon-style illustrations with friendly expressions',
            scriptStyle: 'gentle stand-up comedy style monologue with light jokes and wholesome observations. Family-friendly content',
            intensity: 'MILD COMEDY: Keep jokes light, wholesome, and suitable for all ages. Use gentle humor, puns, and playful observations'
        },
        medium: {
            style: 'edgy and relatable adult humor',
            imageStyle: 'colorful, exaggerated cartoon-style illustrations with expressive and slightly mischievous expressions',
            scriptStyle: 'confident stand-up comedy monologue with sarcasm, irony, and relatable adult situations. More edge than mild',
            intensity: 'MEDIUM COMEDY: Use sarcasm, irony, and relatable adult humor. Include unexpected twists and clever wordplay. More edgy than mild but still appropriate'
        },
        spicy: {
            style: 'bold, unexpected, and maximum comedic impact',
            imageStyle: 'wild, exaggerated cartoon-style illustrations with extreme expressions and absurd situations',
            scriptStyle: 'high-energy stand-up comedy monologue with bold observations, shocking twists, and maximum comedic timing. Push boundaries while remaining tasteful',
            intensity: 'SPICY COMEDY: GO ALL OUT! Use bold humor, shocking punchlines, absurd scenarios, and unexpected twists. Maximum comedic impact. Be daring and edgy while staying tasteful'
        }
    };

    // Genre-specific prompt instructions - ALL USE MONOLOGUE STYLE (single voice)
    const genrePrompts = {
        informative: {
            style: 'educational and informative',
            imageStyle: 'clean, professional visuals with infographic elements',
            scriptStyle: 'clear, factual monologue narration that explains the topic engagingly'
        },
        comedy: comedyLevels[comedyLevel] || comedyLevels.mild,
        storytelling: {
            style: 'narrative and story-driven',
            imageStyle: 'cinematic, dramatic visuals that tell a visual story',
            scriptStyle: 'engaging narrator telling a story, describing scenes and emotions. Third-person or first-person narrative style'
        },
        motivational: {
            style: 'inspiring and motivational',
            imageStyle: 'uplifting, powerful imagery with warm colors and inspiring scenes',
            scriptStyle: 'powerful monologue with encouraging and empowering language that motivates and inspires'
        },
        didyouknow: {
            style: 'surprising facts and revelations',
            imageStyle: 'eye-catching, dramatic visuals with bold colors, question marks, surprise elements, and historical/factual imagery',
            scriptStyle: 'engaging hook that grabs attention with a surprising question, followed by fascinating reveal and explanation. Build curiosity then deliver the wow factor.'
        }
    };

    const genreConfig = genrePrompts[genre] || genrePrompts.informative;

    // Helper to generate content with retry and fallback
    // Helper to generate content with retry and fallback
    const generateWithRetry = async (promptText) => {
        const models = [
            process.env.GEMINI_SCRIPT_MODEL || "gemini-2.5-pro"
        ];

        for (const modelName of models) {
            console.log(`Trying script generation with model: ${modelName}`);
            try {
                // New SDK usage
                const response = await googleAI.models.generateContent({
                    model: modelName,
                    contents: promptText,
                    config: { responseMimeType: "application/json" }
                });
                return response;
            } catch (error) {
                console.warn(`Model ${modelName} failed: ${error.message}`);

                // If 503 or overload, continue to next model.
                if (modelName === models[models.length - 1]) throw error; // Throw if last model fails
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
            }
        }
    };

    const prompt = `You are a professional CINEMATIC video scriptwriter specializing in ${genreConfig.style} content.

Create a compelling ${genre.toUpperCase()} video script for: "${topic}"

Generate exactly ${numScenes} scenes for a ${targetDuration}-second video (9:16 aspect ratio, mobile-first).
Each scene MUST have EXACTLY 3 image_prompts (no more, no less).
Each scene should have roughly ${avgSceneDuration} seconds of narration.

CRITICAL REQUIREMENT - MALE NARRATOR MONOLOGUE:
- All scripts must be written as MONOLOGUE (single MALE narrator voice)
- NO dialogues, NO conversations, NO multiple character voices
- Write as if ONE MAN is narrating/telling the story/presenting
- This will be read by a male text-to-speech voice

LANGUAGE: Write ALL narration scripts in ${langConfig.name} language.
- CRITICAL: Use NATIVE SCRIPT only (e.g., Devanagari for Hindi).
- DO NOT use Hinglish or Romanized ${langConfig.name} (except for the required English numbers/years below).

CRITICAL: ENGLISH NUMBERS & YEARS - SPELLED OUT
- ALWAYS write years, dates, and all numbers using English words (e.g., "nineteen forty-seven" instead of 1947).
- This is the ONLY way to force the Multilingual V2 model to pronounce them in ENGLISH within a ${langConfig.name} script.
- DO NOT use Arabic numerals (e.g., 2025) or native language numerals.
- Spell out EVERY SINGLE number in English words within the narration text.
- STRICT FORMAT EXAMPLE: "नमस्ते! भारत nineteen forty-seven में आज़ाद हुआ था। आज की आबादी one point four billion से ज़्यादा है।"

STYLE REQUIREMENTS:
- Visual Style: ${genreConfig.imageStyle}
- Script Style: ${genreConfig.scriptStyle}
- Voice Persona: Warm, expressive male narrator. Use natural pacing, varied sentence lengths, and subtle emotional nuance.
- V2 Optimization: Write the script to be read naturally. Use punctuation (commas, periods) to guide the rhythm.

MULTIPLE IMAGE PROMPTS - CRITICAL:
Each scene needs 2-3 image prompts that show DIFFERENT MOMENTS in the narrative progression.
- Break down the scene's story into 2-3 distinct visual moments
- Each image should capture a different part of what's happening
- Images should flow naturally like a storyboard

EXAMPLE: If script says "The car was speeding on the highway and suddenly a bike appeared in front"
- image_prompts[0]: "A sleek car speeding down a highway at high speed, motion blur, dramatic lighting"
- image_prompts[1]: "A motorcycle suddenly appearing in front of a car on the highway, dangerous moment, dramatic angle"

For each scene:
1. image_prompts: Array of 2-3 detailed English image prompts showing different narrative moments. Use ${genreConfig.imageStyle}. Include a friendly male presenter/narrator in the visuals where appropriate.
2. ${langConfig.fieldName}: ${langConfig.name} MONOLOGUE narration (~${avgSceneDuration} seconds when spoken). Write expressively with natural emotion and pacing. Single male narrator voice! Focus on storytelling and engagement.

${genre === 'comedy' ? genreConfig.intensity + `\n\nCOMEDY STYLE: Write like a male stand-up comedian telling jokes and funny observations in ${langConfig.name}. Use phrases like ${langConfig.samplePhrases.comedy}. Make observations about daily life, relationships, or the topic in a humorous way.` : ''}
${genre === 'storytelling' ? `STORYTELLING STYLE: Narrate like a male storyteller in ${langConfig.name}. Use ${langConfig.samplePhrases.storytelling}. Create vivid descriptions and emotional moments.` : ''}
${genre === 'motivational' ? `MOTIVATIONAL STYLE: Use powerful, uplifting language in ${langConfig.name}. Include phrases like ${langConfig.samplePhrases.motivational}.` : ''}
${genre === 'didyouknow' ? `DID YOU KNOW STYLE - CRITICAL STRUCTURE:
This is a "Did You Know" fact video. The topic contains a HOOK and a FACT. Structure the scenes like this:

SCENE 1 - THE HOOK (Grab attention):
- Start with the surprising question/statement from the HOOK
- Make it dramatic and attention-grabbing
- Create curiosity - make viewers want to know more
- Image should be dramatic with question marks or surprise elements
- DO NOT include any subscribe/CTA content here

SCENE 2 - THE REVEAL (Drop the bomb):
- Reveal the main surprising fact
- Confirm the hook with "Yes, it's true!" energy
- Image should show the key fact visually
- DO NOT include any subscribe/CTA content here

SCENE 3-4 - THE DETAILS (Explain and expand):
- Provide interesting details and context
- Add more fascinating related facts
- Make it educational yet entertaining
- Images should illustrate the historical/factual context
- DO NOT include any subscribe/CTA content here

FINAL SCENE ONLY - THE CTA (Call to Action):
- ONLY the very last scene should have subscribe/CTA content in the AUDIO SCRIPT
- End with: "Subscribe for more facts from US!" or similar subscribe appeal in ${langConfig.name}
- Make it engaging: "Agar aapko ye fact pasand aaya, toh subscribe karo for more!"
- Keep the audio CTA short and punchy (3-5 seconds)

CRITICAL WARNING - IMAGE PROMPTS FOR ALL SCENES:
- DO NOT generate subscribe buttons, CTA text, "Subscribe" imagery, or channel-related visuals in ANY scene image_prompts
- ALL scenes (including the final scene) must have image_prompts focused ONLY on the topic/fact content
- The subscribe image will be AUTOMATICALLY displayed in the last 5 seconds by the system
- For final scene images: show relevant topic visuals, historical imagery, or fact illustrations that match the narration
- Example: If final scene talks about space while saying "subscribe", images should show SPACE content, NOT subscribe buttons

Use phrases like:
- "Kya aapko pata hai..." / "Did you know..."
- "Haan, sach mein!" / "Yes, really!"
- "Sochiye zara..." / "Just imagine..."
- "Subscribe karo!" / "Subscribe for more!" (IN AUDIO ONLY, NOT IN IMAGE PROMPTS)` : ''}

Make the content highly engaging and perfect for social media. Use the capabilities of the eleven_multilingual_v2 model to deliver a high-quality human-like narration.

DID YOU KNOW STYLE:
- Keep it conversational and engaging, like you're sharing an amazing fact with a friend
- Use expressions of surprise and curiosity: "Believe it or not!", "Can you imagine?", "It's incredible!"
- Make the viewer feel like they're learning something mind-blowing
- End with energy and excitement, encouraging them to subscribe

VIDEO TITLE (SLUG FORMAT):
- Generate a URL-friendly video slug in English (max 40 characters)
- MUST be lowercase, use hyphens instead of spaces, NO special characters
- Only use letters (a-z), numbers (0-9), and hyphens (-)
- Examples: "the-midnight-mystery", "indias-forgotten-secret", "truth-about-potatoes"
- DO NOT use apostrophes, quotes, colons, or any other special characters

IMPORTANT: Return a JSON object with:
1. "video_title": A slug-format English title (lowercase, hyphens, max 40 chars, e.g., "the-secret-forest")
2. "scenes": Array of exactly ${numScenes} scenes, each with: scene_number, image_prompts (array of EXACTLY 3 prompts), and ${langConfig.fieldName}.
3. "youtube_metadata": {
    "title": "Viral YouTube Short Title (Clickbait/Hook style, max 60 chars)",
    "description": "SEO-optimized YouTube Short description (100-150 words) including keywords and hashtags.",
    "tags": ["tag1", "tag2", ... 10-15 high volume tags],
    "thumbnail_prompts": [
        "Description for high-CTR thumbnail 1 (visual, dramatic, clickable)",
        "Description for high-CTR thumbnail 2 (different angle/concept)"
    ]
}

CRITICAL - IMAGE PROMPT RULES:
- Each image prompt must be a LITERAL VISUAL REPRESENTATION of the specific sentence it accompanies.
- If the script says "lions hunt at night", the image MUST show a lion hunting at night.
- If the script mentions a specific year or location, the image MUST reflect that era or place.
- Do NOT use abstract concepts. Be descriptive and concrete.
- Keep prompts English, detailed, and photorealistic.

CRITICAL: Keep the JSON response complete and valid. Do not truncate.`;

    const result = await generateWithRetry(prompt);
    // New SDK returns text directly or via .text property
    const text = result.text;

    console.log("Gemini response text (first 500 chars):", text.substring(0, 500));
    console.log("Response length:", text.length);

    // Function to attempt JSON repair for truncated responses
    function tryRepairJSON(jsonStr) {
        let repaired = jsonStr.trim();

        // Remove trailing commas before closing brackets/braces
        repaired = repaired.replace(/,\s*$/, '');
        repaired = repaired.replace(/,\s*]/g, ']');
        repaired = repaired.replace(/,\s*}/g, '}');

        // Count open/close brackets and braces
        let openBraces = (repaired.match(/{/g) || []).length;
        let closeBraces = (repaired.match(/}/g) || []).length;
        let openBrackets = (repaired.match(/\[/g) || []).length;
        let closeBrackets = (repaired.match(/\]/g) || []).length;

        // If truncated mid-string, close the string
        const quoteCount = (repaired.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            repaired += '"';
        }

        // If truncated mid-array element, remove incomplete element
        // Check if last non-whitespace char indicates incomplete element
        const trimmed = repaired.trimEnd();
        const lastChar = trimmed.slice(-1);
        if (lastChar === ',' || lastChar === ':') {
            // Remove the incomplete part after last complete element
            repaired = repaired.replace(/,\s*"[^"]*$/, '');
            repaired = repaired.replace(/:\s*"[^"]*$/, ': ""');
        }

        // Close arrays and objects in correct order
        while (openBrackets > closeBrackets) {
            repaired += ']';
            closeBrackets++;
        }
        while (openBraces > closeBraces) {
            repaired += '}';
            closeBraces++;
        }

        return repaired;
    }

    try {
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(text);
        } catch (firstError) {
            console.log("First JSON parse failed, attempting repair...");
            const repairedText = tryRepairJSON(text);
            console.log("Repaired JSON (last 200 chars):", repairedText.slice(-200));
            jsonResponse = JSON.parse(repairedText);
            console.log("JSON repair successful!");
        }

        // Extract video title
        const videoTitle = jsonResponse.video_title || 'untitled-video';
        console.log('Video Title:', videoTitle);
        console.log('DEBUG: Full JSON Keys:', Object.keys(jsonResponse));
        console.log('DEBUG: youtube_metadata present?:', !!jsonResponse.youtube_metadata);
        console.log('DEBUG: YouTube Metadata content:', JSON.stringify(jsonResponse.youtube_metadata, null, 2));

        // Handle both { scenes: [...] } and direct array response
        let scenes;
        if (Array.isArray(jsonResponse)) {
            scenes = jsonResponse;
        } else if (jsonResponse.scenes) {
            scenes = jsonResponse.scenes;
        } else {
            console.error("Unexpected JSON structure:", Object.keys(jsonResponse));
            throw new Error("Invalid response structure from Gemini");
        }

        // Return both title and scenes
        return { videoTitle, scenes, youtube_metadata: jsonResponse.youtube_metadata };
    } catch (parseError) {
        console.error("JSON parse error:", parseError.message);
        console.error("Raw response:", text.substring(0, 1000));
        throw parseError;
    }
}



/**
 * Create a placeholder image using pure Node.js (no FFmpeg lavfi)
 * 
 * Used as a fallback when Gemini image generation fails after retries.
 * Creates a minimal 1x1 pixel dark purple PNG placeholder.
 * 
 * @param {string} outputPath - Absolute file path where the placeholder image should be saved
 * @returns {Promise<string>} Promise that resolves to the output path when complete
 * @throws {Error} If file write operation fails
 * 
 * @example
 * await createPlaceholderImage('/path/to/placeholder.png');
 */
function createPlaceholderImage(outputPath) {
    return new Promise((resolve, reject) => {
        try {
            // Create a simple 720x1280 PNG placeholder with a solid color
            // This is a minimal PNG file with a dark color
            const width = 720;
            const height = 1280;

            // PNG header + IHDR + IDAT (compressed data) + IEND
            // Using a pre-generated minimal dark purple PNG as base64
            const darkPurplePNG = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'base64'
            );

            fs.writeFileSync(outputPath, darkPurplePNG);
            console.log(`Created placeholder image: ${outputPath}`);
            resolve(outputPath);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate image using Gemini 2.5 Flash Image (via @google/genai SDK)
 * 
 * Generates a 9:16 vertical aspect ratio image optimized for mobile viewing.
 * Implements retry logic with exponential backoff. Falls back to placeholder on failure.
 * 
 * @param {string} prompt - Detailed English image prompt describing the desired visual
 * @param {string} outputPath - Absolute file path where the generated image should be saved
 * @param {number} [retries=3] - Maximum number of retry attempts if generation fails
 * @returns {Promise<string>} Promise that resolves to the output path when complete
 * 
 * @example
 * const imagePath = await generateImage(
 *   'A beautiful sunset over mountains in 9:16 aspect ratio',
 *   '/tmp/scene1.png',
 *   3
 * );
 */
async function generateImage(prompt, outputPath, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Gemini Image attempt ${attempt}/${retries}...`);

            const response = await googleAI.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: `High quality, detailed, professional image in 9:16 vertical aspect ratio for mobile viewing. Vibrant colors, engaging composition. ${prompt}`,
            });

            // Parse response for image data
            let imageSaved = false;

            if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const imageData = part.inlineData.data;
                        const buffer = Buffer.from(imageData, "base64");
                        fs.writeFileSync(outputPath, buffer);
                        console.log(`✓ Image saved: ${outputPath}`);
                        imageSaved = true;
                        return outputPath;
                    }
                }
            }

            if (!imageSaved) {
                throw new Error('No image inlineData in Gemini response');
            }

        } catch (error) {
            console.error(`Gemini Image attempt ${attempt} failed:`, error.message);

            if (error.response) {
                // Log fuller error if available
                console.error('Failure details:', JSON.stringify(error.response, null, 2));
            }

            if (attempt < retries) {
                const waitTime = attempt * 2000;
                console.log(`Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            // Final fallback: placeholder image
            console.log('Using placeholder image...');
            await createPlaceholderImage(outputPath);
            return outputPath;
        }
    }
}

/**
 * Generate audio using Cartesia TTS API with retry logic
 * 
 * Synthesizes natural-sounding speech using Cartesia Sonic-3 TTS model.
 * Supports multilingual narration (Gujarati, Hindi, English) with the configured voice.
 * Implements retry logic with 2-second delays between attempts.
 * 
 * @param {string} text - Text to synthesize into speech (in any supported language)
 * @param {string} outputPath - Absolute file path where the audio WAV file should be saved
 * @param {number} [retries=3] - Maximum number of retry attempts if synthesis fails
 * @returns {Promise<string>} Promise that resolves to the output path when complete
 * @throws {Error} If all retry attempts fail (no fallback for audio)
 * 
 * @example
 * const audioPath = await generateAudio(
 *   'નમસ્તે! આ એક ટેસ્ટ છે।',
 *   '/tmp/narration.wav',
 *   3
 * );
 */
async function generateAudio(text, outputPath, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Cartesia TTS attempt ${attempt}/${retries}...`);
            console.log(`Text to synthesize: "${text}"`);

            // Check if Cartesia is initialized
            if (!cartesia) {
                throw new Error('Cartesia client not initialized');
            }

            // Use configured voice ID or default to a Hindi narrator voice
            const voiceId = process.env.CARTESIA_VOICE_ID || 'a0e99841-438c-4a64-b679-ae501e7d6091';

            let result = await cartesia.tts.bytes({
                modelId: "sonic-3",
                voice: {
                    mode: "id",
                    id: voiceId,
                },
                transcript: text,
                outputFormat: {
                    container: "wav",
                    encoding: "pcm_f32le",
                    sampleRate: 44100
                }
            });

            // Handle various return types (Buffer, ArrayBuffer, Stream/AsyncIterable)
            let buffer;
            if (result instanceof Buffer || result instanceof Uint8Array) {
                buffer = result;
            } else if (result && typeof result.arrayBuffer === 'function') {
                // It might be a Response-like object
                buffer = Buffer.from(await result.arrayBuffer());
            } else {
                // Assume it's an async iterable (Stream)
                const chunks = [];
                for await (const chunk of result) {
                    chunks.push(Buffer.from(chunk));
                }
                buffer = Buffer.concat(chunks);
            }

            // Write buffer to file
            fs.writeFileSync(outputPath, buffer);
            return outputPath;
        } catch (error) {
            console.error(`Cartesia TTS attempt ${attempt} failed:`, error.message);

            if (attempt < retries) {
                console.log(`Retrying in 2 seconds...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            throw error; // No fallback for audio, must succeed
        }
    }
}

/**
 * Get audio duration using ffprobe
 * 
 * Uses FFmpeg's ffprobe to extract the exact duration of an audio file.
 * 
 * @param {string} audioPath - Absolute path to the audio file
 * @returns {Promise<number>} Promise that resolves to duration in seconds (float)
 * @throws {Error} If ffprobe fails to read the file or extract metadata
 * 
 * @example
 * const duration = await getAudioDuration('/tmp/narration.wav');
 * console.log(`Audio is ${duration.toFixed(2)} seconds long`);
 */
function getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(metadata.format.duration);
        });
    });
}

/**
 * Add silence to the beginning of an audio file using adelay filter
 * 
 * Uses FFmpeg's adelay audio filter to add a delay (silence) at the start of an audio file.
 * This is useful for synchronizing audio with video or adding pauses.
 * 
 * @param {string} inputPath - Absolute path to the input audio file
 * @param {number} durationSeconds - Duration of silence to add in seconds
 * @returns {Promise<string>} Promise that resolves to the modified input path
 * 
 * @example
 * await addSilenceToAudio('/tmp/narration.wav', 2.0); // Adds 2 seconds of silence
 */
function addSilenceToAudio(inputPath, durationSeconds) {
    return new Promise((resolve, reject) => {
        const outputPath = inputPath.replace('.mp3', '_delayed.mp3');

        // adelay filter adds delay to audio channels
        // format: delay_ms|delay_ms (for stereo)
        const delayMs = durationSeconds * 1000;

        ffmpeg(inputPath)
            .audioFilters(`adelay=${delayMs}|${delayMs}`)
            .save(outputPath)
            .on('end', () => {
                // Replace original file with delayed version
                fs.renameSync(outputPath, inputPath);
                console.log(`Added ${durationSeconds}s silence to: ${inputPath}`);
                resolve(inputPath);
            })
            .on('error', (err) => {
                console.error(`Error adding silence: ${err.message}`);
                reject(err);
            });
    });
}

/**
 * Create video clip from image and audio with Ken Burns effect
 * 
 * Generates a video clip by combining a static image with audio narration.
 * Applies Ken Burns effect (smooth zoom and pan animation) for visual interest.
 * Alternates between zoom-in and zoom-out based on scene index.
 * 
 * @param {string} imagePath - Absolute path to the source image file
 * @param {string} audioPath - Absolute path to the audio narration file
 * @param {string} outputPath - Absolute path for the output video file
 * @param {number} duration - Duration of the video clip in seconds
 * @param {number} sceneIndex - Index of the scene (0-based, used to vary animation direction)
 * @returns {Promise<string>} Promise that resolves to the output path when encoding completes
 * @throws {Error} If FFmpeg encoding fails
 * 
 * @example
 * await createVideoClip(
 *   '/tmp/scene1.png',
 *   '/tmp/audio1.wav',
 *   '/tmp/clip1.mp4',
 *   15.5,
 *   0
 * );
 */
function createVideoClip(imagePath, audioPath, outputPath, duration, sceneIndex) {
    return new Promise((resolve, reject) => {
        const videoDuration = (parseFloat(duration) + 0.5).toFixed(2);
        const fps = 24;  // Reduced from 30 for faster encoding
        const totalFrames = Math.ceil(videoDuration * fps);

        // Ken Burns effect parameters - alternate between zoom-in and zoom-out
        // Start with slight zoom out (1.15) and zoom in to 1.0, or vice versa
        const isZoomIn = sceneIndex % 2 === 0;
        const startZoom = isZoomIn ? 1.0 : 1.15;
        const endZoom = isZoomIn ? 1.15 : 1.0;

        // Random pan direction
        const panDirections = [
            { startX: '0', startY: '0', endX: '(iw-ow)', endY: '(ih-oh)' },  // top-left to bottom-right
            { startX: '(iw-ow)', startY: '0', endX: '0', endY: '(ih-oh)' },  // top-right to bottom-left
            { startX: '0', startY: '(ih-oh)', endX: '(iw-ow)', endY: '0' },  // bottom-left to top-right
            { startX: '(iw-ow)/2', startY: '0', endX: '(iw-ow)/2', endY: '(ih-oh)' },  // top to bottom center
        ];
        const pan = panDirections[sceneIndex % panDirections.length];

        // Ken Burns filter: scale up image, then use zoompan for smooth zoom/pan
        // Reduced scale from 8000 to 3000 for much faster processing
        const kenBurnsFilter = [
            `scale=3000:-1`,
            `zoompan=z='${startZoom}+(${endZoom}-${startZoom})*(on/${totalFrames})':x='${pan.startX}+(${pan.endX}-(${pan.startX}))*(on/${totalFrames})':y='${pan.startY}+(${pan.endY}-(${pan.startY}))*(on/${totalFrames})':d=${totalFrames}:s=720x1280:fps=${fps}`,
            `format=yuv420p`
        ].join(',');

        ffmpeg()
            .input(imagePath)
            .input(audioPath)
            .outputOptions([
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-c:v', 'libx264',
                '-preset', 'veryfast',  // Changed from 'fast' for much faster encoding
                '-crf', '23',  // Slightly lower quality for speed, still good
                '-c:a', 'aac',
                '-b:a', '192k',  // Higher quality audio
                '-ar', '44100',
                '-threads', '0',
                '-ac', '2',
                '-t', videoDuration,
                '-vf', kenBurnsFilter
            ])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .run();
    });
}
/**
 * Create video clip from image and audio segment with Ken Burns effect
 * 
 * Similar to createVideoClip but extracts a specific segment from a longer audio file.
 * Uses precise audio seeking to avoid synchronization issues.
 * Applies Ken Burns effect alternating between zoom directions based on clip index.
 * 
 * @param {string} imagePath - Absolute path to the source image file
 * @param {string} audioPath - Absolute path to the full audio file
 * @param {string} outputPath - Absolute path for the output video clip
 * @param {number} startTime - Start time in seconds within the audio file
 * @param {number} duration - Duration of the clip in seconds
 * @param {number} clipIndex - Index of the clip (0-based, used to vary animation)
 * @returns {Promise<string>} Promise that resolves to the output path when complete
 * @throws {Error} If FFmpeg encoding fails
 * 
 * @example
 * await createVideoClipWithAudioSegment(
 *   '/tmp/scene2.png',
 *   '/tmp/full_audio.wav',
 *   '/tmp/clip2.mp4',
 *   15.0,    // Start at 15 seconds
 *   12.5,    // 12.5 second duration
 *   1
 * );
 */
function createVideoClipWithAudioSegment(imagePath, audioPath, outputPath, startTime, duration, clipIndex) {
    return new Promise((resolve, reject) => {
        // Use exact duration without buffer to prevent overlap
        const exactDuration = parseFloat(duration).toFixed(3);
        const fps = 24;  // Reduced from 30 for faster encoding
        const totalFrames = Math.ceil(duration * fps);

        // Ken Burns effect - alternate directions
        const isZoomIn = clipIndex % 2 === 0;
        const startZoom = isZoomIn ? 1.0 : 1.10;
        const endZoom = isZoomIn ? 1.10 : 1.0;

        const panDirections = [
            { startX: '0', startY: '0', endX: '(iw-ow)', endY: '(ih-oh)' },
            { startX: '(iw-ow)', startY: '0', endX: '0', endY: '(ih-oh)' },
            { startX: '0', startY: '(ih-oh)', endX: '(iw-ow)', endY: '0' },
            { startX: '(iw-ow)/2', startY: '0', endX: '(iw-ow)/2', endY: '(ih-oh)' },
        ];
        const pan = panDirections[clipIndex % panDirections.length];

        // Reduced scale from 8000 to 3000 for much faster processing
        const kenBurnsFilter = [
            `scale=3000:-1`,
            `zoompan=z='${startZoom}+(${endZoom}-${startZoom})*(on/${totalFrames})':x='${pan.startX}+(${pan.endX}-(${pan.startX}))*(on/${totalFrames})':y='${pan.startY}+(${pan.endY}-(${pan.startY}))*(on/${totalFrames})':d=${totalFrames}:s=720x1280:fps=${fps}`,
            `format=yuv420p`
        ].join(',');

        // Build ffmpeg command with proper input seeking
        const cmd = ffmpeg();

        // Image input (no seeking needed)
        cmd.input(imagePath);

        // Audio input with seek BEFORE the input for accurate positioning
        cmd.input(audioPath)
            .seekInput(startTime);  // -ss before input for accurate seek

        cmd.outputOptions([
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-c:v', 'libx264',
            '-preset', 'veryfast',  // Changed from 'fast' for much faster encoding
            '-crf', '23',
            '-threads', '0',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '44100',
            '-ac', '2',
            '-t', exactDuration,  // Exact duration for both video and audio
            '-vf', kenBurnsFilter,
            '-async', '1'  // Audio sync correction
        ])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .run();
    });
}

/**
 * Concatenate video clips with crossfade transitions
 * 
 * Combines multiple video clips into a single video file.
 * For multiple clips, uses FFmpeg's concat demuxer for reliability.
 * Handles single clip case by simple file copy.
 * 
 * @param {string[]} clipPaths - Array of absolute paths to video clip files to concatenate
 * @param {string} outputPath - Absolute path for the final concatenated video
 * @returns {Promise<string>} Promise that resolves to the output path when complete
 * @throws {Error} If no clips provided or FFmpeg concatenation fails
 * 
 * @example
 * await concatenateClips(
 *   ['/tmp/clip1.mp4', '/tmp/clip2.mp4', '/tmp/clip3.mp4'],
 *   '/tmp/final_video.mp4'
 * );
 */
function concatenateClips(clipPaths, outputPath) {
    return new Promise((resolve, reject) => {
        if (clipPaths.length === 0) {
            reject(new Error('No clips to concatenate'));
            return;
        }

        if (clipPaths.length === 1) {
            // Just copy the single clip
            fs.copyFileSync(clipPaths[0], outputPath);
            resolve(outputPath);
            return;
        }

        // For crossfade, we need to use xfade filter
        // This requires knowing each clip's duration and applying sequential fades
        const fadeDuration = 0.5; // 0.5 second crossfade

        // Build the complex filter for crossfade
        // We'll use xfade filter chaining
        const ffmpegCmd = ffmpeg();

        // Add all inputs
        clipPaths.forEach(clipPath => {
            ffmpegCmd.input(clipPath);
        });

        // Build xfade filter chain
        let filterComplex = '';
        let lastOutput = '[0:v]';
        let audioFilters = '';
        let lastAudioOutput = '[0:a]';

        for (let i = 1; i < clipPaths.length; i++) {
            const currentOutput = i === clipPaths.length - 1 ? '[outv]' : `[v${i}]`;
            const currentAudioOutput = i === clipPaths.length - 1 ? '[outa]' : `[a${i}]`;

            // Get approximate offset (we'll use a generic value since we don't know exact durations here)
            // The xfade offset is when the transition starts
            filterComplex += `${lastOutput}[${i}:v]xfade=transition=fade:duration=${fadeDuration}:offset=8${currentOutput};`;
            audioFilters += `${lastAudioOutput}[${i}:a]acrossfade=d=${fadeDuration}${currentAudioOutput};`;

            lastOutput = currentOutput;
            lastAudioOutput = currentAudioOutput;
        }

        // Remove trailing semicolon
        filterComplex = filterComplex.slice(0, -1);
        audioFilters = audioFilters.slice(0, -1);

        // For simplicity with variable durations, use concat filter with fade between
        // This is more reliable than xfade which needs exact timing
        const concatFilePath = path.join(TEMP_DIR, 'concat_list.txt');
        const fileList = clipPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(concatFilePath, fileList);

        ffmpeg()
            .input(concatFilePath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart'
            ])
            .output(outputPath)
            .on('end', () => {
                fs.unlinkSync(concatFilePath);
                resolve(outputPath);
            })
            .on('error', reject)
            .run();
    });
}

/**
 * Mix background music with video at low volume
 */
function mixBGMWithVideo(videoPath, bgmPath, outputPath, bgmVolume = 0.15) {
    return new Promise((resolve, reject) => {
        console.log(`Mixing BGM into video at ${bgmVolume * 100}% volume...`);

        ffmpeg()
            .input(videoPath)
            .input(bgmPath)
            .complexFilter([
                // Boost voice audio to 1.5x for better audibility
                `[0:a]volume=1.5[voice]`,
                // Loop BGM to match video duration and set volume
                `[1:a]aloop=loop=-1:size=2e+09,volume=${bgmVolume}[bgm]`,
                // Mix boosted voice with BGM, stop when video ends
                `[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`
            ])
            .outputOptions([
                '-map', '0:v',
                '-map', '[aout]',
                '-c:v', 'copy',  // Copy video stream, no re-encoding
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log('BGM mixed successfully');
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('BGM mixing failed:', err.message);
                // If mixing fails, just use the original video
                fs.copyFileSync(videoPath, outputPath);
                resolve(outputPath);
            })
            .run();
    });
}

/**
 * Clean up temporary files from disk
 * 
 * Safely deletes temporary files created during video generation process.
 * Ignores errors for files that don't exist or can't be deleted.
 * 
 * @param {string[]} filePaths - Array of absolute paths to temporary files to delete
 * @returns {void}
 * 
 * @example
 * cleanupTempFiles([
 *   '/tmp/scene1.png',
 *   '/tmp/audio1.wav',
 *   '/tmp/clip1.mp4'
 * ]);
 */
function cleanupTempFiles(filePaths) {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            console.error(`Failed to delete ${filePath}:`, err.message);
        }
    });
}

/**
 * SSE endpoint for live progress updates
 */
app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    activeConnections.set(sessionId, res);

    req.on('close', () => {
        activeConnections.delete(sessionId);
    });
});

/**
 * Main video creation endpoint with SSE progress
 */
// Store pending sessions for preview mode
const pendingSessions = new Map();

/**
 * Process scenes to generate assets and final video
 * (Extracted from create-video for preview functionality)
 */
async function processScenes(sessionId, scenes, videoTitle, selectedLanguage, youtubeMetadata) {
    console.log(`DEBUG: processScenes received metadata for ${sessionId}:`, JSON.stringify(youtubeMetadata, null, 2));
    const tempFiles = []; // Track temp files for this processing session

    try {
        // Sanitize video title
        const sanitizedTitle = videoTitle
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 40);

        // Step 2: Generate images
        const languageFieldMap = {
            'gujarati': 'audio_script_gujarati',
            'hindi': 'audio_script_hindi',
            'english': 'audio_script_english'
        };
        const audioFieldName = languageFieldMap[selectedLanguage] || 'audio_script_gujarati';

        // Collect all image prompts
        const allImagePrompts = [];
        const promptToSceneMap = [];

        for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
            const scene = scenes[sceneIdx];
            const availablePrompts = scene.image_prompts || [scene.image_prompt];

            for (let imgIdx = 0; imgIdx < availablePrompts.length; imgIdx++) {
                allImagePrompts.push(availablePrompts[imgIdx]);
                promptToSceneMap.push({ sceneIdx, imgIdx });
            }
        }

        const totalImages = allImagePrompts.length;

        sendProgress(sessionId, {
            step: 'image',
            status: 'in_progress',
            message: `Generating ${totalImages} images using Gemini API...`,
            sceneIndex: 0,
            totalScenes: scenes.length
        });

        const allImagePaths = [];
        for (let i = 0; i < allImagePrompts.length; i++) {
            const prompt = allImagePrompts[i];
            const sceneInfo = promptToSceneMap[i];
            const imagePath = path.join(TEMP_DIR, `${sessionId}_scene${sceneInfo.sceneIdx + 1}_img${sceneInfo.imgIdx + 1}.png`);

            // Generate all images normally - subscribe image will be added as a separate 5-second clip at the end

            console.log(`\n--- Generating image ${i + 1}/${totalImages} ---`);
            console.log(`Scene: ${sceneInfo.sceneIdx + 1}, Image: ${sceneInfo.imgIdx + 1}`);

            sendProgress(sessionId, {
                step: 'image',
                status: 'in_progress',
                message: `Scene ${sceneInfo.sceneIdx + 1} - Image ${sceneInfo.imgIdx + 1} of ${totalImages}...`,
                sceneIndex: sceneInfo.sceneIdx + 1,
                totalScenes: scenes.length
            });

            await generateImage(prompt, imagePath);
            allImagePaths.push(imagePath);
            tempFiles.push(imagePath);

            if (i < allImagePrompts.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // Organize images
        const sceneImageResults = [];
        let imageIndex = 0;

        for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
            const scene = scenes[sceneIdx];
            const imagesNeeded = (scene.image_prompts || [scene.image_prompt]).length;
            const sceneImages = [];
            for (let imgIdx = 0; imgIdx < imagesNeeded; imgIdx++) {
                sceneImages.push({
                    imagePath: allImagePaths[imageIndex],
                    promptIdx: imgIdx
                });
                imageIndex++;
            }
            sceneImageResults.push(sceneImages);
        }

        sendProgress(sessionId, {
            step: 'image',
            status: 'completed',
            message: `All ${totalImages} images generated successfully`,
            sceneIndex: scenes.length,
            totalScenes: scenes.length
        });

        // Step 3: Generate Audio
        sendProgress(sessionId, {
            step: 'audio',
            status: 'in_progress',
            message: `Generating ${scenes.length} voiceovers...`,
            sceneIndex: 0,
            totalScenes: scenes.length
        });

        const audioResults = [];
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const audioPath = path.join(TEMP_DIR, `${sessionId}_scene_${i + 1}.mp3`);
            const audioScript = scene[audioFieldName];

            console.log(`\n--- Generating audio for Scene ${i + 1} ---`);

            await generateAudio(audioScript, audioPath);

            if (i === 0) {
                await addSilenceToAudio(audioPath, 1);
            }

            tempFiles.push(audioPath);
            audioResults.push({ audioPath, index: i });
            await new Promise(r => setTimeout(r, 500));
        }

        const audioDurations = await Promise.all(
            audioResults.map(async ({ audioPath }) => getAudioDuration(audioPath))
        );

        sendProgress(sessionId, {
            step: 'audio',
            status: 'completed',
            message: `All ${scenes.length} voiceovers generated`,
            sceneIndex: scenes.length,
            totalScenes: scenes.length
        });

        // Step 4: Create Clips
        sendProgress(sessionId, {
            step: 'clip',
            status: 'in_progress',
            message: `Creating ${scenes.length} video clips...`,
            sceneIndex: 0,
            totalScenes: scenes.length
        });

        const clipPaths = [];
        const subscribeImagePath = path.join(__dirname, 'assest', 'subscribe_image.png');
        const hasSubscribeImage = fs.existsSync(subscribeImagePath);

        for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
            const audioPath = audioResults[sceneIdx].audioPath;
            const sceneDuration = audioDurations[sceneIdx];
            const sceneImages = sceneImageResults[sceneIdx];
            const numImages = sceneImages.length;
            const isLastScene = sceneIdx === scenes.length - 1;

            // For the last scene, use subscribe image for the last 5 seconds
            if (isLastScene && hasSubscribeImage && sceneDuration > 5) {
                console.log(`Last scene detected. Duration: ${sceneDuration}s. Splitting for subscribe image.`);
                const subClipPaths = [];

                // First part: original images for (duration - 5) seconds
                const firstPartDuration = sceneDuration - 5;
                const firstPartClip = path.join(TEMP_DIR, `${sessionId}_scene_${sceneIdx + 1}_main.mp4`);

                if (numImages === 1) {
                    // Single image for the first part
                    await createVideoClipWithAudioSegment(
                        sceneImages[0].imagePath,
                        audioPath,
                        firstPartClip,
                        0,
                        firstPartDuration,
                        sceneIdx * 10
                    );
                } else {
                    // Multiple images - distribute them across the first part
                    const segmentDuration = firstPartDuration / numImages;
                    const firstPartSubClips = [];

                    for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
                        const subClipPath = path.join(TEMP_DIR, `${sessionId}_scene_${sceneIdx + 1}_subclip_${imgIdx + 1}.mp4`);
                        await createVideoClipWithAudioSegment(
                            sceneImages[imgIdx].imagePath,
                            audioPath,
                            subClipPath,
                            imgIdx * segmentDuration,
                            segmentDuration,
                            sceneIdx * 10 + imgIdx
                        );
                        firstPartSubClips.push(subClipPath);
                        tempFiles.push(subClipPath);
                    }

                    await concatenateClips(firstPartSubClips, firstPartClip);
                }
                subClipPaths.push(firstPartClip);
                tempFiles.push(firstPartClip);

                // Second part: subscribe image for the last 5 seconds
                const subscribeClip = path.join(TEMP_DIR, `${sessionId}_scene_${sceneIdx + 1}_subscribe.mp4`);
                await createVideoClipWithAudioSegment(
                    subscribeImagePath,
                    audioPath,
                    subscribeClip,
                    firstPartDuration,  // Start from where first part ended
                    5,  // 5 seconds duration
                    sceneIdx * 10 + 99
                );
                subClipPaths.push(subscribeClip);
                tempFiles.push(subscribeClip);

                // Combine both parts
                const sceneClipPath = path.join(TEMP_DIR, `${sessionId}_clip_${sceneIdx + 1}.mp4`);
                await concatenateClips(subClipPaths, sceneClipPath);
                clipPaths.push(sceneClipPath);
                tempFiles.push(sceneClipPath);

            } else if (isLastScene && hasSubscribeImage && sceneDuration <= 5) {
                // If last scene is 5 seconds or less, use subscribe image for entire scene
                console.log(`Last scene is ${sceneDuration}s. Using subscribe image for entire scene.`);
                const clipPath = path.join(TEMP_DIR, `${sessionId}_clip_${sceneIdx + 1}.mp4`);
                await createVideoClip(subscribeImagePath, audioPath, clipPath, sceneDuration, sceneIdx);
                clipPaths.push(clipPath);
                tempFiles.push(clipPath);

            } else {
                // Normal processing for non-last scenes or if no subscribe image
                if (numImages === 1) {
                    const clipPath = path.join(TEMP_DIR, `${sessionId}_clip_${sceneIdx + 1}.mp4`);
                    await createVideoClip(sceneImages[0].imagePath, audioPath, clipPath, sceneDuration, sceneIdx);
                    clipPaths.push(clipPath);
                    tempFiles.push(clipPath);
                } else {
                    const subClipPaths = [];
                    const segmentDuration = sceneDuration / numImages;

                    for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
                        const subClipPath = path.join(TEMP_DIR, `${sessionId}_scene_${sceneIdx + 1}_subclip_${imgIdx + 1}.mp4`);
                        await createVideoClipWithAudioSegment(
                            sceneImages[imgIdx].imagePath,
                            audioPath,
                            subClipPath,
                            imgIdx * segmentDuration,
                            segmentDuration,
                            sceneIdx * 10 + imgIdx
                        );
                        subClipPaths.push(subClipPath);
                        tempFiles.push(subClipPath);
                    }

                    const sceneClipPath = path.join(TEMP_DIR, `${sessionId}_clip_${sceneIdx + 1}.mp4`);
                    await concatenateClips(subClipPaths, sceneClipPath);
                    clipPaths.push(sceneClipPath);
                    tempFiles.push(sceneClipPath);
                }
            }

            sendProgress(sessionId, {
                step: 'clip',
                status: 'in_progress',
                message: `Scene ${sceneIdx + 1}/${scenes.length} complete`,
                sceneIndex: sceneIdx + 1,
                totalScenes: scenes.length
            });
        }

        // Step 5: Assembly
        sendProgress(sessionId, {
            step: 'assembly',
            status: 'in_progress',
            message: 'Assembling final video...',
            sceneIndex: scenes.length,
            totalScenes: scenes.length
        });

        const finalVideoPath = path.join(OUTPUT_DIR, `${sanitizedTitle}_${sessionId}.mp4`);
        await concatenateClips(clipPaths, finalVideoPath);

        const videoUrl = `/output/${path.basename(finalVideoPath)}`;

        // Cleanup
        cleanupTempFiles(tempFiles);

        // Generate Thumbnails if metadata exists
        let thumbnailUrls = [];
        if (youtubeMetadata && youtubeMetadata.thumbnail_prompts) {
            sendProgress(sessionId, {
                step: 'image',
                status: 'in_progress',
                message: 'Generating viral thumbnails...',
                sceneIndex: scenes.length,
                totalScenes: scenes.length
            });

            console.log("Generating thumbnails for session:", sessionId);
            const thumbnailPaths = await generateThumbnails(youtubeMetadata.thumbnail_prompts, sessionId);

            for (let i = 0; i < thumbnailPaths.length; i++) {
                thumbnailUrls.push(`/output/${path.basename(thumbnailPaths[i])}`);
            }
        }

        sendProgress(sessionId, {
            step: 'complete',
            status: 'completed',
            message: 'Video ready!',
            videoUrl: videoUrl,
            youtubeMetadata: {
                ...youtubeMetadata,
                thumbnails: thumbnailUrls
            },
            sceneIndex: scenes.length,
            totalScenes: scenes.length
        });

    } catch (error) {
        console.error('Video processing failed:', error);
        cleanupTempFiles(tempFiles);
        sendProgress(sessionId, {
            step: 'error',
            status: 'failed',
            message: error.message || 'Video processing failed'
        });
    }
}

/**
 * Main video creation endpoint with SSE progress
 */
app.post('/api/create-video', async (req, res) => {
    const { topic, hook, fact, duration = 60, genre = 'informative', comedyLevel = 'mild', language = 'gujarati', preview = false } = req.body;
    const targetDuration = Math.max(30, Math.min(300, parseInt(duration) || 45));
    const validGenres = ['informative', 'comedy', 'storytelling', 'motivational', 'didyouknow'];
    const selectedGenre = validGenres.includes(genre) ? genre : 'informative';
    const validComedyLevels = ['mild', 'medium', 'spicy'];
    const selectedComedyLevel = validComedyLevels.includes(comedyLevel) ? comedyLevel : 'mild';
    const validLanguages = ['gujarati', 'hindi', 'english'];
    const selectedLanguage = validLanguages.includes(language) ? language : 'gujarati';
    const sessionId = Date.now().toString();

    // Validation
    if (selectedGenre === 'didyouknow') {
        if (!hook || !fact) {
            return res.status(400).json({ success: false, error: 'Hook and Fact required' });
        }
    } else if (!topic) {
        return res.status(400).json({ success: false, error: 'Topic is required' });
    }

    const effectiveTopic = selectedGenre === 'didyouknow' ? `HOOK: ${hook}\n\nFACT: ${fact}` : topic;

    res.json({ success: true, sessionId, message: 'Video creation started' });

    try {
        // Step 1: Generate Script
        sendProgress(sessionId, {
            step: 'script',
            status: 'in_progress',
            message: `Generating ${selectedGenre} script...`,
            sceneIndex: 0,
            totalScenes: 0
        });

        const scriptResult = await generateScript(effectiveTopic, targetDuration, selectedGenre, selectedComedyLevel, selectedLanguage);
        const scenes = scriptResult.scenes;
        const videoTitle = scriptResult.videoTitle || 'Untitled Video';
        const youtubeMetadata = scriptResult.youtube_metadata;

        console.log(`Script Generated: ${scenes.length} scenes`);
        console.log('DEBUG: youtubeMetadata in create-video:', JSON.stringify(youtubeMetadata, null, 2));

        sendProgress(sessionId, {
            step: 'script',
            status: 'completed',
            message: `Generated ${scenes.length} scenes - "${videoTitle}"`,
            sceneIndex: 0,
            totalScenes: scenes.length
        });

        // PREVIEW MODE CHECK
        if (preview) {
            console.log(`Session ${sessionId} entering preview mode`);
            pendingSessions.set(sessionId, {
                scenes,
                videoTitle,
                selectedLanguage,
                youtubeMetadata
            });

            // Send preview data via SSE
            sendProgress(sessionId, {
                step: 'previewReady',
                status: 'waiting',
                message: 'Script ready for review',
                data: {
                    videoTitle,
                    scenes,
                    language: selectedLanguage,
                    youtubeMetadata
                }
            });
            return; // STOP HERE
        }

        // If not preview, proceed immediately
        await processScenes(sessionId, scenes, videoTitle, selectedLanguage, youtubeMetadata);

    } catch (error) {
        console.error('Script generation failed:', error);
        sendProgress(sessionId, {
            step: 'error',
            status: 'failed',
            message: error.message || 'Script generation failed'
        });
    }
});

/**
 * Confirm and resume video generation from preview
 */
app.post('/api/confirm-video', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || !pendingSessions.has(sessionId)) {
        return res.status(404).json({ success: false, error: 'Session not found or expired' });
    }

    const sessionData = pendingSessions.get(sessionId);
    pendingSessions.delete(sessionId); // Clear from memory

    res.json({ success: true, message: 'Resuming video generation' });

    console.log(`Resuming session ${sessionId} after preview approval`);
    console.log('DEBUG: sessionData stored metadata:', JSON.stringify(sessionData.youtubeMetadata, null, 2));

    // Resume processing
    await processScenes(
        sessionId,
        sessionData.scenes,
        sessionData.videoTitle,
        sessionData.selectedLanguage,
        sessionData.youtubeMetadata
    );
});



/**
 * Generate Thumbnails
 */
async function generateThumbnails(prompts, sessionId) {
    const paths = [];
    for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        const path = `${OUTPUT_DIR}/${sessionId}_thumbnail_${i + 1}.png`;
        console.log(`Generating thumbnail ${i + 1}...`);
        try {
            await generateImage(prompt, path);
            paths.push(path);
        } catch (e) {
            console.error(`Thumbnail ${i + 1} failed:`, e);
        }
    }
    return paths;
}

/**
 * TEST ENDPOINT: Generate images only (no audio/video)
 * Use this to test batch image generation in isolation
 */
app.post('/api/test-images', async (req, res) => {
    const { prompts } = req.body;

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Please provide "prompts" as an array of image prompt strings',
            example: {
                prompts: [
                    "A beautiful sunset over mountains",
                    "A cute cat playing with yarn"
                ]
            }
        });
    }

    const sessionId = `test_${Date.now()}`;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST IMAGE GENERATION - Session: ${sessionId}`);
    console.log(`Number of prompts: ${prompts.length}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        const startTime = Date.now();
        const imagePaths = await generateImagesBatch(prompts, sessionId);
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`TEST COMPLETE - ${imagePaths.length} images in ${elapsedSec}s`);
        console.log(`${'='.repeat(60)}\n`);

        res.json({
            success: true,
            sessionId,
            elapsedSeconds: parseFloat(elapsedSec),
            imageCount: imagePaths.length,
            imagePaths
        });
    } catch (error) {
        console.error('Test image generation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            sessionId
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AI Video Service running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to create videos`);
});
