# Helix — Story Intelligence

## Purpose

Helix is a React and Express application for analysing serial audio-drama scripts. It provides story-quality metrics, retention forecasts, emotional journeys, issue detection, AI-assisted rewrites, Indian cultural-resonance feedback, model usage/cost estimates, and local persistence.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons.
- Backend: Express and TypeScript (`server.ts`).
- AI providers: OpenAI Chat Completions and Google Gemini.
- Local persistence: SQLite through `better-sqlite3`.
- Deployment configuration: Render (`render.yaml`).

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful commands:

```bash
npm run lint
npm run build
npm start
```

The project requires Node.js 22 or later.

## Environment variables

Set these in `.env` locally or in the Render environment configuration:

```env
OPENAI_API_KEY=...
GEMINI_API_KEY=...
SQLITE_DATABASE_PATH=./data/helix-story-intelligence.db
PORT=3000
```

`OPENAI_API_KEY` is required for the default GPT-4o model. `GEMINI_API_KEY` is required only when a Gemini model is selected. API keys must never be sent to the browser or committed to Git.

## AI model behavior

- Default model: `gpt-4o`.
- Supported UI choices: GPT-4o, GPT-4o-mini, Gemini 2.5 Flash, and Gemini 2.5 Pro.
- Model selection is strict. A failed Gemini run does not fall back to OpenAI, and a failed OpenAI run does not fall back to Gemini.
- A failed selected model returns a visible error so the user can change the model and retry.
- Analysis and sandbox responses include provider token usage when it is returned by the provider.
- The UI calculates estimated USD cost from input/output token counts and published standard rates. It is an estimate; credits, caching, and taxes can differ from provider invoices.

## Analysis workflow

`POST /api/analyze-story` receives a full story and selected model. The response includes:

- Overall Story IQ, commercial tier, and predicted completion rate.
- Story genome, hook analysis, retention curve, emotional timeline, issues, and benchmarks.
- Indian Cultural Resonance, separate from Story IQ. It returns `insufficient_context` instead of penalising culture-neutral scripts.
- Episode summaries and `episodeJourneys`, which contain a retention forecast, emotional arc, and suggested changes per episode.

Episode duration is estimated at approximately 140 words per minute and supplied to the model so per-episode forecasts use the appropriate time range.

Issue excerpts are validated against the actual uploaded script before being returned. Unverifiable, AI-invented excerpts are excluded rather than shown in the flaw inspector.

## Sandbox workflow

`POST /api/rewrite-scene` receives:

- The original snippet.
- The selected model and instruction.
- The complete current story context.
- Story ID and target episode ID when available.

The rewrite prompt is continuity-first: it must preserve existing characters, roles, relationships, setting, facts, timeline, and scene intent. It may improve delivery, dialogue, pacing, emotional tension, and SFX, but must not invent canon.

When a rewrite is applied, the app replaces only a verified original snippet in the intended episode. If no exact or whitespace-equivalent match is found, it makes no script change and displays an error.

## Persistence

SQLite lives at `data/helix-story-intelligence.db` by default. Database files and WAL files are ignored by Git.

Migrations run automatically during server startup. Current persistence tables:

- `stories`
- `episodes`
- `story_versions`
- `analyses`
- `rewrite_runs`
- `model_usage`
- `schema_migrations`

The backend uses a `StoryRepository` interface and `SqliteStoryRepository` implementation. This keeps the UI and Express routes independent of the storage provider. A future Neon or Databricks Lakebase/Postgres implementation should implement the same interface.

The frontend auto-saves stories, exposes a saved-story selector, persists analyses and usage, and creates a version snapshot before applying a sandbox rewrite.

## Important paths

- `server.ts`: Express server, AI routes, and API endpoints.
- `server/database.ts`: SQLite connection and migrations.
- `server/repositories/`: persistence abstraction and SQLite implementation.
- `src/App.tsx`: application state, persistence integration, analysis and sandbox orchestration.
- `src/components/ScriptEditorPanel.tsx`: script editor, model selection, saved stories, and cost display.
- `src/components/LiveRewriteSandbox.tsx`: context-aware rewrite workflow.
- `src/components/EpisodeJourneyCarousel.tsx`: episode-level retention/emotion carousel.
- `src/components/StoryIssuesInspector.tsx`: validated issue and flaw display.
- `src/components/StoryOverviewHeader.tsx`: overview metrics and cultural-resonance display.

## Deployment notes

Render is configured in `render.yaml`.

- Build: `npm install && npm run build`
- Start: `npm start`
- Health check: `/api/health`

SQLite is suitable for local development and MVP demos. Render’s local filesystem is not durable for production persistence; use Neon Postgres or Databricks Lakebase/Postgres for a durable deployed database.
