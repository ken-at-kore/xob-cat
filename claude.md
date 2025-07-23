---
description: XOB CAT – Claude Code default workflow
alwaysApply: true
globs: ["**/*"]
---

# 🧑‍💻 Working Style
- **TDD first** – write failing tests, then code until green.
- Next 14 / 15 + shadcn-ui + Tailwind, strict TypeScript, **no `any`**.
- If several technical paths are possible, **pick the one already recommended** in the prompt; do **not** ask.
- Ask questions only when business logic is ambiguous or new credentials / cost are involved.
- Keep assistant chatter minimal; avoid unnecessary confirmations.

# 🏗️ Architecture & Stack
| Layer      | Tech & Conventions |
|------------|-------------------|
| Frontend   | Next.js 14/15 (App Router, React Server Components), Tailwind CSS, shadcn-ui |
| Backend    | Node.js + TypeScript, Next.js API routes (no Express) |
| Shared     | `shared/` folder with types (`Session`, `Message`, `AnalysisResult`, …) |
| Storage    | **None** (in-memory only for MVP) |
| LLM        | OpenAI GPT-4o-mini via function calling |
| Testing    | Jest + React Testing Library, Playwright E2E, Jest/tsx for backend |

# ✅ Functional Requirements
- List & detail views for bot sessions (timestamps, metadata, transcripts).
- LLM analysis returns structured JSON: `intent`, `outcome`, `dropOff`, `escalationReason`, `notes`.
- Pareto-style charts for drop-off / escalation frequency.
- User-selectable date range & sample size.
- Surface token usage (cost & consumption).

# 📐 Coding Guidelines
- **TypeScript everywhere**; domain models live in `shared/types/`.
- Follow Next.js App Router patterns; backend routes return JSON only.
- Styling: **Tailwind utilities + shadcn/ui components** – no external CSS or `<style>` tags.
- Use async/await; avoid `.then` chains.
- No database, file writes, LocalStorage, or auth unless explicitly requested.
- Read `process.env.OPENAI_API_KEY` for LLM calls.

# 🎨 UI & Accessibility
- Desktop-first (≥ 1280 px); progressively enhance down to tablet.
- All interactive elements must expose a visible `:focus-visible` ring.
- Minimum interactive target: **32 × 32 px**.
- Re-use `/src/components/ui/{Button,Card,Input,…}` before creating new markup.

# 🛑 Hard Constraints
- Never commit secrets or sample data.
- Do **not** introduce persistence (SQLite, Postgres, etc.).
- Do **not** scaffold login/auth without an explicit requirement.

# 🤖 Claude Code Assistant Directives
- Follow the rules above for every suggestion or code generation.
- Default charting libs: **nivo** (preferred) or a simple D3 wrapper.
- When adding LLM logic, assume GPT-4o-mini with function calling and strict schema parsing.
- Break complex logic into testable utilities; favor composable, minimal React components.

---
