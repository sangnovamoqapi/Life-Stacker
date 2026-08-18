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
