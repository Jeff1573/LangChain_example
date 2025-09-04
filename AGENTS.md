# Repository Guidelines

## Project Structure & Module Organization
- `index.mjs`: Entry point; runs the LangGraph memory-based chat demo (prints A1/A2 and a thread id).
- `utils/chat_bot_example.js`: Defines a `StateGraph` with `MemorySaver` and uses `GOOGLE_API_KEY` via `dotenv`.
- `utils/translate_example.js`: Prompt + streaming translation chain; expects a `ChatGoogleGenerativeAI` model passed in.
- `package.json`: ESM project (`"type": "module"`); LangChain/LangGraph/Google GenAI dependencies.
- `README.md`: Project overview.

## Build, Test, and Development Commands
- Install: `npm install` (or `npm ci` in CI) — install dependencies.
- Run chat demo: `node index.mjs` — executes the threaded chat example.
- Run translate demo: uncomment the model setup and `translateExample(model)` in `index.mjs`, then `node index.mjs`.
  Example model: `new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash", temperature: 0, apiKey: process.env.GOOGLE_API_KEY })`.
- Note: the `start` script currently points to `index.js`; prefer `node index.mjs` or update `package.json` accordingly.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; use ESM imports/exports.
- Filenames: lower_snake_case for utilities; `.mjs` for top-level runners.
- Exports: prefer named exports; allow default for single-purpose helpers.
- Optional tools: ESLint + Prettier. Once configured, run `npx eslint .` and `npx prettier --write .`.

## Testing Guidelines
- Framework: none yet. When adding tests, prefer Vitest or Jest.
- Location/pattern: `__tests__/**` or colocate as `*.test.js` next to source.
- Coverage: target >80% lines on new/changed code. Include tests for graph transitions and memory reuse (`thread_id`).

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add memory-backed chat`, `fix: handle missing GOOGLE_API_KEY`).
- PRs: include purpose, linked issues, manual run steps (`node index.mjs` output), and relevant screenshots/console excerpts. Keep diffs focused; update docs if behavior changes.

## Security & Configuration Tips
- Create a `.env` with `GOOGLE_API_KEY=<your key>`; never commit secrets.
- Validate required env vars early and fail with clear errors.
- Avoid logging secrets/PII; redact tokens and thread ids when sharing logs.

