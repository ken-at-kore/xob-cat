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
- **Sidebar Navigation:** Left sidebar with "Pages" section containing links to "View Sessions" (default) and "Auto-Analyze" pages.
- **Layout Structure:** Dashboard layout with top nav + sidebar, main content area for page-specific content.
- **Routing:** Authenticated users are redirected from credentials page to dashboard after successful connection verification.

### 2. Session Management

- **Session Viewer:** View of production bot sessions; supports browsing and filtering by timestamp. Pagination may be supported but is not required.
- **Session Detail View:** Displays full message-by-message transcript with speaker labels, timestamps, metadata, and raw payload visibility.
- **Navigation Controls:** Previous/Next session buttons with date retention across views.
- **Search & Filter:** Filter sessions by date range and session-level metadata fields (e.g. bot name, channel, session ID).

### 3. Analysis Tools

#### Auto-Analyze Feature
- **Automated Session Analysis:** Comprehensive bot performance analysis that randomly samples sessions from specified time periods (5-1000 sessions) and applies AI analysis to extract structured insights.
- **Smart Session Sampling:** Intelligent time window expansion algorithm that searches 3-hour initial windows, expanding to 6-hour, 12-hour, and 6-day windows as needed to find sufficient sessions.
- **AI-Powered Fact Extraction:** Uses OpenAI GPT-4o-mini with function calling to extract key facts from session transcripts:
  - General Intent (what user is trying to accomplish)
  - Session Outcome (Transfer vs Contained)
  - Transfer Reason (why session was escalated)
  - Drop-off Location (where in flow user left)
  - Summary Notes (one-sentence session summary)
- **Batch Processing with Consistency:** Processes sessions in small batches (~5 sessions) while maintaining classification consistency across all batches using iterative learning.
- **Progress Tracking:** Real-time progress indicators during session sampling and analysis phases with token usage and cost estimation.
- **Results Display:** Structured table showing all session data with extracted facts, supporting filtering, sorting, and export capabilities.

#### Core Analysis Infrastructure
- **LLM Integration:** OpenAI GPT-4o-mini via function calling for structured output generation.
- **Token Usage Monitoring:** Comprehensive tracking of token usage, costs, and processing metrics across all analysis operations.
- **Error Handling:** Robust error recovery with fallback classifications and retry logic for failed sessions.
- **Date Range Picker:** Flexible date/time selection with timezone support (ET default).

#### Future Analysis Features
- **Pareto Charts:** Bar or line charts showing frequency of intents, drop-off locations, or transfer reasons by count and percentage (80/20 visualization).
- **Custom Fact Extraction:** User-defined fields for domain-specific analysis requirements.
- **Trend Analysis:** Historical comparison and performance trending across time periods.

---

## Technical Considerations for MVP

- **Frontend:** Next.js (React + TypeScript), Tailwind CSS for styling, shadcn-ui components.
- **Backend:** Node.js (TypeScript), API routes for session data and GPT invocation.
- **Data Storage:** No data storage planned for MVP; session data and LLM outputs will be processed in-memory or client-side as needed.
- **LLM Integration:** GPT-4o-mini via OpenAI API with function calling; backend handles schema parsing and retry logic.
- **Testing:** Jest + React Testing Library for unit tests, Playwright for E2E.
- **Hosting:** AWS Amplify or AWS Lambda/Fargate, depending on deployment pipeline.