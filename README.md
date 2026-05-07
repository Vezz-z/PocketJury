# PocketJury Landing Page (`apps/web`)

This folder contains the official landing page for **PocketJury**, utilizing a stripped-down version of the original Next.js architecture to provide an exact replica of the original dashboard interface.

## Features

- **Next.js 14 App Router:** High performance, modern framework setup.
- **Multilingual UI:** Complete localization support for English (`en`), Hindi (`hi`), Tamil (`ta`), and Bengali (`bn`) utilizing `next-intl` and comprehensive JSON locale dictionaries (`src/messages/`).
- **Interactive Toasts:** The "Get Started" and "Log In" action buttons trigger localized "app in development" toast notifications seamlessly via `sonner`.
- **Premium Aesthetics:** TailwindCSS and Framer Motion integration powers dynamic layouts and micro-animations, along with built-in dark/light theme switching.

## Directory Structure

```text
pocket-jury/
├── .gitignore
├── DEPLOY.md            # Comprehensive guide for Vercel deployment
├── README.md
└── apps/
    └── web/
        ├── package.json
        ├── tailwind.config.js
        └── src/
            ├── app/             # Next.js App Router (Layouts & Pages)
            ├── components/      # UI components (Header, Footer, Icons)
            └── messages/        # i18n translation strings (.json)
```

## Run locally

From the `apps/web` directory:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Deployment

This project is hosted on Vercel, [Click here](https://pocket-jury.vercel.app). 
