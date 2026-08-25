# LifeStack 2.0 — System Definition

_**LifeStack 2.0 System Definition & Architecture Map.** Built from the single source of truth in `docs/atlas/data.mjs`._

_Question status: **2 open · 8 resolved**._

## One paragraph

LifeStack is a local-first desktop life operating system built on a 4-tier hierarchy: broad life Sectors, up to 5 concurrent Active Epics (with planning horizons), Explore Research topics (for discovery/findings), and concrete Next Actions (with daily Today focus). It integrates an in-process SQLite vector engine (sqlite-vec + nomic-embed-text) for instant semantic memory search and connects to local Ollama LLMs for conversational planning, human-in-the-loop diff cards, and automated research-to-action synthesis.

## Decisions locked

| Axis | Decision | ADR |
|---|---|---|
| Stack Structure | Auto-Stack priority ordering across all sectors rather than isolated Kanban columns | [ADR 001](../ARCHITECTURE_DECISIONS.md#adr-001-auto-stack-ordering-vs-manual-queueing) |
| Visual Design | Mathematically linked glass-intensity token scale coupling background opacity to blur radius | [ADR 003](../ARCHITECTURE_DECISIONS.md#adr-003-unified-linked-glass-intensity-token-scale-amendment-6) |
| Media Engine | HTTP 206 partial content byte-range streaming via custom media:// protocol handler | [ADR 004](../ARCHITECTURE_DECISIONS.md#adr-004-http-206-partial-content-range-streaming-for-media) |
| Vector Search | In-process vector search using sqlite-vec virtual tables and local nomic-embed-text | [ADR 007](../ARCHITECTURE_DECISIONS.md#adr-007-out-of-band-vector-embedding-with-sqlite-vec--nomic-embed-text-amendment-7) |
| Vector Alignment | Asymmetric task prefixes (search_query vs search_document) for short-query vector calibration | [ADR 011](../ARCHITECTURE_DECISIONS.md#adr-011-asymmetric-nomic-task-prefixes--vector-backfill-amendment-14) |
| AI Safety | Zero direct AI database writes; all mutations require human-in-the-loop ActionDiffCards | [ADR 012](../ARCHITECTURE_DECISIONS.md#adr-012-conversational-item-management--mandatory-human-in-the-loop-diff-cards-amendment-15--16) |
| Focus Recovery | Global DOM unmount blur monkey-patch and pointerdown capture to prevent Chromium input locking | [ADR 013](../ARCHITECTURE_DECISIONS.md#adr-013-global-focus-recovery--input-lock-prevention) |
| Data Model | 4-Tier Hierarchy (Sectors → Epics with Horizons → Explore Topics → Next Actions → Today) | [ADR 014](../ARCHITECTURE_DECISIONS.md#adr-014-4-tier-hierarchical-data-model-phase-0) |
| Progress Tracking | Dual computed meters (Research % and Execution %) with active cap (5) and ParkSwapModal | [ADR 015](../ARCHITECTURE_DECISIONS.md#adr-015-dual-progress-meters--stage-classification-phase-1) |
| Overview Layout | 2×2 Tactical Command Grid with staleness sorting for Explore and quick-win sorting for Next | [ADR 016](../ARCHITECTURE_DECISIONS.md#adr-016-22-tactical-command-grid--tri-modal-sorting-phase-2) |
| AI Synthesis | Automated synthesis from Explore research notes to staged Next actions with atomic batch commit | [ADR 017](../ARCHITECTURE_DECISIONS.md#adr-017-explore-to-next-ai-synthesis--atomic-batch-staging-phase-3) |
| Pace & Horizon | Non-alerting velocity calculation and discretionary capacity modeling (28h/week) | [ADR 018](../ARCHITECTURE_DECISIONS.md#adr-018-derived-pace-burn-tracking-engine--discretionary-capacity-phase-4) |
| AI Model Choice | Dynamic Ollama /api/tags discovery, custom tag selector, and 4-tier native tool calling | [ADR 020](../ARCHITECTURE_DECISIONS.md#adr-020-dynamic-local-ai-model-selector--4-tier-assistant-architecture) |
| Interactive Tour | Dynamic SVG spotlight walkthrough with deferred roadmap for Lanes re-visualization and Stats revamp | [ADR 021](../ARCHITECTURE_DECISIONS.md#adr-021-interactive-ui-walkthrough--deferred-screen-roadmap-lanes--stats-revamps) |
| Theme Architecture | Flat warm-neutral minimal token system with instant runtime light/dark switching and WCAG AA contrast | [ADR 022](../ARCHITECTURE_DECISIONS.md#adr-022-flat-warm-neutral-minimal-dual-mode-token-system--runtime-theme-switching) |

## Cost model

**Local-First / Zero Cloud Cost**
- **Database & Vectors:** Embedded SQLite + `sqlite-vec` (0 cloud API costs, 100% offline).
- **AI Inference:** Local Ollama running on user hardware (Gemma 2B, Llama 3.2, Qwen 2.5).
- **Memory Footprint:** ~85MB RAM baseline, zero background CPU drain.
## Deep dives

See [ARCHITECTURE_DECISIONS.md](../ARCHITECTURE_DECISIONS.md) for complete historical decision records.

## Reading order (the atlas chapters)

1. **The Core 4-Tier Foundation** — LifeStack organizes goals across 4 distinct levels: Sectors, Epics with Horizons, Explore Research, and Next Actions. _(adds UI, ST, IPC, APP, DB)_
2. **Semantic Memory & Vector Search** — In-process vector embeddings allow instant conceptual search and AI context retrieval. _(adds VEC)_
3. **Local AI Assistant & Diff Cards** — Conversational planning co-pilot running 100% locally via Ollama with human-in-the-loop diff cards. _(adds AI, AST)_
4. **Research Synthesis & Tactical Execution** — Bridging the gap between open-ended discovery and concrete execution. _(adds SYN, PAC)_
5. **Designed for Later: Cloud & Mobile Sync** — Architectural blueprint for encrypted multi-device synchronization. _(adds GHO)_
6. **The Whole LifeStack 2.0 System** — The complete LifeStack 2.0 desktop architecture for free exploration.

## Structures

### Renderer & Glass UI

#### UI · Renderer GUI

**In one line.** The frosted-glass desktop interface rendering views, modals, and focus strips.

**What it does.** React 18 frontend with custom Tailwind tokens, continuous frosted glass backdrop blur, and interactive views (Lanes, 2×2 Tactical Overview, Today Focus, Settings, AI Chat).

**How it's built.** Rendered in Chromium web frame. Communicates strictly across context isolation boundaries via `window.api`.

**Steps in execution.**

1. **Mount** — Load settings, sectors, epics, explore topics, and next items into memory.
2. **Render Views** — Switch seamlessly between Lanes view, Overview 2×2 Grid, and Chat.
3. **User Action** — Dispatch IPC invoke requests for data mutations or AI generation.

**Questions.**

- ~~**Q-UI1** How to prevent input lock when modals unmount?~~ ✓ Global DOM unmount monkey-patch and pointerdown capture hook in main.tsx (ADR 013).

#### ST · State Store

**In one line.** Central reactive React context providing optimistic updates and audio feedback.

**What it does.** Holds cached sectors, items, explore lists, next lists, and active settings in memory with global refresh triggers and notification toasts.

**How it's built.** Implemented in `AppContext.tsx` with `refreshAll()` and lightweight UI state handlers.

**Steps in execution.**

1. **Load Initial** — Fetch all database records on application startup.
2. **Optimistic Diff** — Update UI immediately when actions are toggled or accepted.
3. **Audio Cue** — Play subtle audio feedback on task completion.

### Desktop Runtime & IPC Hub

#### IPC · IPC Hub

**In one line.** Secure context isolation bridge between Chromium renderer and Node main process.

**What it does.** Exposes type-safe APIs for items, explore topics, next actions, local AI, and system settings.

**How it's built.** Preload script using Electron `contextBridge.exposeInMainWorld('api', ...)` backed by `ipcMain.handle`.

**Steps in execution.**

1. **Receive Invoke** — Validate incoming arguments from renderer window.
2. **Execute Handler** — Dispatch request to database helper or AI process.
3. **Return Result** — Serialize and return result payload to renderer.

#### APP · Electron Main

**In one line.** The desktop runtime managing windows, protocols, and background schedules.

**What it does.** Node.js host process managing app lifecycle, single instance lock, custom media streaming protocol, and scheduled weekly reviews.

**How it's built.** Coded in `src/main/index.ts` and `scheduler.ts`.

**Steps in execution.**

1. **App Ready** — Initialize SQLite database, load sqlite-vec, and register media:// protocol.
2. **Create Window** — Launch BrowserWindow with native titlebar and dark background.
3. **Background Jobs** — Run weekly stack review check and periodic Ollama health polling.

**Questions.**

- ~~**Q-APP1** How to stream large local video backgrounds without freezing?~~ ✓ HTTP 206 byte-range streaming in media:// protocol handler (ADR 004).

### Storage & Vector Index

#### DB · 4-Tier SQLite

**In one line.** Relational SQLite storage enforcing the 4-tier life stack schema.

**What it does.** Fast embedded SQLite database storing Sectors, Epics (with Horizons), Explore Topics, Next Actions, Effort Logs, and Settings.

**How it's built.** Powered by `better-sqlite3` in WAL mode in `src/main/db/` with foreign keys and cascade deletions.

**Steps in execution.**

1. **Transaction Begin** — Execute atomic reads/writes in <5ms.
2. **Integrity Guard** — Enforce deletion constraints on Explore cards with active child Next items.
3. **Index Hook** — Trigger background vector memory re-indexing after mutating writes.

**Questions.**

- ~~**Q-DB1** How are schema migrations handled safely?~~ ✓ Automatic declarative migrations on startup in schema.ts (ADR 009, ADR 014).

#### VEC · Vector Memory

**In one line.** In-process semantic vector index powered by sqlite-vec and 768d embeddings.

**What it does.** Stores vector chunks for items and notes to enable debounced hybrid conceptual search and AI context retrieval.

**How it's built.** Virtual table `vec0(vector float[768] distance_metric=L2)` with asymmetric task prefixes (`search_document:` vs `search_query:`).

**Steps in execution.**

1. **Embed Text** — Call local nomic-embed-text to convert item text into 768-dim float vector.
2. **Insert vec0** — Store vector embedding directly inside SQLite virtual table.
3. **KNN Query** — Retrieve top-K semantically related items within L2 distance cutoff (22.35).

**Questions.**

- ~~**Q-VEC1** Why use asymmetric task prefixes?~~ ✓ Aligns query vectors with document vectors in nomic-embed-text embedding space (ADR 011).

### Local AI & Cognitive Engine

#### AI · Ollama Engine

**In one line.** Local inference engine running open-source models for chat, embeddings, and synthesis.

**What it does.** Locally hosted LLM server (http://127.0.0.1:11434) executing chat turns, JSON generation, and embedding computations.

**How it's built.** Communicates over HTTP API (`/api/tags`, `/api/chat`, `/api/generate`, `/api/embeddings`).

**Steps in execution.**

1. **Health Poll** — Verify server connectivity and pulled models every 5 seconds.
2. **Tool Chat** — Process chat prompts against 4-tier tool schemas with preferred model.
3. **Embed Chunks** — Generate 768-dimensional embeddings via nomic-embed-text.

**Questions.**

- ~~**Q-AI1** Can users select custom or fine-tuned model tags?~~ ✓ Yes, dynamic model discovery from /api/tags and custom tag input in SettingsView (ADR 020).

#### AST · Chat Assistant

**In one line.** Conversational planning assistant with human-in-the-loop pending diff cards.

**What it does.** Translates natural user goals into structured tool calls (items_create, explore_create, next_items_create) and renders editable diff cards for confirmation.

**How it's built.** Implemented in `src/main/ai/chat.ts` with fail-soft normalizers and `ActionDiffCard.tsx`.

**Steps in execution.**

1. **User Prompt** — Send conversational prompt and stack context to Ollama.
2. **Intercept Call** — Intercept tool call arguments and save as pending_action row.
3. **Render Diff Card** — Display interactive card in chat with Explore & Next action editors.
4. **User Confirmation** — Commit reviewed changes into SQLite upon clicking Accept.

**Questions.**

- ~~**Q-AST1** How to prevent direct AI overwrites?~~ ✓ Zero direct AI database writes; all tool calls create pending_actions (ADR 012).

#### SYN · AI Synthesizer

**In one line.** Distills unstructured Explore research notes into concrete Next Actions.

**What it does.** Reads research questions, findings, and hypotheses from Explore cards and generates 2-4 executable next tasks with estimated effort.

**How it's built.** Executed via `generateDraftNextItems()` in `ollama-client.ts` and staged in `ItemModal.tsx`.

**Steps in execution.**

1. **Extract Notes** — Read title and research notes from target Explore card.
2. **Generate Actions** — Call Ollama with JSON output schema for concise verb-noun steps.
3. **Stage Sandbox** — Present editable draft rows in ItemModal for user review.
4. **Batch Commit** — Atomically insert approved actions into next_items table.

**Questions.**

- ~~**Q-SYN1** What happens if Ollama is offline?~~ ✓ Fall back to heuristic regex extraction of bullet points from notes (ADR 017).

### Tactical Workflow Engine

#### PAC · Pace & Horizon

**In one line.** Calculates project velocity and horizon consumption without stressful alerts.

**What it does.** Analyzes weekly logged effort against Epic planning horizons to derive elapsed percentage and velocity pace.

**How it's built.** Implemented in `src/main/db/pace.ts` and displayed across Dual Progress meters and effort tabs.

**Steps in execution.**

1. **Read Logs** — Aggregate actual logged effort from effort_log table.
2. **Calculate Burn** — Compute weekly burn rate and compare to time budget horizon.
3. **Derive Elapsed %** — Calculate elapsed time ratio (elapsed / budget) without disruptive alarms.

**Questions.**

- ~~**Q-PAC1** How is capacity modeled?~~ ✓ Configurable weekly_personal_hours (default: 28 hrs/week) modeling discretionary side-project time (ADR 018).

### Designed for, Not Yet Switched On (designed for, not built)

#### GHO · Cloud & Sync _(not switched on)_

**In one line.** Planned: End-to-end encrypted multi-device sync and mobile companion.

**What it does.** Optional encrypted sync layer allowing stack updates and daily Today check-ins from mobile devices.

**How it's built.** Designed for zero-knowledge CRDT sync over encrypted SQLite delta streams.

**Steps in execution.**

1. **Delta Sync** — Export local encrypted SQLite change stream.
2. **Merge CRDT** — Reconcile offline edits across mobile and desktop clients.

**Questions.**

- **Q-GHO1** Encryption key management and secure enclave backup.
- **Q-GHO2** Conflict-free resolution for Today focus reordering.

## Flows (representative packets)

Payload shapes are what the design implies, not measured traffic.

### Explore → Next AI Synthesis

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | UI → IPC | generateNextItems | `{"explore_id":"exp-101","notes":"Investigate Trinity College MSc fees and visa requirements"}` |
| 2 | IPC → SYN | distill_notes | `{"topic":"Trinity MSc","notes":"..."}` |
| 3 | SYN → AI | ollama_generate_json | `{"prompt":"Generate 3 concrete next actions...","format":"json"}` |
| 4 | AI → SYN | json_actions | `{"items":[{"title":"Download course brochure","effort":"1 hr"},{"title":"Check GPA equivalence","effort":"2 hrs"}]}` |
| 5 | SYN → IPC | staged_drafts | `{"drafts":2}` |
| 6 | IPC → UI | render_staging_sandbox | `{"staged_count":2}` |
| 7 | UI → IPC | commit_batch | `{"approved":[{"title":"Download course brochure"}]}` |
| 8 | IPC → DB | insert_next_items | `{"count":1,"parent_explore_id":"exp-101"}` |
| 9 | DB → VEC | index_new_item | `{"text":"search_document: Download course brochure"}` |

### Conversational Planning & Action Diff Card

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | UI → IPC | chat_send | `{"prompt":"Break down my goal to build an AI hardware side hustle"}` |
| 2 | IPC → AST | process_turn | `{"prompt":"..."}` |
| 3 | AST → AI | ollama_chat_tools | `{"tools":["items_create","explore_create","next_items_create"]}` |
| 4 | AI → AST | tool_call | `{"name":"items_create","args":{"title":"AI Hardware Venture","explore_topics":["Compare Jetson vs Coral"],"next_items":["Order dev board"]}}` |
| 5 | AST → DB | insert_pending_action | `{"status":"pending"}` |
| 6 | AST → IPC | chat_delta | `{"has_pending_action":true}` |
| 7 | IPC → UI | render_diff_card | `{"title":"AI Hardware Venture","explore_count":1,"next_count":1}` |
| 8 | UI → IPC | accept_action | `{"action_id":"act-402"}` |
| 9 | IPC → DB | commit_epic_and_children | `{"epic":"AI Hardware Venture"}` |
| 10 | DB → ST | refresh_all | `{"success":true}` |

### Hybrid Substring & Semantic Search

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | UI → IPC | search_keystroke | `{"query":"anxious about visa"}` |
| 2 | IPC → DB | instant_text_match | `{"query":"anxious"}` |
| 3 | DB → UI | instant_text_results | `{"matches":0}` |
| 4 | IPC → AI | embed_query | `{"text":"search_query: anxious about visa"}` |
| 5 | AI → VEC | knn_search | `{"vector":"[768 floats]","k":8}` |
| 6 | VEC → IPC | semantic_hits | `{"hits":[{"id":"exp-101","title":"Stamp 1G Visa Research","distance":18.2}]}` |
| 7 | IPC → UI | append_semantic_matches | `{"marker":"✦ related to your search"}` |

### Step Completion & Pace Recalculation

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | UI → IPC | complete_next_item | `{"item_id":"nxt-505","actual_effort":"2.5 hrs"}` |
| 2 | IPC → DB | update_step_and_effort | `{"is_done":1,"logged_hrs":2.5}` |
| 3 | DB → PAC | recalculate_velocity | `{"epic_id":"ep-001"}` |
| 4 | PAC → DB | update_pace_metrics | `{"elapsed_pct":35,"burn_rate":"4.2 hrs/wk"}` |
| 5 | DB → ST | sync_meters | `{"research_pct":100,"exec_pct":66}` |
| 6 | ST → UI | render_progress_rings | `{"execution_meter":"66%"}` |

## Questions — index

Reference by ID. ✓ resolved (with date) · otherwise open.

- ~~**Q-UI1**~~ (UI) ✓ Global DOM unmount monkey-patch and pointerdown capture hook in main.tsx (ADR 013).
- ~~**Q-APP1**~~ (APP) ✓ HTTP 206 byte-range streaming in media:// protocol handler (ADR 004).
- ~~**Q-DB1**~~ (DB) ✓ Automatic declarative migrations on startup in schema.ts (ADR 009, ADR 014).
- ~~**Q-VEC1**~~ (VEC) ✓ Aligns query vectors with document vectors in nomic-embed-text embedding space (ADR 011).
- ~~**Q-AI1**~~ (AI) ✓ Yes, dynamic model discovery from /api/tags and custom tag input in SettingsView (ADR 020).
- ~~**Q-AST1**~~ (AST) ✓ Zero direct AI database writes; all tool calls create pending_actions (ADR 012).
- ~~**Q-SYN1**~~ (SYN) ✓ Fall back to heuristic regex extraction of bullet points from notes (ADR 017).
- ~~**Q-PAC1**~~ (PAC) ✓ Configurable weekly_personal_hours (default: 28 hrs/week) modeling discretionary side-project time (ADR 018).
- **Q-GHO1** (GHO) Encryption key management and secure enclave backup.
- **Q-GHO2** (GHO) Conflict-free resolution for Today focus reordering.

## What the platform gives vs what we own

**Platform gives:** Electron desktop runtime, Chromium GPU frosted-glass compositor, native OS notifications, WebRTC camera capture.

**We own:** 4-tier relational schema, dual-progress meters, sqlite-vec memory pipeline, Ollama tool-calling interceptor with interactive diff cards, 2×2 tactical command grid, and derived horizon pace engine.

## Planned filesystem

```
LifeStacker/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── db/               # SQLite tables & sqlite-vec setup
│   │   ├── ai/               # Ollama client, chat tools, memory embeddings
│   │   ├── ipc/              # IPC handlers
│   │   └── index.ts          # Window management, media:// protocol
│   ├── preload/              # Context isolation bridge (window.api)
│   └── renderer/             # React 18 frontend
│       ├── views/            # LanesView, OverviewView, SettingsView, Chat
│       ├── components/       # ActionDiffCard, ItemModal, FocusStrip
│       └── state/            # AppContext (reactive global store)
├── docs/                     # Architecture documentation & System Atlas
└── tests/                    # Playwright E2E & direct DB invariant tests
```

## How this file is maintained

Generated from `docs/atlas/data.mjs` by `node docs/atlas/build.mjs`, which also builds the interactive atlas (`atlas.html`). Edit the data file, rebuild, republish — never edit this file by hand.
