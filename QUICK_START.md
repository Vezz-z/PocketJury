# 🚀 PocketJury: Complete Setup & Quick Start Guide

Welcome! This guide is an exhaustive, step-by-step walkthrough to get the entire PocketJury microservice stack (Next.js Web, Node.js API, Python AI, PostgreSQL, and Redis) running locally on your hardware.

Even if you don't have extensive DevOps experience, following these steps strictly will result in a fully functional AI Legal Assistant in minutes.

---

## ⚠️ 1. System Prerequisites

Before you begin, verify that your machine has the following software installed:
- **Git** (to clone the source code)
- **Docker Desktop** (to run the containerized application). Ensure the Docker daemon is running in the background.
- **Node.js (v20+)** (optional, but highly recommended for generating cryptographic keys natively).
- **Open Ports**: Ensure that your local ports `3000` (Web), `3001` (API), `8000` (AI), `5432` (Postgres), and `6379` (Redis) are open and not blocked by another application.

---

## 📥 2. Clone the Repository

Open your terminal or command prompt and clone the master branch natively from GitHub:

```bash
git clone https://github.com/Vezz-z/Pocket-Jury.git
cd Pocket-Jury
```

---

## 🔑 3. Generating Cryptographic Keys (.pem files)

PocketJury uses advanced Asymmetric RSA-256 Encryption for its JSON Web Tokens (JWT) to secure user authentication. You cannot proceed without generating a Private and Public PEM key pair.

**How to generate the keys (Linux/Mac/Bash):**

```bash
# 1. Generate the RSA Private Key (jwt_private.pem)
openssl genrsa -out jwt_private.pem 2048

# 2. Extract the Public Key from the Private Key (jwt_public.pem)
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# 3. Display keys formatted precisely for .env (copy these into .env)
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' jwt_private.pem; echo
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' jwt_public.pem; echo
```

**How to generate the keys (Windows PowerShell):**
If you have Git for Windows installed, you can use its bundled OpenSSL:
```powershell
& "C:\Program Files\Git\usr\bin\openssl.exe" genrsa -out jwt_private.pem 2048
& "C:\Program Files\Git\usr\bin\openssl.exe" rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Display keys formatted for .env (copy these into .env)
Write-Host "=== JWT_PRIVATE_KEY ==="
(Get-Content jwt_private.pem -Raw) -replace "`r`n", "\n" -replace "`n", "\n"
Write-Host ""
Write-Host "=== JWT_PUBLIC_KEY ==="
(Get-Content jwt_public.pem -Raw) -replace "`r`n", "\n" -replace "`n", "\n"
```

---

## 🔐 4. The Global Environment File (`.env`)

PocketJury relies on a single master `.env` file at the root of the project to feed variables simultaneously into the UI, Backend, and AI containers.

1. In the root directory, you will see a file named `.env.example`.
2. **Duplicate/Rename** this file and save it as `.env`.
3. Open your new `.env` file and populate it using the precise guidelines below:

### Example `.env` Configuration:

```env
# ==========================================
# 🛑 CORE DATABASE CONNECTIONS
# DO NOT CHANGE the localhost parts if running via Docker
# ==========================================
POSTGRES_USER=pocketjury
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=pocketjury
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public

REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# ==========================================
# 🛡️ AUTHENTICATION SECRETS
# ==========================================
# IMPORTANT: The JWT Keys MUST be a single line containing literal \n strings!
# Paste the output from your Awk or PowerShell command above:
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----"

# Random string for NextAuth session encryption
NEXTAUTH_SECRET=generate_a_random_32_character_string_here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional — for "Continue with Google" button)
# Create credentials at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# ==========================================
# 🔒 ENCRYPTION
# ==========================================
# 32+ character random string for AES-256 field-level encryption
ENCRYPTION_KEY=generate_a_random_64_hex_character_string_here

# ==========================================
# 🤖 AI PIPELINE CREDENTIALS
# ==========================================
# The API gateway container URL (leave as is)
AI_SERVICE_URL=http://ai:8000

# OpenRouter (Cloud LLM) Setup
# 1. Go to https://openrouter.ai/keys and create an account
# 2. Generate a free API Key and paste it below:
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxx
LLM_MODEL_ID=openai/gpt-oss-120b:free

# (NOTE: If you want to use Local Ollama instead of OpenRouter, comment out OPENROUTER_API_KEY and uncomment the block below. Read LLM.md for details!)
# OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
# LLM_MODEL_ID=llama3.1:8b

# Optional: For better translation mapping
GOOGLE_TRANSLATE_API_KEY=your_google_cloud_api_key_here

# Leave embedding models as default:
LEGAL_EMBEDDING_MODEL=intfloat/multilingual-e5-large
QUERY_EMBEDDING_MODEL=intfloat/multilingual-e5-large

# ==========================================
# ⚙️ APPLICATION PORTS
# ==========================================
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DOMAIN=localhost
LOG_LEVEL=debug
```

*(Note: Your `.env` and `*.pem` files are strictly isolated by our `.gitignore` and will never accidentally upload to GitHub).*

---

## 🐳 5. Booting the Full Stack via Docker

Once your `.env` is saved and your `.pem` files are in the root directory, you are ready for liftoff.
PocketJury utilizes cache-optimized multi-stage Dockerfiles to build the entire suite efficiently.

### First-Time Build
Run this command from the root directory:
```bash
docker compose up --build -d
```
> ⏱️ **First build** will take several minutes to download Python packages (~2GB for PyTorch + sentence-transformers) and Node modules. This is a one-time cost.

### Subsequent Builds (After Code Changes)
For everyday development, the Dockerfiles are optimized to **skip dependency installation** when only source code changes. Dependencies are only re-downloaded if `package.json` or `requirements.txt` are modified.

```bash
# Recommended: Rebuild only the service(s) you changed
docker compose up --build -d api        # Only rebuild the API service
docker compose up --build -d ai         # Only rebuild the AI service
docker compose up --build -d web        # Only rebuild the Web frontend

# Rebuild everything (still fast — cached deps are reused)
docker compose up --build -d
```

### What happens now?
On first boot, Docker spins up:
1. **`pocketjury-postgres`**: Boots the database, applies migrations, and automatically seeds the *Constitution of India* and *BNS 2023* semantic vectors for the AI to read. (Reference: **[LEGAL.md](./LEGAL.md)**).
2. **`pocketjury-redis`**: Boots the cache layer for JWT debouncing and rate limits.
3. **`pocketjury-api`**: Starts the internal Express Gateway.
4. **`pocketjury-ai`**: Pulls the massive HuggingFace `e5-large` translation models into memory to process queries.
5. **`pocketjury-web`**: Compiles the Next.js React frontend.

---

## 🌐 6. Access the Platform

Once the containers register as **`Healthy`** / **`Running`** in your Docker Desktop dashboard, the application is live:

- **Frontend User Interface:** [http://localhost:3000](http://localhost:3000)
- **Backend API Gateway:** [http://localhost:3001](http://localhost:3001)

### Debugging & Checking Logs
If the AI is taking a long time to respond, it is likely still downloading the HuggingFace models in the background. You can watch the live terminal logs directly:
```bash
# View the live stream from the Python AI Engine
docker compose logs -f ai

# View the live stream from the Node.js API
docker compose logs -f api
```

---

## 🛑 7. Shutting Down & Erasing Data

If you want to gracefully stop the servers without deleting your user accounts or chat history:
```bash
docker compose down
```

**Erasing User Data (Kill Switch):**
If you need to instantly remove all user accounts, profiles, chat histories, and logs without affecting the core knowledge base (laws and documents), run this command while the database is running:
```bash
docker exec -it pocketjury-postgres psql -U pocketjury -d pocketjury -c "TRUNCATE TABLE users CASCADE;"
```

**Erasing the Entire Database:**
If you made a catastrophic error and want to completely nuke the Postgres Database and Redis caches to start perfectly fresh:
```bash
docker compose down --volumes
```

---
*For information on the technical Local LLM architecture, read **[LLM.md](./LLM.md)**.*  
*For legal ownership rights regarding this source code, read **[LICENSE.md](./LICENSE.md)**.*
