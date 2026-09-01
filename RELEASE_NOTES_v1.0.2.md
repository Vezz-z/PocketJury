# 🚀 PocketJury v1.0.2 Release Notes
**Date: July 30th, 2026**

We are thrilled to announce the official `v1.0.2` update of **PocketJury**! This release introduces **Guest Mode with local Email OTP authentication**, updates the LLM engine to **NVIDIA Nemotron 3 Ultra 550B**, and implements automatic multi-model fallback resiliency to guarantee zero downtime for AI legal inquiries.

PocketJury has been built from the ground up as an offline-capable, highly secure microservice architecture utilizing state-of-the-art Natural Language Processing.

## 🌟 What's New in v1.0.2 (Major Changes)

### 1. Ephemeral Guest Mode & Onboarding
- **Unauthenticated Chat Experience:** Users can now immediately start asking legal queries without logging in via a prominent, high-contrast "Try Now" CTA button on the landing page.
- **In-Memory Privacy:** Guest conversations are ephemeral and handled strictly in-memory (Zustand) — zero chat history or personal data is stored in the database.
- **20-Query Guest Quota:** Guest sessions are rate-limited to 20 queries per minute via Redis rate limiting (`guestQueryLimiter`), offering plenty of capacity for evaluation.
- **Guest-Aware UI:** When browsing in Guest Mode, the sidebar cleanly displays Login and Sign Up CTAs alongside emergency helplines, without showing stale empty history or restricted action buttons.

### 2. Local Email OTP & Authentication Improvements
- **Email OTP Authentication:** Added OTP-based email verification locally for authentication flows.
- **Edit Email in OTP Area:** Added the ability to edit email during verification if an incorrect email was entered, securely ending the previous request via Redis session management.
- **Session Management:** Prevents duplicate prompts across tabs/windows and handles single-sign-on prompt dialogs when returning to the dashboard.
- **Password Security & Recovery:** Added Change Password functionality in Settings, inline Forgot Password links on login, and single-use password reset flows.

### 3. Upgraded AI Engine: NVIDIA Nemotron 3 Ultra 550B & Multi-Model Fallbacks
- **Primary Model Upgrade:** Default LLM updated to `openai/gpt-oss-120b` or `nvidia/nemotron-3-ultra-550b-a55b:free` via OpenRouter for legal reasoning and multilingual clarity.
- **Automatic Fallback Resiliency:** Implemented automatic model failover inside `LLMClient`. If an upstream free model slug becomes retired or unavailable (404/RateLimit), the pipeline transparently fails over to:
  1. `nvidia/nemotron-3-super-120b-a12b:free`
  2. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
  3. `openai/gpt-oss-20b:free`
  4. `google/gemma-4-31b-it:free`
  5. `nvidia/nemotron-3-nano-30b-a3b:free`
  6. `openrouter/free`
- **Instant SSE Title Event:** Generated chat titles are now broadcast immediately over the active SSE stream (`event: title`), eliminating background polling delays and instantly updating the active UI title.

### 4. UI, Styling & Localization Enhancements
- **Catchy "Try Now" Hero CTA:** Redesigned the primary landing page CTA with sleek gradient backgrounds, hover animations, and high dark-mode contrast.
- **Complete i18n Translation:** Added missing translation keys across all four supported languages (English, Hindi, Tamil, Bengali) for Guest Mode and navigation headers.

---

## 🌟 Core Architecture (v1.0 Base)

### 1. The RAG-Forced AI Legal Engine
- **Zero-Hallucination Framing:** PocketJury systematically overrides the baseline knowledge of its LLM engines. Rather than "guessing" the law, the system uses a Retrieval-Augmented Generation (RAG) pipeline backed by `pgvector` to inject **exact, verified legal text directly from the Legislative Department, Government of India** into the prompt.
- **Embedded Knowledge Sets:** Officially seeded with the *Constitution of India*, *Bharatiya Nyaya Sanhita (BNS) 2023*, *Consumer Protection Act*, *Right to Information Act*, and the *Protection of Women from Domestic Violence Act*.
- **IPC to BNS Transition Mapping:** Historical queries regarding old Indian Penal Code (IPC) cases are mapped and translated by the AI to their modern Bharatiya Nyaya Sanhita (BNS) 2023 equivalents.

### 2. Multi-Lingual Architecture
- Native support for four distinct languages: **English, Hindi, Tamil, and Bengali**.
- Real-time language switching in the UI handled via `next-intl`.
- The AI pipeline natively processes foreign language inputs via `intfloat/multilingual-e5-large` HuggingFace embeddings prior to semantic database searches.

### 3. Responsive UI & State Management
- Built heavily on `Zustand` and `Framer-Motion` for smooth transitions and optimistic updates.
- **"Simplify" Toggle:** Translate dense legalese or BNS case law into plain, comprehensible language via a built-in UI mechanism with SSE streaming support.

### 4. Security & Docker Orchestration
- Asymmetric RSA JWT authentication spanning Node API and Next.js layers.
- Redis-backed rate limiting and session management.
- Complete 5-container Docker Compose orchestration (`docker compose up --build -d`).

---

## 🛠️ Developer Resources
- **[QUICK_START.md](./QUICK_START.md)**: Exhaustive instructions on cloning the repository, generating RSA `.pem` keys, and formatting global `.env`.
- **[README.md](./README.md)**: Overarching storefront documentation on the architecture and feature set.
- **[LLM.md](./LLM.md)**: Details on cloud and local Ollama model switching.
- **[LEGAL.md](./LEGAL.md)**: Documentation of government legal texts injected into the Vector Database.

*(Note: PocketJury is a proprietary codebase owned by Mohammed Parvez (`@Vezz-z`). Reproduction, deployment, or commercial usage is strictly bound by the limitations listed in `LICENSE.md`).*
