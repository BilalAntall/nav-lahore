# navLahore

navLahore is a unified public transport web app for Lahore, Pakistan. It helps riders explore Orange Line, Metro Bus, and Speedo feeder routes, compare nearby stations, plan transfers, save routes, report service alerts, and ask transport questions through the RAAHI assistant.

Live app: [lahore-transport-six.vercel.app](https://lahore-transport-six.vercel.app/)

## Features

- Unified route planner for Orange Line Metro Train, Lahore Metro Bus, and Speedo feeder routes.
- Station-aware planning with distances, route suggestions, arrival context, and transfer guidance.
- RAAHI Bot, a Gemini and Pinecone powered transport assistant for fares, routes, schedules, and policy questions.
- Community alerts for delays, crowding, closures, and service updates.
- Firebase Authentication with Google/email login and Firestore-backed rider data.
- Profile, saved routes, rider stats, XP, and achievement badges.
- Offline demo mode for local screenshots and review when Firebase is not configured.

## Screenshots

Place project screenshots in `assets/` with these names:

![Dashboard preview](assets/dashboard_preview.png)
![RAAHI Bot preview](assets/chatbot_preview.png)
![Community alerts preview](assets/alerts_preview.png)

## Repository Structure

```text
nav-lahore/
├── README.md
├── .gitignore
├── assets/
│   └── .gitkeep
├── data-ingestion/
│   ├── .env.example
│   ├── ingest_rag.py
│   └── data/
│       ├── eco_bus.json
│       ├── eco_bus_info.txt
│       ├── metro_bus.json
│       ├── metro_bus_info.txt
│       ├── orange_line.json
│       └── orange_line_info.txt
└── frontend/
    ├── api/
    │   └── raahi.js
    ├── public/
    ├── src/
    ├── .env.example
    ├── package.json
    └── vite.config.js
```

## Tech Stack

- React 19 and Vite
- Firebase Authentication and Cloud Firestore
- Vercel serverless functions
- Google Gemini for RAAHI responses and embeddings
- Pinecone for transport knowledge retrieval
- Leaflet and React Leaflet for map-based transit views
- Tailwind CSS and custom CSS for the interface

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

In local development, the login screen shows `Enter Demo Mode (Offline)`. Use that button to review the app without signing in or changing your Firebase keys.

For repeatable local screenshots, you can also open dev-only demo URLs:

```text
http://localhost:5173/?demo=1&page=dashboard
http://localhost:5173/?demo=1&page=raahi
http://localhost:5173/?demo=1&page=alerts
```

## Frontend Environment

Create `frontend/.env.local` for local Firebase and backend configuration. Do not commit it.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

PINECONE_API_KEY=
PINECONE_INDEX_HOST=
PINECONE_NAMESPACE=__default__
PINECONE_TEXT_FIELD=chunk_text
```

Only variables prefixed with `VITE_` are exposed to the browser. Keep Firebase Admin, Gemini, and Pinecone keys server-side only.

## RAAHI Data Ingestion

The `data-ingestion/` folder prepares transport text and JSON data for Pinecone.

```bash
cd data-ingestion
pip install google-genai pinecone-client requests
copy .env.example .env
python ingest_rag.py
```

Fill `PINECONE_API_KEY`, `PINECONE_HOST`, and `GEMINI_API_KEY` in `data-ingestion/.env` before running the script. Do not commit `.env`.

## Security Notes

- `node_modules/`, `dist/`, `.vercel/`, `.env`, and `.env.local` files are ignored.
- Commit only `.env.example` templates.
- Rotate any key immediately if it was ever pasted into code, screenshots, chat, or Git history.
- Before pushing, run `git status --ignored` and confirm real environment files appear under ignored files.

## Recommended GitHub Repository

Use this repository name:

```text
nav-lahore
```

Suggested description:

```text
Unified Lahore public transport planner with route optimization, Firebase auth, community alerts, and a Gemini/Pinecone RAG assistant.
```

Suggested topics:

```text
react vite firebase vercel lahore public-transport transit-planner gemini pinecone rag
```

## Push To GitHub

Create an empty GitHub repository named `nav-lahore`, then run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/nav-lahore.git
git branch -M main
git push -u origin main
```

If you use GitHub CLI instead:

```bash
gh repo create nav-lahore --public --source=. --remote=origin --push
```
