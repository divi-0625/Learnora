# Learnora frontend integration notes

This frontend preserves the existing React + Vite application and adds UI pages for the additional backend capabilities described in Claude's Part 1 response.

## Features connected by the frontend

- Existing learning tools: `POST /api/generate`
- Visual diagrams: `POST /api/visual`
- Authentication: `/api/auth/*`
- Existing history: `/api/history/*`
- Existing progress: `/api/progress/summary`, `/api/progress/quiz-attempts`
- Adaptive learning: `GET /api/progress/adaptive`
- English Communication: `POST /api/english/start`, `POST /api/english/respond`, `GET /api/english/history`
- Document tools: `POST /api/document`

The English Communication endpoints require a logged-in user. Adaptive Learning requires a logged-in user and a connected database. Document processing supports PDF (up to 5 MB), TXT and Markdown according to the supplied backend code.

## Run locally

1. Apply the new backend files from Claude's Part 1 first. The original ZIP's backend does not yet contain the new English or document routes.
2. Install dependencies in `frontend` with `npm install`.
3. Copy `.env.example` to `.env` if you need a custom backend URL. For local development, the default is `http://localhost:5000`.
4. Start the backend in its own terminal.
5. In `frontend`, run `npm run dev` and open the localhost URL printed by Vite.

## Environment variable

`VITE_API_BASE_URL` is the base URL of the Express backend. Example for local development:

`VITE_API_BASE_URL=http://localhost:5000`

Set the deployed backend URL in your hosting provider's frontend environment settings when deploying. Do not put Gemini, OpenAI, MongoDB or JWT secrets in any `VITE_` variable; Vite variables are visible in the browser.

## Verification status

The JavaScript/JSX source files passed a syntax transpilation check and all relative imports resolve. A full Vite production build could not be completed in this environment because npm dependency installation timed out. Run `npm install` and `npm run build` locally before your demonstration.
