# LifeStack Architecture Decision Records (ADR)

This document tracks all foundational architecture, design, and engineering decisions made during the development of LifeStack.

---

## ADR 001: Auto-Stack Ordering vs. Manual Queueing
- **Date**: 2026-08-14
- **Decision**: Tasks are organized strictly in a continuous, prioritized global stack (Life Stack) ordered by `priority_rank` across all sectors, rather than isolated Kanban backlog columns.
- **Rationale**: Humans struggle to balance multiple disconnected backlogs. A single unified sequential stack creates clear focus where only the top items demand attention at any given moment.

---

## ADR 002: Simplified Technical English (ASD-STE100)
- **Date**: 2026-08-14
- **Decision**: All system copy, button labels, tooltips, warnings, and prompts adhere to ASD-STE100 principles (concise, active voice, non-ambiguous, single meaning per word).
- **Rationale**: Minimizes cognitive load and eliminates ambiguous interface wording.

---

## ADR 003: Unified Linked Glass-Intensity Token Scale (Amendment 6)
- **Date**: 2026-08-16
- **Decision**: Replaced binary transparency toggle with a continuous `glass_intensity` scale (0–100, default 65) where background opacity and blur radius are mathematically linked:
  $$\text{opacity} = \text{lerp}(0.85, 0.35, \text{intensity} / 100)$$
  $$\text{blur} = \text{lerp}(4\text{px}, 24\text{px}, \text{intensity} / 100)$$
- **Rationale**: Opacity and blur must never be decoupled. Increasing transparency without increasing blur bleeds sharp background detail into text, harming legibility. Dynamic CSS injection on the application root ensures real-time re-rendering across all surfaces.

---

## ADR 004: HTTP 206 Partial Content Range Streaming for Media
- **Date**: 2026-08-17
- **Decision**: Implemented native Node.js byte-range streaming in the `media://` custom protocol handler with `Accept-Ranges: bytes` and `Content-Range: bytes START-END/TOTAL`.
- **Rationale**: Chromium's media pipeline buffers large MP4/WebM videos in chunks and requires HTTP 206 responses to seek, buffer beyond 10 seconds, and loop seamlessly without freezing. Standardized URL format to `media://app/{encodedPath}`.

---

## ADR 005: Live Camera as Dynamic Background Feed
- **Date**: 2026-08-17
- **Decision**: Supported live webcam streaming directly into the root background layer beneath the frosted glass UI using WebRTC `getUserMedia` with natural horizontal mirror mode (`scale-x-[-1]`) and multi-camera device selection.
- **Rationale**: Allows ambient self-awareness and aesthetic background depth. Automatic track teardown ensures privacy and 0% background battery drain when switched off.

---

## ADR 006: Canonical Single-Direction Graph Edges (Amendment 7)
- **Date**: 2026-08-18
- **Decision**: Store relationships between items in a single canonical direction only (e.g. `from_item_id depends_on to_item_id`). Inverse relationships (such as "is blocked by") are derived dynamically via query (`to_item_id = X AND relation_type = 'depends_on'`).
- **Rationale**: Storing reciprocal duplicate rows (e.g. both `A depends_on B` and `B blocks A`) creates synchronization hazards where editing or deleting one edge leaves the other stale or orphaned.

---

## ADR 007: Out-of-Band Vector Embedding with `sqlite-vec` & `nomic-embed-text` (Amendment 7)
- **Date**: 2026-08-18
- **Decision**:
  1. Embedded local vector search powered by `sqlite-vec` virtual vector tables (`vec0`, 768 dimensions) embedded directly into the primary SQLite database.
  2. Embeddings generated locally via Ollama with `nomic-embed-text` (768-dim, low VRAM footprint).
  3. Re-embedding triggered fire-and-forget (unawaited) at the conclusion of item write transactions.
- **Rationale**: The core app premise demands zero save delay (<5ms). AI embedding must never block user operations or cause errors if Ollama is closed. Storing vectors inside SQLite avoids managing a separate external vector database.

---

## ADR 008: Dynamic AI Health Polling & Live Error Visibility (Amendment 8)
- **Date**: 2026-08-18
- **Decision**:
  1. Status checks poll without cache every 5 seconds (`cache: 'no-store'`) checking both Ollama server connectivity and `nomic-embed-text` model availability.
  2. Main process maintains in-memory `lastError` tracking capturing network, missing model, and SQLite vector insertion errors.
  3. Exposes `ai:getLastError` IPC to surface exact diagnostic error messages on hover in the TopBar status indicator.
- **Rationale**: Silent embedding failures prevent diagnosis when Ollama is closed or missing the embedding model. Fast uncached polling allows the indicator to reflect real-time service changes without app restarts.

---

## ADR 009: Relational Action Steps & Vertical Spine Progression (Amendment 12)
- **Date**: 2026-08-18
- **Decision**:
  1. Deprecated the single `items.next_action` JSON column in favor of a normalized `action_steps` table (`id`, `item_id`, `content`, `is_done`, `sort_order`, `effort_value`, `effort_unit`, `actual_effort_value`, `actual_effort_unit`, `created_at`, `completed_at`).
  2. Built an interactive vertical step spine visual system in `ItemModal`: circle nodes connected by a vertical line where segments fill amber as steps complete. The first incomplete step is highlighted with bold text and an "Up Next" indicator.
  3. Seamless Effort Logging: Step creation supports optional estimated effort (`effort_value`, `effort_unit`). Each step displays an interactive effort badge (`⏱ 1 hr`), and completing a step (or clicking the badge) triggers the effort logging confirmation modal directly into the global `effort_log` table.
  4. Dominant cards render a compact summary: live completion counter (`1/4 done`), the first undone step with an instant toggle circle node, and its estimated effort badge.
  5. Automatic migration parses and migrates any existing `items.next_action` data into `action_steps` seamlessly on startup.
- **Rationale**: Normalized steps enable instant one-click toggles, step-level reordering, relational vector indexing, integrated time logging, and clean visual progression climbing without rewriting entire parent item records.

---

## ADR 010: Hybrid Search with Instant Text Matching & Debounced Semantic Vectors (Amendment 13)
- **Date**: 2026-08-18
- **Decision**:
  1. Instant Text Substring Matching: Evaluated immediately synchronously on every keystroke across `title`, `sector.name`, `notes`, and all `action_steps.content`.
  2. Additive Debounced Semantic Search: Queries are debounced by 350ms for queries $\ge 3$ characters, calling local vector search via `memory:search`.
  3. Generation Counter Guard: A monotonically increasing generation counter ensures stale async semantic responses from earlier keystrokes are discarded immediately.
  4. Merge & Marker Convention: Text matches are primary and retain stack order; semantic-only matches append with an amber `✦` indicator and hover tooltip `"related to your search"`.
- **Rationale**: Combining instant substring matching with vector memory provides the speed of local string search while allowing conceptual paraphrasing to surface related context without latency or flicker.

---

## ADR 011: Asymmetric Nomic Task Prefixes & Vector Backfill (Amendment 14)
- **Date**: 2026-08-18
- **Decision**:
  1. Updated `embed(text, type: 'query' | 'document')` in `ollama-client.ts` to prepend asymmetric task prefixes:
     - `search_query: ` for query embeddings called during `memory:search`.
     - `search_document: ` for document chunks embedded during `upsertChunksForItem`.
  2. One-Time Vector Backfill: Created `backfillEmbeddings()` gated by `embeddings_version = 1` in `settings` table to re-embed all existing `memory_chunks` with `search_document:` prefix on startup.
  3. Calibrated `L2_DISTANCE_CUTOFF = 22.35` to match Nomic's task-prefixed vector space, ensuring single-word conceptual queries (like "anxious" matching "nervousness") surface reliably.
- **Rationale**: `nomic-embed-text` requires asymmetric task prefixes to align query embeddings with document chunk embeddings. Without prefixes, short queries diverge significantly in vector space from long multi-sentence chunks.

---

## ADR 012: Conversational Item Management & Mandatory Human-in-the-Loop Diff Cards (Amendment 15 & 16)
- **Date**: 2026-08-18
- **Decision**:
  1. Zero Direct AI DB Writes: The AI model can never modify user data autonomously. All mutating tool calls (`items:create`, `items:update`, `action_steps:create`) are intercepted, validated, and stored as `pending_actions` rows with status `'pending'`.
  2. Native Action Steps Integration: Extended `items_create` schema with structured `action_steps: [{ content, effort_value, effort_unit }]` and added dedicated `action_steps_create` tool. The assistant structures multi-step subtasks into normalized relational `action_steps` records instead of dumping numbered text into `notes`.
  3. Action Diff Card UI: Pending actions are rendered inline in the chat conversation as interactive Frosted-Glass Diff Cards with `Accept`, `Reject`, step checklists (`#1`, `#2`), and inline `Edit` controls (allowing direct editing, adding, or deleting steps before acceptance).
  4. Fail-Soft Input Validation & Intelligent Fallbacks: Validates arguments against real sector IDs, progress bounds (0–100), and auto-derives titles/sectors if omitted. Invalid tool calls surface as polite chat feedback rather than broken cards.
  5. Multi-Turn Vector Memory Search: Read-only tool calls (`memory:search`) execute directly, allowing the model to search vectors and answer queries like "What's stale in Health?" with real retrieved context.
  6. Persistence & Atomic Transactions: Parent `chat_messages` is always inserted before child `pending_actions` inside an atomic `db.transaction()` to enforce foreign key integrity across app restarts.
- **Rationale**: Keeps users in total control of their data while enabling conversational task management, discrete checklist parsing, natural retrieval, and inline proposal editing.

---

## ADR 013: Global Focus Recovery & Input Lock Prevention
- **Date**: 2026-08-18
- **Problem**: When a focused input, textarea, or button was unmounted or disabled (such as clicking Reject on an ActionDiffCard, canceling an inline edit, or closing a modal without saving), Chromium's `RenderWidgetHost` lost focus context, causing all typable fields across the entire application to drop keyboard input and cursor events.
- **Decision**:
  1. Global DOM Unmount Hook: Monkey-patched `Node.prototype.removeChild` in `main.tsx` to safely trigger `activeElement.blur()` and `window.focus()` before React detaches any currently focused DOM subtree.
  2. Pointerdown Event Capture: Installed a global `pointerdown` listener on `document` that directly focuses any clicked `INPUT`, `TEXTAREA`, `SELECT`, or `[contenteditable]` element on pointer contact.
  3. Action & Modal Blurs: Added explicit pre-action blurs to `handleReject`, `handleAccept`, `handleToggleEdit`, and `closeModal` before setting `isSubmitting: true` or changing component state.
  4. CSS Hardening: Added `-webkit-app-region: no-drag !important` to all typable inputs, textareas, selects, and buttons in `index.css` to prevent OS window drag regions from capturing click and keystroke events.
- **Rationale**: Completely eliminates orphaned focus and input locking across all component lifecycles, modal transitions, and dynamic card re-renders.

---

## ADR 014: 4-Tier Hierarchical Data Model (Phase 0)
- **Date**: 2026-08-20
- **Decision**: Restructured LifeStack's domain model into a strict 4-tier hierarchy:
  1. **Sectors**: High-level life domains (`Career`, `Health`, `Learning`, `Side Projects`, `Relationships`, `Home & Admin`).
  2. **Active Epics (`items`)**: In-flight goals/initiatives with planning horizon budgets (`items.time_budget`: `{ value, unit }`).
  3. **Explore Topics (`explore_items`)**: Open-ended research, questions, hypotheses, and unstructured findings that require investigation before execution tasks can be defined (`id`, `epic_id`, `title`, `notes`, `time_estimate_value`, `time_estimate_unit`, `closed`, `last_touched_at`, `created_at`).
  4. **Next Items (`next_items`)**: Crisp, concrete execution steps (`id`, `epic_id`, `parent_explore_id`, `title`, `notes`, `status` (`'next'` | `'today'` | `'done'`), `time_estimate_value`, `time_estimate_unit`, `actual_effort_value`, `actual_effort_unit`, `due_date`, `sort_order`, `created_at`, `completed_at`).
- **Integrity Constraints**:
  - Automatically migrated legacy `action_steps` table into `next_items`.
  - Deleting an Explore card with active linked Next items is blocked unless the parent Epic is `done` or Next items are reassigned.
  - Cascading deletion permanently cleans up child Explore and Next items when a parent Epic is deleted.
- **Rationale**: Real-world initiatives divide into two distinct phases: exploratory inquiry (unknowns, comparisons, research) and execution actions (concrete steps). Separating them into relational tiers eliminates the confusion of mixing vague research ideas with executable task backlogs.

---

## ADR 015: Dual Progress Meters & Stage Classification (Phase 1)
- **Date**: 2026-08-21
- **Decision**:
  1. **Dual Track Meters**: Replaced flat percentage slider with independent computed dual progress bars on Epics:
     - **Research Meter**: $\frac{\text{closed explore topics}}{\text{total explore topics}} \times 100\%$
     - **Execution Meter**: $\frac{\text{completed next items}}{\text{total next items}} \times 100\%$
  2. **Computed Stage Badges**: Epics dynamically compute their lifecycle stage without manual status dropdowns:
     - `Researching`: Open explore topics exist with 0 next items.
     - `Executing`: Active next items exist in backlog or today.
     - `Done`: All next items completed.
  3. **Parked / Icebox Active Cap & ParkSwapModal**:
     - Hard cap of 5 concurrent active epics (`active_epic_cap`, default: 5).
     - Epics created beyond the cap or demoted transition to `status = 'parked'`.
     - Implemented `ParkSwapModal` allowing 1-click swapping between parked and active epics.
- **Rationale**: Research and execution have fundamentally different velocities. A dual meter gives instant visual insight into whether an epic is stuck in discovery or actively being executed, while an active cap prevents cognitive overload.

---

## ADR 016: 2×2 Tactical Command Grid & Tri-Modal Sorting (Phase 2)
- **Date**: 2026-08-21
- **Decision**:
  1. **4-Quadrant Overview**: Structured `OverviewView.tsx` into a high-density 2×2 command grid:
     - **Top-Left (Active Epics)**: In-flight epics with dual progress meters and stage badges.
     - **Top-Right (Explore Research Panel)**: Aggregated active explore cards across all epics, sorted by **Staleness** (oldest `last_touched_at` first) to surface neglected research.
     - **Bottom-Left (Next Actions Backlog)**: Aggregated next actions sorted by **Due Date**, then **Effort Value (Ascending)** (quick wins first).
     - **Bottom-Right (Today's Focus)**: Daily execution commitment strictly capped at 3 (`today_cap`), supporting drag-and-drop manual ordering and `TodayBumpModal` when capacity is exceeded.
  2. **Collapsible Grid Panels**: Interactive `[ − ]` / `[ ＋ ]` toggles on all 4 panels with states persisted in `localStorage` (`lifestack_overview_collapsed`).
- **Rationale**: Eliminates endless scrolling across multiple project pages. Provides a unified cockpit where research staleness, execution order, and daily commitment are visible simultaneously.

---

## ADR 017: Explore-to-Next AI Synthesis & Atomic Batch Staging (Phase 3)
- **Date**: 2026-08-22
- **Decision**:
  1. **AI Research Synthesis (`generateDraftNextItems`)**:
     - Extracts unstructured research findings from Explore cards.
     - Passes prompt with `format: 'json'` to local Ollama chat model to generate 2–4 concrete next actions with estimated hours.
     - Fallback heuristic parsing extracts bullet points when Ollama is offline.
  2. **Inline Draft Staging Sandbox**:
     - Generated actions appear in an editable staging sandbox in `ItemModal` before database commitment.
     - Users can modify titles, adjust effort hours, or delete unwanted drafts.
  3. **Atomic Batch Commit (`nextItems:createBatch`)**:
     - All approved draft items are inserted inside a single SQLite transaction with `parent_explore_id` linking.
- **Rationale**: Research notes often become dead ends. Providing an automated bridge from findings to concrete tasks turns research into execution without manual transcription friction.

---

## ADR 018: Derived Pace, Burn Tracking Engine & Discretionary Capacity (Phase 4)
- **Date**: 2026-08-22
- **Decision**:
  1. **Non-Alerting Informational Pace Engine (`pace.ts`)**:
     - Calculates actual weekly burn rate from `effort_log` compared against the Epic's planning horizon (`items.time_budget`).
     - Derives horizon consumption ($\frac{\text{elapsed time}}{\text{budgeted time}}$) and pace velocity.
     - Informational only (no disruptive push alerts), enabled by default (`burn_tracking_enabled: true`).
  2. **Discretionary Capacity Parameter (`weekly_personal_hours`)**:
     - Added setting for weekly personal project hours (default: 28 hrs/week, max: 168).
     - Explicitly defined as discretionary capacity excluding compulsory 9-to-5 employment or school commitments.
- **Rationale**: Gives users a realistic, guilt-free understanding of their project velocity and time horizons without imposing stressful deadlines or productivity anxiety.

---

## ADR 019: Automated Playwright Electron Test Suite & Invariant State Sweep (Phase 6)
- **Date**: 2026-08-23
- **Decision**:
  1. **Direct DB Invariant Suite (`tests/db_edge_cases.test.mjs`)**:
     - Executes natively via Electron Node runner (`ELECTRON_RUN_AS_NODE=1`) to match SQLite native ABI (`NODE_MODULE_VERSION = 130`).
     - Covers 11 edge-case invariants: empty epic completion, task reopening cascade reverting parent Epic to `active`, deletion restrictions on linked explore cards, and today cap bounds.
  2. **Playwright Electron End-to-End Suite (`tests/electron_ui_qa.spec.ts`)**:
     - End-to-end headless and windowed testing across navigation transitions, modal workflows, cramped window layouts, and 0-error exception audits.
- **Rationale**: Guarantee stability, avoid regression across native SQLite bindings, and verify that user interface workflows match strict state invariants.

---

## ADR 020: Dynamic Local AI Model Selector & 4-Tier Assistant Architecture
- **Date**: 2026-08-24
- **Decision**:
  1. **Live Model Discovery & Selection**:
     - IPC bridge `ai:listModels` dynamically queries Ollama `/api/tags`.
     - Settings view renders an interactive model dropdown and custom tag input (e.g. `gemma4:e2b`, `llama3.2:3b`, `qwen2.5:3b`), updating `settings.chat_model`.
     - Bound across both the Chat Assistant (`chat.ts`) and Explore $\to$ Next Generator (`ollama-client.ts`).
  2. **4-Tier LLM Tool Calling & System Prompt**:
     - Upgraded system prompt to explicitly model the 4-Tier Framework (Sectors $\to$ Epics $\to$ Explore Topics $\to$ Next Actions).
     - Added native tools `explore_create` and `next_items_create`, and expanded `items_create` to accept nested `explore_topics` and `next_items`.
  3. **Robust Explore Normalization & Interactive Diff Cards**:
     - Implemented `normalizeExploreTopics()` to handle cases where LLMs provide notes without titles (auto-extracting the first sentence as title).
     - Upgraded `ActionDiffCard.tsx` with dedicated purple `🔬 Explore Topics` and amber `⚡ Next Actions` editors and previews.
- **Rationale**: Gives users complete flexibility to run any local open-source LLM while ensuring the AI understands the distinction between open-ended research and concrete execution steps.

---

## ADR 021: Interactive UI Walkthrough & Deferred Screen Roadmap (Lanes & Stats Revamps)
- **Date**: 2026-08-24
- **Decision**:
  1. **Feature-Flagged Interactive Guided Tour (`InteractiveTour.tsx`)**:
     - Added `feature_interactive_tour` setting to gate onboarding tour behavior.
     - Implemented dynamic spotlight engine with SVG mask cutout (crystal-clear unblurred focus window over target elements with a glowing pulsating ring).
     - Card dynamically tracks element coordinates via `getBoundingClientRect()` and glides smoothly across transitions.
  2. **Deferred Tour Coverage for Lanes & Stats Screens**:
     - **Lanes Screen**: Detailed walkthrough deferred pending planned visual re-visualization and structural hierarchy enhancements of Sector lanes.
     - **Stats Screen**: Walkthrough step deferred pending planned analytics revamp (velocity trends, horizon burn charts, and time distribution metrics).
     - **Roadmap Anchor**: Once the Lanes and Stats view revamps are implemented, corresponding interactive tour stops will be integrated into `TOUR_STEPS`.
- **Rationale**: Keeps the current onboarding tour focused on stabilized 2×2 tactical grid, explore-to-next synthesis, and local AI diff card workflows, avoiding premature onboarding design for views undergoing near-term visualization overhauls.

---

## ADR 022: Flat Warm-Neutral Minimal Dual-Mode Token System & Runtime Theme Switching
- **Date**: 2026-08-25
- **Decision**:
  1. **Dual-Mode CSS Token Architecture (`src/renderer/src/index.css`)**:
     - Replaced frosted-glass blurs, glows, and heavy translucency with crisp, solid `--surface-*` tokens, 1px subtle borders (`--border-subtle`), single-layer soft shadows (`--shadow-soft`), and restrained terracotta accent (`--accent`).
     - **Light Mode (`[data-theme='light']`)**: Warm off-white background (`#f6f4ee`), white card surface (`#ffffff`), 1px light warm borders (`#ded9ce`), near-black warm-gray text (`#1e1c1a`, 14.5:1 contrast), warm slate secondary (`#57534e`, 7.3:1 contrast), muted stone (`#78716c`, 4.6:1 contrast - WCAG AA compliant), terracotta accent (`#c25736`).
     - **Dark Mode (`:root, [data-theme='dark']`)**: Warm dark charcoal background (`#151413`), stone card surface (`#23221f`), 1px subtle dark borders (`#302e2b`), off-white text (`#f3ede2`, 15.2:1 contrast), stone secondary (`#b3aca0`, 7.4:1 contrast), warm stone muted (`#8a8377`, 4.7:1 contrast - WCAG AA compliant), rust terracotta accent (`#d96b43`).
     - Legacy `--glass-*` tokens preserved untouched for zero regression.
  2. **Runtime Dynamic Theme Switcher Engine**:
     - `AppSettings` expanded with `theme_mode?: 'dark' | 'light'`.
     - `AppContext` dynamically manages `themeMode`, `toggleTheme()`, and `setThemeMode()`, setting `document.documentElement.setAttribute('data-theme', themeMode)` and updating root container without page reloads.
     - ☀️/🌙 instant toggle button added to `TopBar` and segmented appearance switcher in `SettingsView`.
  3. **Universal Component Modernization**:
     - Updated all views (`OverviewView`, `LanesView`, `ChatView`, `SettingsView`, `StatsView`) and modals (`Card`, `Lane`, `ItemModal`, `FocusStrip`, `SectorModal`, `HelpModal`, `TodayBumpModal`, `ParkSwapModal`, `ChecklistEffortModal`, `Toast`, `ActionDiffCard`, `InteractiveTour`).
- **Rationale**: Elevates readability and visual clarity with a refined, distraction-free aesthetic while achieving strict WCAG AA contrast compliance and instantaneous dual-mode switching.

---

## ADR 023: Graph Edge Relationships via Conversational AI & Propose-Never-Commit Diff Cards
- **Date**: 2026-08-28
- **Decision**:
  1. **Propose-Never-Commit Diff Card Protocol**:
     - `edges_create` / `edges:create` strictly routes through the identical `pending_action` flow as item creation. No fast-path direct database writes are permitted.
     - Front-end renders interactive directional diff cards (`ActionDiffCard.tsx`) displaying Source Item $\to$ Relation Badge $\to$ Target Item with editable dropdowns, note fields, and Accept/Reject buttons.
  2. **Compact ID-to-Title Index in System Context**:
     - Injected a lightweight `{ id, title, sector, status }` index into the LLM system prompt in `getSystemPrompt()` (`src/main/ai/chat.ts`).
     - Enables single-turn name resolution ("Prepare Presentation depends on Finalize Slides") without lookup tool round-trip latency, preserving `memory_search` strictly for semantic context queries.
  3. **Strict Validation & Vocabulary Defense**:
     - Enforced seed vocabulary: `['depends_on', 'supports', 'contradicts', 'relates_to']`.
     - Non-seed relation types are not silently coerced; the assistant surfaces a plain conversational query asking the user whether to expand the vocabulary.
     - Self-edges (`from_item_id === to_item_id`) are rejected before creating pending actions or diff cards.
- **Rationale**: Keeps relational graph structuring safe, auditable, and human-supervised while equipping local models with low-latency name resolution.

## ADR 024: Journal System with Local Attachments, Today/Week Toggle & Calendar/Gantt Horizons (Amendment 20)
- **Status**: Implemented
- **Date**: 2026-08-28
- **Decision**:
  1. **Zero-AI Journal Architecture**:
     - Dedicated `journal_entries` and `journal_attachments` SQLite tables for human reflections, notes, and media attachments.
     - Strictly no AI copilot, suggestions, or reflection buttons anywhere on the Journal screen (`JournalView.tsx`).
     - Selected attachments are copied into `userData/journal-attachments/` with UUID-prefixed filenames and served safely via the `media://` custom protocol (supporting range requests and streaming for `.mp3`, `.wav`, `.ogg`, `.m4a`, `.mp4`, `.webm`, `.mov`, and images).
     - Fire-and-forget vector memory chunk insertion (`source_type: 'journal_entry'`) on save without blocking UI operations.
  2. **Read-Only Chat Tool `journal_query`**:
     - Registered `journal_query(startDate, endDate)` in `TOOLS_SCHEMA` as a read-only query tool with no review diff cards (same tier as `memory_search`).
     - Enables conversational models to summarize or answer questions about personal reflections across date intervals.
  3. **Today / Week Segmented Switch**:
     - Investigated and confirmed `status` on `next_items` (`'today' | 'next' | 'done'`) as the single source of truth for Today's focus.
     - Added a segmented **Today | Week** toggle to the bottom-right panel of `OverviewView.tsx` without screen jumping.
     - In Week mode, aggregates items flagged `today` alongside non-completed actions scheduled with `due_date` inside the current week (Monday–Sunday), grouped under day-of-week headers.
  4. **Calendar & Active Epic Gantt View**:
     - Built `CalendarView.tsx` displaying an interactive monthly action grid plotting `next_items` by `due_date`.
     - Placed horizontal Gantt planning bars beneath the grid for all Active Epics, directly reusing the `calculateEpicPace` engine (`src/renderer/src/utils/pace.ts`) to render elapsed horizon percentage, execution progress, and velocity badges.
- **Rationale**: Separates pure, private human journaling from AI generation while enhancing scheduling visibility and temporal horizon management.
