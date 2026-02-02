# Contributing to AI Video Service

Thank you for your interest in contributing to AI Video Service! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with:

- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (Node.js version, OS, etc.)
- **Error messages** or logs if available

### Suggesting Features

Feature suggestions are welcome! Please create an issue with:

- **Clear description** of the proposed feature
- **Use case** explaining why this feature would be valuable
- **Possible implementation** approach (if you have ideas)

### Submitting Pull Requests

1. **Fork the repository** and create a new branch from `main`
2. **Make your changes** following the code style guidelines below
3. **Test your changes** thoroughly
4. **Commit with clear messages** describing what and why
5. **Submit a pull request** with a detailed description

#### Code Style Guidelines

- Use **ES6+ modern JavaScript** syntax
- Follow **existing code formatting** (indentation, naming conventions)
- Add **JSDoc comments** for all functions
- Keep functions **focused and small** (single responsibility)
- Use **descriptive variable names**
- Add **error handling** for async operations

#### Testing

Before submitting:

- Test the application locally with `npm start`
- Verify all API endpoints work as expected
- Check that environment variables are properly documented
- Ensure no API keys or secrets are committed

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-video-service.git
   cd ai-video-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Add your API keys to `.env`

5. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
ai-video-service/
├── index.js              # Main Express server and video pipeline
├── VideoCreator.js       # React Native component (reference)
├── public/               # Web frontend
├── temp/                 # Temporary processing files
├── output/               # Generated videos (local)
└── assest/               # Static assets
```

## Key Technologies

- **Express** - Web server framework
- **Google Gemini** - Script and image generation
- **Cartesia TTS** - Voice synthesis
- **FFmpeg** - Video processing
- **Google Cloud Storage** - Cloud storage (optional)

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion on GitHub
- Create an issue for clarification
- Review existing issues and pull requests

## License Acknowledgment

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

You also acknowledge that:
- The original author is **Raj Hussain Kanani**
- Users of derivative works must provide attribution
- Your contributions become part of the open-source codebase

Thank you for contributing! 🎉
