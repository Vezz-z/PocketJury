# ⚖️ PocketJury (v1.0.2)

**An AI-Powered Legal Informational Tool for the Indian Judiciary Context**

Welcome to **PocketJury**! This application is designed to bridge the massive gap between complex Indian legislation and accessible public knowledge. By leveraging a sophisticated **Retrieval-Augmented Generation (RAG)** architecture, PocketJury explicitly prevents LLM hallucinations by forcing all responses to strictly cite verified legal statutes embedded directly from the **Legislative Department, Government of India**.

---

## 🌟 Key Features & Capabilities

- **Zero-Hallucination Legal Framing**: PocketJury completely rejects the baseline knowledge of the AI model. Instead, it utilizes strictly isolated vector embeddings to dynamically inject actual, verified laws straight into the LLM's context window.
- **Ephemeral Guest Mode**: Unauthenticated visitors can instantly chat without registering via a high-visibility "Try Now" hero CTA. Guest data is kept strictly in-memory (zero persistent storage) with rate-limiting protection.
- **Advanced Streaming & Concurrency**: Leverages Server-Sent Events (SSE) for real-time, typewriter-style responses with immediate `event: title` broadcasting. Fully supports background stream processing—switch chats seamlessly while the AI continues generating in the background with persistent UI indicators and toast notifications.
- **Upgraded AI Engine & Multi-Model Resiliency**: Default reasoning engine powered by `openai/gpt-oss-120b` or `nvidia/nemotron-3-ultra-550b-a55b:free` via OpenRouter, backed by an automated 6-model fallback chain (`nemotron-3-super-120b`, `nemotron-3-nano-omni`, `gpt-oss-20b`, `gemma-4-31b-it`, `nemotron-3-nano-30b`, `openrouter/free`) for zero downtime.
- **Multi-Lingual Support**: The UI and AI response logic are fully localized to support **English (`en`), Hindi (`hi`), Tamil (`ta`), and Bengali (`bn`)** with real-time UI switching via `next-intl`.
- **IPC to BNS Automatic Transitioning**: Historical Indian Penal Code (IPC) queries are natively forced by the application to map perfectly to the new Bharatiya Nyaya Sanhita (BNS) 2023 equivalents.
- **Semantic UI Chat Navigation**: Features instant-state message deletion, conversational tracking, "Simplify" toggles to reduce legal jargon, "Stop Generating" kill switches, and dynamic scroll handlers.
- **Keyboard Power User Shortcuts**: Includes `Ctrl+Shift+K` (New Chat), `Ctrl+Alt+C` (Chats), `Ctrl+Alt+K` (Toggle Sidebar), and `Ctrl+Shift+S` (Settings) for rapid navigation.
- **Built-in Safety Guardrails**: Sensitive queries (e.g., Domestic Violence or Child Exploitation) bypass normal pipelines to automatically surface National Emergency Helplines (like 181, 1098, and 1930).
- **Google OAuth, Local Email OTP & MFA**: Supports "Continue with Google" sign-in/sign-up with server-side ID token verification. Email authentication includes local OTP verification, inline email editing, and session management.
- **Session-Aware Authentication**: Cross-tab session detection prompts users to continue with their existing account or sign in with a different one. Includes change password (Settings), forgot/reset password flows, and email domain validation.

---

## 🏗️ Technical Architecture

PocketJury is engineered as a **TurboRepo** monorepo powering five independent, Dockerized microservices. It is built to be run isolated and offline using the latest open-source AI frameworks.

1. **Frontend (`apps/web`)**: Next.js 14 (App Router), TailwindCSS, Framer Motion, Zustand, Next-Intl
2. **Backend API (`apps/api`)**: Node.js, Express, Prisma ORM, Zod, JWT RSA Authentication, Google Auth Library
3. **AI Pipeline (`services/ai`)**: Python, FastAPI, HuggingFace (`multilingual-e5-large` embedding maps), LangChain
4. **Database (`postgres`)**: PostgreSQL 16 integrated natively with `pgvector` for semantic document retrieval
5. **Caching (`redis`)**: Redis Alpine for API Rate limiting, auth debouncing, and tracking Chat session limits

### 🤖 Local LLM Support (Ollama)
PocketJury is engineered to run blazing fast on the cloud using OpenRouter, or **100% locally using Ollama**. Running locally guarantees absolute privacy for sensitive legal questions and eliminates all cloud API costs. 
For deep technical instructions on configuring PocketJury with Ollama (or fine-tuning the model specifically for the Indian Law domain), read our dedicated guide: 
📌 **[LLM.md](./LLM.md)**.

---

## ⚖️ Verified Legal Sources

The underlying LLM acting as the reasoning engine is an unmodified foundation model. **It is not legally trained.** The legal integrity of PocketJury is maintained solely by scraping explicit, exact text directly from the Government of India's legislative portal and feeding it to the AI.

For a full breakdown of how the RAG pipeline processes these laws into vector graphs, read the official architectural manifesto here:
📌 **[LEGAL.md](./LEGAL.md)**.

All references provided by the application originate strictly from the following seeded RAG sources:

1. [Constitution of India (Part III: Fundamental Rights, Articles 14-32)](https://legislative.gov.in/constitution-of-india) 
2. [Bharatiya Nyaya Sanhita (BNS), 2023 (Chapter V: Offences Against Woman and Child)](https://legislative.gov.in/bns-2023-chapter-v) 
3. [Bharatiya Nyaya Sanhita (BNS), 2023 (Chapter VI: Offences Against Property)](https://legislative.gov.in/bns-2023-chapter-vi) 
4. [Consumer Protection Act, 2019](https://legislative.gov.in/consumer-protection-act-2019) 
5. [Right to Information (RTI) Act, 2005](https://legislative.gov.in/rti-act-2005) 
6. [Transfer of Property Act, 1882 (Leases and Rents)](https://legislative.gov.in/transfer-property-act-1882-lease) 
7. [Maintenance and Welfare of Parents and Senior Citizens Act, 2007](https://legislative.gov.in/senior-citizens-act-2007) 
8. [Legal Services Authorities Act, 1987 (Free Legal Aid & NALSA)](https://legislative.gov.in/lsa-act-1987) 
9. [Information Technology Act, 2000 (Cyber Crimes, Sections 43, 66-72)](https://legislative.gov.in/it-act-2000) 
10. [Protection of Women from Domestic Violence Act, 2005](https://legislative.gov.in/pwdva-2005) 

---

## 🚀 Getting Started

Are you ready to spin up the entire suite? PocketJury relies on the Docker Compose network to orchestrate the Web, API, AI, Postgres, and Redis containers automatically.

**Everything you need to clone the repository, generate your security keys, and boot the stack is documented here:**  
📌 **[QUICK_START.md](./QUICK_START.md)**

---

## 🛑 License & Proprietary Rights

This repository and all of its contents are strictly **PROPRIETARY AND CONFIDENTIAL**. No individual or entity is allowed to replicate, clone, sell, distribute, or modify this software under any circumstances. 

**By viewing or interacting with this repository, you are bound by our software agreement:**  
⚖️ **[LICENSE.md](./LICENSE.md)**

---
*Developed by Mohammed Parvez (GitHub: @Vezz-z)*
*Contact: mohammedparvezofficial@gmail.com*
