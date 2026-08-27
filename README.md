# Life Stack 2.0 ⚡

**Life Stack** is a local-first desktop life operating system designed for high-cognitive focus, research synthesis, and execution tracking across a 4-tier hierarchy: **Sectors → Active Epics → Explore Research Topics → Next Actions & Today Focus**.

It runs 100% locally with an embedded SQLite vector database (`sqlite-vec`) and optional local Ollama AI co-pilot.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your computer:
1. **Node.js** (v18, v20, or v22 recommended)
   - Download from: [nodejs.org](https://nodejs.org)
   - Check in your terminal: `node -v` and `npm -v`
2. **Git**
   - Check in your terminal: `git --version`
3. *(Optional, for AI Chat & Vector Search)* **Ollama**
   - Download from: [ollama.com](https://ollama.com)
   - Pull the embedding model: `ollama pull nomic-embed-text`
   - Pull your preferred conversational model (e.g. `ollama pull llama3.2` or `ollama pull gemma2:2b`)

> [!NOTE]
> You **do NOT** need to install Electron globally. Electron is bundled and installed automatically as a local project dependency during `npm install`.

---

## 🚀 Quickstart: Step-by-Step Installation

### 1. Clone the Repository
```bash
git clone https://github.com/sangnovamoqapi/Life-Stacker.git
cd Life-Stacker
```

### 2. Install Dependencies & Build Native SQLite Modules
Run `npm install`. This installs all packages and automatically compiles the native SQLite drivers (`better-sqlite3` and `sqlite-vec`) for Electron via `electron-builder install-app-deps`:
```bash
npm install
```

---

## 💻 Running the App

### Option A: Development Mode (Live Hot Reloading)
To launch the app with live reload and Vite dev server:
```bash
npm run dev
```

### Option B: Build & Run Packaged Binary (Production)

#### On Windows:
```bash
# 1. Build the production package
npm run build:win

# 2. Launch the application
start "" "dist\win-unpacked\Life Stacker.exe"
```

#### On macOS:
```bash
# 1. Build the production package
npm run build:mac

# 2. Launch the application
open "dist/mac/Life Stacker.app"
```

#### On Linux:
```bash
# 1. Build the production package
npm run build:linux

# 2. Launch the AppImage/Binary
./dist/*.AppImage
```

---

## 🧪 Testing & Verification

To run the automated SQLite invariant and database edge-case test suite:
```bash
npx electron tests/db_edge_cases.test.mjs
```

To run the end-to-end Playwright UI test suite:
```bash
npx playwright test tests/electron_ui_qa.spec.ts
```

---

## 🗂️ Project Structure

```text
LifeStacker/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── db/               # SQLite schema, migrations & vector memory
│   │   ├── ai/               # Local Ollama client & conversational tool engine
│   │   ├── ipc/              # IPC channels & native dialogs
│   │   └── index.ts          # Window management & media:// streaming protocol
│   ├── preload/              # Secure context isolation bridge (window.api)
│   └── renderer/             # React 18 frontend
│       ├── views/            # Overview (2×2 Grid), Lanes, Calendar, Chat, Stats
│       ├── components/       # ActionDiffCard, ItemModal, FocusStrip, InteractiveTour
│       └── state/            # AppContext global state store
├── docs/                     # System architecture & visual architecture atlas
└── tests/                    # Invariant edge-case & Playwright E2E suites
```

---

## 🛠️ Troubleshooting

- **Native Module Compilation Error (`better-sqlite3` version mismatch)**:
  If you ever update Node.js or Electron versions, rebuild native dependencies:
  ```bash
  npx electron-builder install-app-deps
  ```
- **Local AI Offline Indicator in Top Bar**:
  Verify Ollama is running locally:
  ```bash
  ollama serve
  ```
  And make sure the embedding model is installed:
  ```bash
  ollama pull nomic-embed-text
  ```