# Learnora — Generative AI-Based Educational Assistant

Learnora is a React + Express educational assistant with Gemini as the primary AI provider and an optional OpenAI fallback. It includes AI study tools, authentication, learning history, quiz progress, English Communication practice, adaptive recommendations, document-based study support, voice interaction, and diagram generation.

## Project structure

```text
Learnora/
├── backend/
│   ├── server.js
│   ├── aiService.js
│   ├── aiErrors.js
│   ├── adaptiveLogic.js
│   ├── english.js
│   ├── documentTools.js
│   ├── db.js
│   ├── middleware/
│   ├── models/
│   └── routes/
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── utils/
    │   ├── App.jsx
    │   └── styles.css
    └── package.json
```

## Requirements

- Node.js 20 or newer (Node.js 22 recommended) and npm.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
- A MongoDB Atlas connection string for account, history, quiz-attempt and practice persistence. The server can report database status, but database-backed features require a working MongoDB connection.
- An OpenAI API key is optional. The fallback only runs when configured and when Gemini fails with an eligible quota or temporary service error. A ChatGPT subscription does not include API credits.

## 1. Configure the backend

Open a terminal in the project root and run:

```bash
cd backend
copy .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`. Open `backend/.env` and fill in the real values:

- `GEMINI_API_KEY`: your Gemini API key.
- `GEMINI_MODEL`: a model ID currently available to your API key.
- `MONGODB_URI`: your MongoDB Atlas connection string, including the `edu_assistant` database name if that is your chosen database.
- `JWT_SECRET`: a long random secret (at least 32 characters).
- `PORT=5000` for local development.
- `CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173` for local development.
- `OPENAI_API_KEY` may be left empty if you do not want to configure the backup provider yet. If you enable it, verify that `OPENAI_MODEL` is an available model for your API account.

Never put API keys, MongoDB credentials or JWT secrets in the frontend or commit your real `.env` file. The `.env.example` file contains placeholders only.

Install backend dependencies and start the server:

```bash
npm install
npm run dev
```

The backend should listen at `http://localhost:5000`. Check `http://localhost:5000/api/health` for status. The server requires a valid `GEMINI_API_KEY` to start.

## 2. Configure and start the frontend

Open a **second terminal** in the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. The frontend uses `http://localhost:5000` by default. To override it, create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Restart Vite after changing a frontend environment variable.

## Features

1. Ask Question
2. Explain Simply
3. Summarize pasted text
4. Generate interactive quizzes and save quiz attempts for signed-in users
5. Generate study plans, optionally informed by saved weak-topic data
6. English Communication practice (signed-in users only)
7. Learning history and progress dashboard
8. Adaptive learning recommendations based on saved quiz attempts
9. PDF, TXT and Markdown study-material processing
10. Browser voice input and spoken AI responses where supported
11. Visual diagram generation for supported prompts
12. Gemini primary AI provider with optional OpenAI fallback

## Verification notes

The source files were syntax-checked. Frontend JSX/JavaScript was parsed and its relative imports were checked. Lightweight backend logic checks were run with mocked AI calls. A full Vite production build and real API/database integration could not be completed in the packaging environment because npm could not reach the npm registry (DNS `EAI_AGAIN`). Run `npm install` and `npm run build` on your computer, then test using your own API keys and database. Do not treat mocked checks as proof of live integration.

## Troubleshooting

- **Blank page or frontend compile error:** check the frontend terminal and browser DevTools Console; run `npm install` and `npm run build` in `frontend`.
- **Cannot reach backend:** confirm the backend is running at port 5000 and `VITE_API_BASE_URL` matches.
- **CORS error:** check `CLIENT_ORIGIN` in `backend/.env`; it must include the exact frontend origin, including `http://` or `https://` and the port if present. Restart the backend after changes.
- **Database-backed feature reports database unavailable:** verify `MONGODB_URI`, Atlas network access and database credentials.
- **AI model not found or API key error:** verify `GEMINI_MODEL` and `GEMINI_API_KEY` against the models/keys available to your Google AI account.
- **AI quota error:** wait for quota to reset, or configure and verify an eligible OpenAI API fallback.

## Important limitations

- Live AI features require working API credentials and internet access.
- Login, saved history, progress and English practice persistence require MongoDB Atlas to connect.
- The OpenAI fallback is optional; it has not been verified against a live OpenAI API in this environment.
- Browser speech recognition support varies by browser and device.
- AI feedback and answers may be incorrect; students should verify important information.
