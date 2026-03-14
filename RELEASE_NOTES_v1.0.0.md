# 🚀 PocketJury v1.0.0 Release Notes
**Date: March 1st, 2026**

We are thrilled to announce the official `v1.0.0` launch of **PocketJury**! This milestone release marks the culmination of an intensive engineering cycle dedicated to building a hyper-accurate, hallucination-free, AI legal assistant tailored specifically for the nuance of the Indian Judiciary System.

PocketJury has been built from the ground up as an offline-capable, highly secure microservice architecture utilizing state-of-the-art Natural Language Processing.

## 🌟 Major Highlights

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
- PocketJury `v1.0.0` leverages **TurboRepo** and sophisticated Docker Compose structuring to instantly boot all 5 required services (PostgreSQL, Redis, AI, API, Web) with a single command: `docker compose up --build -d`.

---

## 🛠️ Developer Resources
- **[QUICK_START.md](./QUICK_START.md)**: Exhaustive instructions on cloning the repository, generating the RSA `.pem` keys, and correctly formatting the global `.env` configuration.
- **[README.md](./README.md)**: Overarching storefront documentation on the architecture and feature set.
- **[LLM.md](./LLM.md)**: A deep-dive explicitly detailing how to disconnect PocketJury from the Cloud and run it 100% locally via **Ollama**.
- **[LEGAL.md](./LEGAL.md)**: The structural manifesto detailing exactly which government links and texts are injected into the Vector Database.

*(Note: PocketJury is a proprietary codebase owned by Mohammed Parvez (`@Vezz-z`). Reproduction, deployment, or commercial usage is strictly bound by the limitations listed in the EULA file, `LICENSE.md`).*
