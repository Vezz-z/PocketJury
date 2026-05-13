# 🚀 PocketJury v1.0.1 Release Notes
**Date: May 3rd, 2026**

We are thrilled to announce the official `v1.0.1` update of **PocketJury**! Building upon our initial launch, this update resolves deep-seated state management constraints and fundamentally overhauls the frontend AI streaming experience for hyper-responsive legal inquiries.

PocketJury has been built from the ground up as an offline-capable, highly secure microservice architecture utilizing state-of-the-art Natural Language Processing.

## 🌟 What's New in v1.0.1 (Major Changes)

### 1. True Background Concurrency & SSE Streaming
- **Multitasking:** Responses now utilize Server-Sent Events (SSE) for real-time, typewriter-style generation. You can now switch to different chats or start new ones while the current chat generates its response in the background.
- **Global UI Sync:** The sidebar features pulsating indicators for *all* active background streams simultaneously. A floating toast notification alerts you when a background response has finished generating.
- **Intelligent Kill Switch:** A "Stop Generating" button allows you to instantly halt the stream and cleanly terminate the backend processing.

### 2. Enhanced Multilingual Translation Engine
- The response pipeline has been rewritten to immediately stream localized responses (e.g., typing out Hindi natively as it generates) rather than waiting for an English block to finish and then translating the whole page. This ensures all legal disclaimers and specific wordings are cleanly preserved in the target language.

### 3. Navigation & UX Polish
- **Dynamic Scroll Management:** A responsive "Jump to Bottom" button dynamically appears/disappears based on your scroll position during streams, without locking you out of scrolling up to read prior context.
- **Power User Shortcuts:** Introduced global keyboard shortcuts (`Ctrl+Shift+K` for New Chat, `Ctrl+Alt+C` for Chats, `Ctrl+Alt+K` to Toggle Sidebar, `Ctrl+Shift+S` for Settings) to navigate the app instantly.
- **Multilingual Tooltips:** All UI hover elements, sidebars, and keyboard shortcut hints are now natively translated across all four supported languages.

### 4. Authentication & Security Overhaul
- **Google OAuth:** Users can now sign in or register using their Google account via the "Continue with Google" button, powered by Google Identity Services (GIS) with server-side ID token verification.
- **Email Verification (MFA):** All new registrations require a 6-digit email verification code. Login flows now mandate OTP-based multi-factor authentication for enhanced security.
- **Edit Email in OTP:** If a user enters the wrong email during OTP verification, they can now edit it inline. The previous OTP is securely cancelled via Redis, and a new code is sent after re-authentication.
- **Session Awareness:** When a logged-in user visits `/login`, `/register`, or clicks "Get Started" on the landing page, a modal prompts them to either continue with their current session or log in with a different account.
- **Change Password:** A new "Security" section in Settings allows authenticated users to change their password. Google-only accounts see a "Password managed by Google" notice instead.
- **Forgot & Reset Password:** Added `/forgot-password` and `/reset-password` pages with JWT-based single-use reset tokens (15-minute TTL). All sessions are invalidated on password reset.
- **Email Domain Validation:** Passwordless login flows are protected by an email domain allowlist (Gmail, Yahoo, Outlook, Proton, etc.) and a disposable email blocklist.
- **Full i18n:** All new authentication strings are translated across all four languages (English, Hindi, Tamil, Bengali).

## 🌟 Core Architecture (v1.0 Base)

### 1. The RAG-Forced AI Legal Engine
- **Zero-Hallucination Framing:** PocketJury systematically overrides the baseline knowledge of its LLM engines (like GPT-OSS or Llama). Rather than "guessing" the law, the system uses a Retrieval-Augmented Generation (RAG) pipeline backed by `pgvector` to inject **exact, verified legal text directly from the Legislative Department, Government of India** into the prompt.
- **Embedded Knowledge Sets:** Officially seeded with the *Constitution of India*, *Bharatiya Nyaya Sanhita (BNS) 2023*, *Consumer Protection Act*, *Right to Information Act*, and the *Protection of Women from Domestic Violence Act*, amongst others.
- **IPC to BNS Transition Mapping:** Historical queries regarding old Indian Penal Code (IPC) cases are mechanically mapped and translated by the AI to their modern Bharatiya Nyaya Sanhita (BNS) 2023 equivalents.

### 2. Multi-Lingual Architecture
- Native support for four distinct languages: **English, Hindi, Tamil, and Bengali**.
- Real-time language switching in the UI is handled via `next-intl`.
- The AI pipeline natively processes foreign language inputs via the `intfloat/multilingual-e5-large` HuggingFace embeddings prior to semantic database searches, guaranteeing legal accuracy across translations.

### 3. Beautifully Responsive UI
- **Optimistic State Management:** Built heavily on `Zustand` and Framer-Motion to ensure chat windows scroll smoothly, messages slide into frame, and database deletions respond instantly.
- **"Simplify" Toggle:** Instantly translate extremely dense legalese or BNS case law into plain, comprehensible language via a built-in UI mechanism.
- **Floating Toast Interfaces:** Disclaimer banners, session timeouts, and critical system alerts natively float over the UI without blocking scrollability.

### 4. Enterprise-Grade Security
- **Asymmetric RSA JWT Auth:** User sessions are heavily encrypted off the grid utilizing native `.pem` key pairs spanning the Node API and Next.js layers.
- **Redis Throttling:** Built-in rate limiting prevents malicious spamming of the API endpoints.
- **Safety Interceptors:** The LLM is hard-coded to intercept emergency queries regarding domestic or child abuse, forcibly injecting the National Emergency Helpline (e.g., 181, 1098) as a high-priority UI block.

### 5. Seamless Docker Orchestration
- PocketJury `v1.0.1` leverages **TurboRepo** and sophisticated Docker Compose structuring to instantly boot all 5 required services (PostgreSQL, Redis, AI, API, Web) with a single command: `docker compose up --build -d`.

---

## 🛠️ Developer Resources
- **[QUICK_START.md](./QUICK_START.md)**: Exhaustive instructions on cloning the repository, generating the RSA `.pem` keys, and correctly formatting the global `.env` configuration.
- **[README.md](./README.md)**: Overarching storefront documentation on the architecture and feature set.
- **[LLM.md](./LLM.md)**: A deep-dive explicitly detailing how to disconnect PocketJury from the Cloud and run it 100% locally via **Ollama**.
- **[LEGAL.md](./LEGAL.md)**: The structural manifesto detailing exactly which government links and texts are injected into the Vector Database.

*(Note: PocketJury is a proprietary codebase owned by Mohammed Parvez (`@Vezz-z`). Reproduction, deployment, or commercial usage is strictly bound by the limitations listed in the EULA file, `LICENSE.md`).*
