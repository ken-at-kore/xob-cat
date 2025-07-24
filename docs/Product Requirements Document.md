# Product Requirements Document (PRD)

## Product: XOB CAT (XO Bot Conversation Analysis Tools)

### Overview

XOB CAT is a full-stack web analytics platform developed by the Kore.ai Expert Services team. It is designed to empower XO bot developers and related stakeholders to deeply investigate, explore, and analyze production chatbot and IVA sessions built using the Kore.ai XO Platform. The platform provides structured and unstructured views of session data, supports filtering, classification, and GPT-assisted analysis generation, and aims to generate actionable insights related to containment, flow performance, and drop-off trends.

---

## Vision Statement

To become the definitive analytics platform for Kore.ai Expert Services teams, enabling data-driven bot optimization and improved client satisfaction through comprehensive conversation analysis and AI-enhanced insight generation.

---

## Context

### The Kore.ai XO Platform

The Kore.ai XO Platform is an enterprise-grade, low-/no-code suite used to build, manage, and deploy intelligent virtual assistants (IVAs) and chatbots across more than 40 digital and voice channels. It features robust NLU, orchestration tools, built-in analytics, and generative AI capabilities including summarization, RAG search, prompt orchestration, and language translation. It supports regulated industries with full compliance and governance tooling.

### Business Motivation

As more clients deploy XO IVAs into production, the need has grown for a flexible, LLM-integrated analysis tool tailored to Expert Services developers and analysts. Existing XO platform analytics are powerful but general-purpose. XOB CAT will provide a more investigative experience—purpose-built for optimization workflows and bot tuning engagements.

---

## Users

### Primary Users

- **Expert Services Developers and Designers:** Responsible for analyzing real-world IVA performance and proposing enhancements.
- **Expert Services Managers:** Oversee optimization projects and report to client stakeholders.

### Secondary Users

- **Citizen Developers:** Drag-and-drop builders of bot logic.
- **Conversational Designers:** Define flow, tone, and UX.
- **Integration Engineers & Solution Architects:** Build and debug external system connectivity.
- **CX Managers / Contact Center Leads:** Monitor deflection, containment, and hand-off performance.
- **Knowledge Managers:** Ensure accuracy of answers and control content compliance.
- **IT Admins / Security Analysts:** Oversee data access, privacy controls, and uptime.
- **Data Analysts:** Investigate performance by intent, intent mismatch, and ROI.
- **Business Stakeholders:** Review top-level KPIs and performance trends.

---

## MVP Features

### 1. Navigation & Layout

- **Top Navigation Bar:** Fixed header with left side containing "XOB CAT" title followed by de-emphasized "XO Bot Conversation Analysis Tools" subtitle. Right side shows "Bot ID" label, the actual bot ID, a bullet separator, and "Disconnect" link. Disconnect returns user to credentials page.
- **Sidebar Navigation:** Left sidebar with "Pages" section containing links to "View Sessions" (default) and "Analyze Sessions" pages.
- **Layout Structure:** Dashboard layout with top nav + sidebar, main content area for page-specific content.
- **Routing:** Authenticated users are redirected from credentials page to dashboard after successful connection verification.

### 2. Session Management

- **Session Viewer:** View of production bot sessions; supports browsing and filtering by timestamp. Pagination may be supported but is not required.
- **Session Detail View:** Displays full message-by-message transcript with speaker labels, timestamps, metadata, and raw payload visibility.
- **Navigation Controls:** Previous/Next session buttons with date retention across views.
- **Search & Filter:** Filter sessions by date range and session-level metadata fields (e.g. bot name, channel, session ID).

### 3. Analysis Tools

- **LLM Integration:** Uses OpenAI GPT-4o-mini via function calling to generate insights about each session, such as intent, outcome, drop-off location, escalation status, and key issues, using structured output via function calling.
- **Token Usage Monitoring:** Tracks token usage per session, user, and day; displays token and cost metrics.
- **Random Sampling Tool:** Pulls a randomized selection of sessions within a given date range to support representative sampling for analysis.
- **Date Range Picker:** Custom start and end dates for session queries and sampling.

* **Pareto Charts:** Bar or line charts showing frequency of intents, drop-off locations, or transfer reasons by count and percentage (80/20 visualization).

---

## Technical Considerations for MVP

- **Frontend:** Next.js (React + TypeScript), Tailwind CSS for styling, shadcn-ui components.
- **Backend:** Node.js (TypeScript), API routes for session data and GPT invocation.
- **Data Storage:** No data storage planned for MVP; session data and LLM outputs will be processed in-memory or client-side as needed.
- **LLM Integration:** GPT-4o-mini via OpenAI API with function calling; backend handles schema parsing and retry logic.
- **Testing:** Jest + React Testing Library for unit tests, Playwright for E2E.
- **Hosting:** AWS Amplify or AWS Lambda/Fargate, depending on deployment pipeline.