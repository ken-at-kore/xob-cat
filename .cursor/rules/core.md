# Cursor AI Core Rules for XOB CAT

## 🧠 Project Overview
XOB CAT (XO Bot Conversation Analysis Tools) is a full-stack web app that helps Kore.ai Expert Services teams investigate and analyze chatbot and IVA session data. It uses OpenAI’s GPT-4o-mini via function calling to generate insights like intent, drop-off reasons, and outcomes. The MVP uses in-memory data only (no database), and the GPT analysis output follows a structured schema.

## 🏗️ Architecture & Stack
- **Monorepo structure**
  - `frontend/`: Next.js 15 (React + TypeScript), Tailwind CSS, shadcn-ui
  - `backend/`: Node.js + TypeScript, using API routes or Express
- **No persistent storage** — session and analysis data are held in memory for MVP
- **OpenAI Integration** via GPT-4o-mini + function calling (in `backend/`)
- **Shared domain models** live in a `shared/` folder and include `Session`, `Message`, `AnalysisResult`, etc.
- **Testing tools**: Jest + React Testing Library (frontend), Playwright (E2E), and Jest or tsx for backend testing

## ✅ Requirements
- Users can view a list of bot sessions and inspect details of each
- Sessions include timestamps, metadata, and full message transcripts
- LLM analysis must return structured JSON fields: `intent`, `outcome`, `dropOff`, `escalationReason`, and `notes`
- Charts (e.g., Pareto) visualize drop-off and escalation frequencies
- Users can configure date range and sample size
- Token usage (cost/consumption) is surfaced clearly

## 📐 Coding Guidelines
- TypeScript everywhere, with types/interfaces for all structured data
- Use `shared/types/` for domain models shared between frontend and backend
- Frontend should follow Next.js App Router conventions
- Backend API routes should return JSON and not persist anything
- Use Tailwind CSS classes for all styling — no external CSS files
- Use async/await syntax, avoid `then` chains
- No database, file writes, or local storage for now
- OpenAI API key must be accessed via `process.env.OPENAI_API_KEY`

## 🛑 Constraints
- Do not commit or hardcode secrets or sample data
- Do not introduce any data storage — no SQLite, Postgres, etc.
- Do not scaffold or assume login/auth unless explicitly requested

## 🤖 AI Behavior Instructions
- Always ask if uncertain about the business logic or feature intent
- When generating new components or endpoints, match the types in `shared/types/`
- Prefer composable, minimal components with clearly named props
- Break up complex logic into smaller, testable utilities
- When building a chart, default to nivo or a d3 wrapper unless directed otherwise
- If adding LLM integration, assume GPT-4o-mini with function calling and structured response parsing

---
