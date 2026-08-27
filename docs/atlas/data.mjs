// Single source of truth for the LifeStack Architecture Atlas.
// Build: node docs/atlas/build.mjs  → writes docs/SYSTEM.md and docs/atlas.html

export const META = {
  title: 'LifeStack 2.0',
  artifactUrl: '',
  sourcePath: 'docs/atlas/data.mjs',
  buildCmd: 'node docs/atlas/build.mjs',
  stats: [
    { k: 'Stack', v: 'Electron · React · SQLite' },
    { k: 'Vector Engine', v: 'sqlite-vec · 768d' },
    { k: 'AI Backend', v: 'Local Ollama' }
  ],
  intro: `_**LifeStack 2.0 System Definition & Architecture Map.** Built from the single source of truth in \`docs/atlas/data.mjs\`._`,
  onePara: `LifeStack is a local-first desktop life operating system built on a 4-tier hierarchy: broad life Sectors, up to 5 concurrent Active Epics (with planning horizons), Explore Research topics (for discovery/findings), and concrete Next Actions (with daily Today focus). It integrates an in-process SQLite vector engine (sqlite-vec + nomic-embed-text) for instant semantic memory search and connects to local Ollama LLMs for conversational planning, human-in-the-loop diff cards, and automated research-to-action synthesis.`,
  costModel: [
    '**Local-First / Zero Cloud Cost**',
    '- **Database & Vectors:** Embedded SQLite + `sqlite-vec` (0 cloud API costs, 100% offline).',
    '- **AI Inference:** Local Ollama running on user hardware (Gemma 2B, Llama 3.2, Qwen 2.5).',
    '- **Memory Footprint:** ~85MB RAM baseline, zero background CPU drain.'
  ],
  deepDive: 'See [ARCHITECTURE_DECISIONS.md](../ARCHITECTURE_DECISIONS.md) for complete historical decision records.',
  platformGives: 'Electron desktop runtime, Chromium GPU frosted-glass compositor, native OS notifications, WebRTC camera capture.',
  weOwn: '4-tier relational schema, dual-progress meters, sqlite-vec memory pipeline, Ollama tool-calling interceptor with interactive diff cards, 2×2 tactical command grid, and derived horizon pace engine.',
  filesystem: `LifeStacker/
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
└── tests/                    # Playwright E2E & direct DB invariant tests`
};

export const DECISIONS = [
  { axis: 'Stack Structure', decision: 'Auto-Stack priority ordering across all sectors rather than isolated Kanban columns', adr: '[ADR 001](../ARCHITECTURE_DECISIONS.md#adr-001-auto-stack-ordering-vs-manual-queueing)' },
  { axis: 'Visual Design', decision: 'Mathematically linked glass-intensity token scale coupling background opacity to blur radius', adr: '[ADR 003](../ARCHITECTURE_DECISIONS.md#adr-003-unified-linked-glass-intensity-token-scale-amendment-6)' },
  { axis: 'Media Engine', decision: 'HTTP 206 partial content byte-range streaming via custom media:// protocol handler', adr: '[ADR 004](../ARCHITECTURE_DECISIONS.md#adr-004-http-206-partial-content-range-streaming-for-media)' },
  { axis: 'Vector Search', decision: 'In-process vector search using sqlite-vec virtual tables and local nomic-embed-text', adr: '[ADR 007](../ARCHITECTURE_DECISIONS.md#adr-007-out-of-band-vector-embedding-with-sqlite-vec--nomic-embed-text-amendment-7)' },
  { axis: 'Vector Alignment', decision: 'Asymmetric task prefixes (search_query vs search_document) for short-query vector calibration', adr: '[ADR 011](../ARCHITECTURE_DECISIONS.md#adr-011-asymmetric-nomic-task-prefixes--vector-backfill-amendment-14)' },
  { axis: 'AI Safety', decision: 'Zero direct AI database writes; all mutations require human-in-the-loop ActionDiffCards', adr: '[ADR 012](../ARCHITECTURE_DECISIONS.md#adr-012-conversational-item-management--mandatory-human-in-the-loop-diff-cards-amendment-15--16)' },
  { axis: 'Focus Recovery', decision: 'Global DOM unmount blur monkey-patch and pointerdown capture to prevent Chromium input locking', adr: '[ADR 013](../ARCHITECTURE_DECISIONS.md#adr-013-global-focus-recovery--input-lock-prevention)' },
  { axis: 'Data Model', decision: '4-Tier Hierarchy (Sectors → Epics with Horizons → Explore Topics → Next Actions → Today)', adr: '[ADR 014](../ARCHITECTURE_DECISIONS.md#adr-014-4-tier-hierarchical-data-model-phase-0)' },
  { axis: 'Progress Tracking', decision: 'Dual computed meters (Research % and Execution %) with active cap (5) and ParkSwapModal', adr: '[ADR 015](../ARCHITECTURE_DECISIONS.md#adr-015-dual-progress-meters--stage-classification-phase-1)' },
  { axis: 'Overview Layout', decision: '2×2 Tactical Command Grid with staleness sorting for Explore and quick-win sorting for Next', adr: '[ADR 016](../ARCHITECTURE_DECISIONS.md#adr-016-22-tactical-command-grid--tri-modal-sorting-phase-2)' },
  { axis: 'AI Synthesis', decision: 'Automated synthesis from Explore research notes to staged Next actions with atomic batch commit', adr: '[ADR 017](../ARCHITECTURE_DECISIONS.md#adr-017-explore-to-next-ai-synthesis--atomic-batch-staging-phase-3)' },
  { axis: 'Pace & Horizon', decision: 'Non-alerting velocity calculation and discretionary capacity modeling (28h/week)', adr: '[ADR 018](../ARCHITECTURE_DECISIONS.md#adr-018-derived-pace-burn-tracking-engine--discretionary-capacity-phase-4)' },
  { axis: 'AI Model Choice', decision: 'Dynamic Ollama /api/tags discovery, custom tag selector, and 4-tier native tool calling', adr: '[ADR 020](../ARCHITECTURE_DECISIONS.md#adr-020-dynamic-local-ai-model-selector--4-tier-assistant-architecture)' },
  { axis: 'Interactive Tour', decision: 'Dynamic SVG spotlight walkthrough with deferred roadmap for Lanes re-visualization and Stats revamp', adr: '[ADR 021](../ARCHITECTURE_DECISIONS.md#adr-021-interactive-ui-walkthrough--deferred-screen-roadmap-lanes--stats-revamps)' },
  { axis: 'Theme Architecture', decision: 'Flat warm-neutral minimal token system with instant runtime light/dark switching and WCAG AA contrast', adr: '[ADR 022](../ARCHITECTURE_DECISIONS.md#adr-022-flat-warm-neutral-minimal-dual-mode-token-system--runtime-theme-switching)' }
];

export const GROUPS = [
  { id: 'ui', title: 'Renderer & Glass UI' },
  { id: 'core', title: 'Desktop Runtime & IPC Hub' },
  { id: 'data', title: 'Storage & Vector Index' },
  { id: 'ai', title: 'Local AI & Cognitive Engine' },
  { id: 'workflow', title: 'Tactical Workflow Engine' },
  { id: 'off', title: 'Designed for, Not Yet Switched On' }
];

export const NODES = [
  {
    id: 'UI',
    code: 'UI',
    name: 'Renderer GUI',
    short: 'REACT UI',
    group: 'ui',
    gx: 1.5,
    gy: 8.5,
    w: 3,
    d: 3,
    h: 46,
    kind: 'screen',
    one: 'The frosted-glass desktop interface rendering views, modals, and focus strips.',
    what: 'React 18 frontend with custom Tailwind tokens, continuous frosted glass backdrop blur, and interactive views (Lanes, 2×2 Tactical Overview, Today Focus, Settings, AI Chat).',
    how: 'Rendered in Chromium web frame. Communicates strictly across context isolation boundaries via <code>window.api</code>.',
    steps: [
      ['Mount', 'Load settings, sectors, epics, explore topics, and next items into memory.'],
      ['Render Views', 'Switch seamlessly between Lanes view, Overview 2×2 Grid, and Chat.'],
      ['User Action', 'Dispatch IPC invoke requests for data mutations or AI generation.']
    ],
    cond: [
      { q: 'How to prevent input lock when modals unmount?', r: 'Global DOM unmount monkey-patch and pointerdown capture hook in main.tsx (ADR 013).' }
    ]
  },
  {
    id: 'ST',
    code: 'ST',
    name: 'State Store',
    short: 'APP CONTEXT',
    group: 'ui',
    gx: 5.5,
    gy: 8.5,
    w: 2,
    d: 2,
    h: 32,
    kind: 'cards',
    one: 'Central reactive React context providing optimistic updates and audio feedback.',
    what: 'Holds cached sectors, items, explore lists, next lists, and active settings in memory with global refresh triggers and notification toasts.',
    how: 'Implemented in <code>AppContext.tsx</code> with <code>refreshAll()</code> and lightweight UI state handlers.',
    steps: [
      ['Load Initial', 'Fetch all database records on application startup.'],
      ['Optimistic Diff', 'Update UI immediately when actions are toggled or accepted.'],
      ['Audio Cue', 'Play subtle audio feedback on task completion.']
    ],
    cond: []
  },
  {
    id: 'IPC',
    code: 'IPC',
    name: 'IPC Hub',
    short: 'PRELOAD IPC',
    group: 'core',
    gx: 5.5,
    gy: 5.0,
    w: 2,
    d: 2,
    h: 40,
    kind: 'gate',
    one: 'Secure context isolation bridge between Chromium renderer and Node main process.',
    what: 'Exposes type-safe APIs for items, explore topics, next actions, local AI, and system settings.',
    how: 'Preload script using Electron <code>contextBridge.exposeInMainWorld(\'api\', ...)</code> backed by <code>ipcMain.handle</code>.',
    steps: [
      ['Receive Invoke', 'Validate incoming arguments from renderer window.'],
      ['Execute Handler', 'Dispatch request to database helper or AI process.'],
      ['Return Result', 'Serialize and return result payload to renderer.']
    ],
    cond: []
  },
  {
    id: 'APP',
    code: 'APP',
    name: 'Electron Main',
    short: 'MAIN PROCESS',
    group: 'core',
    gx: 1.5,
    gy: 3.5,
    w: 3,
    d: 3,
    h: 60,
    kind: 'tall',
    one: 'The desktop runtime managing windows, protocols, and background schedules.',
    what: 'Node.js host process managing app lifecycle, single instance lock, custom media streaming protocol, and scheduled weekly reviews.',
    how: 'Coded in <code>src/main/index.ts</code> and <code>scheduler.ts</code>.',
    steps: [
      ['App Ready', 'Initialize SQLite database, load sqlite-vec, and register media:// protocol.'],
      ['Create Window', 'Launch BrowserWindow with native titlebar and dark background.'],
      ['Background Jobs', 'Run weekly stack review check and periodic Ollama health polling.']
    ],
    cond: [
      { q: 'How to stream large local video backgrounds without freezing?', r: 'HTTP 206 byte-range streaming in media:// protocol handler (ADR 004).' }
    ]
  },
  {
    id: 'DB',
    code: 'DB',
    name: '4-Tier SQLite',
    short: 'SQLITE DB',
    group: 'data',
    gx: 9.0,
    gy: 7.5,
    w: 3,
    d: 3,
    h: 34,
    kind: 'store',
    one: 'Relational SQLite storage enforcing the 4-tier life stack schema.',
    what: 'Fast embedded SQLite database storing Sectors, Epics (with Horizons), Explore Topics, Next Actions, Effort Logs, and Settings.',
    how: 'Powered by <code>better-sqlite3</code> in WAL mode in <code>src/main/db/</code> with foreign keys and cascade deletions.',
    steps: [
      ['Transaction Begin', 'Execute atomic reads/writes in <5ms.'],
      ['Integrity Guard', 'Enforce deletion constraints on Explore cards with active child Next items.'],
      ['Index Hook', 'Trigger background vector memory re-indexing after mutating writes.']
    ],
    cond: [
      { q: 'How are schema migrations handled safely?', r: 'Automatic declarative migrations on startup in schema.ts (ADR 009, ADR 014).' }
    ]
  },
  {
    id: 'VEC',
    code: 'VEC',
    name: 'Vector Memory',
    short: 'SQLITE-VEC',
    group: 'data',
    gx: 13.0,
    gy: 7.5,
    w: 2.5,
    d: 2.5,
    h: 28,
    kind: 'store',
    one: 'In-process semantic vector index powered by sqlite-vec and 768d embeddings.',
    what: 'Stores vector chunks for items and notes to enable debounced hybrid conceptual search and AI context retrieval.',
    how: 'Virtual table <code>vec0(vector float[768] distance_metric=L2)</code> with asymmetric task prefixes (<code>search_document:</code> vs <code>search_query:</code>).',
    steps: [
      ['Embed Text', 'Call local nomic-embed-text to convert item text into 768-dim float vector.'],
      ['Insert vec0', 'Store vector embedding directly inside SQLite virtual table.'],
      ['KNN Query', 'Retrieve top-K semantically related items within L2 distance cutoff (22.35).']
    ],
    cond: [
      { q: 'Why use asymmetric task prefixes?', r: 'Aligns query vectors with document vectors in nomic-embed-text embedding space (ADR 011).' }
    ]
  },
  {
    id: 'AI',
    code: 'AI',
    name: 'Ollama Engine',
    short: 'OLLAMA LLM',
    group: 'ai',
    gx: 13.0,
    gy: 2.5,
    w: 3,
    d: 3,
    h: 64,
    kind: 'tall',
    one: 'Local inference engine running open-source models for chat, embeddings, and synthesis.',
    what: 'Locally hosted LLM server (http://127.0.0.1:11434) executing chat turns, JSON generation, and embedding computations.',
    how: 'Communicates over HTTP API (<code>/api/tags</code>, <code>/api/chat</code>, <code>/api/generate</code>, <code>/api/embeddings</code>).',
    steps: [
      ['Health Poll', 'Verify server connectivity and pulled models every 5 seconds.'],
      ['Tool Chat', 'Process chat prompts against 4-tier tool schemas with preferred model.'],
      ['Embed Chunks', 'Generate 768-dimensional embeddings via nomic-embed-text.']
    ],
    cond: [
      { q: 'Can users select custom or fine-tuned model tags?', r: 'Yes, dynamic model discovery from /api/tags and custom tag input in SettingsView (ADR 020).' }
    ]
  },
  {
    id: 'AST',
    code: 'AST',
    name: 'Chat Assistant',
    short: 'DIFF CARDS',
    group: 'ai',
    gx: 9.0,
    gy: 2.5,
    w: 2.5,
    d: 2.5,
    h: 42,
    kind: 'box',
    one: 'Conversational planning assistant with human-in-the-loop pending diff cards.',
    what: 'Translates natural user goals into structured tool calls (items_create, explore_create, next_items_create) and renders editable diff cards for confirmation.',
    how: 'Implemented in <code>src/main/ai/chat.ts</code> with fail-soft normalizers and <code>ActionDiffCard.tsx</code>.',
    steps: [
      ['User Prompt', 'Send conversational prompt and stack context to Ollama.'],
      ['Intercept Call', 'Intercept tool call arguments and save as pending_action row.'],
      ['Render Diff Card', 'Display interactive card in chat with Explore & Next action editors.'],
      ['User Confirmation', 'Commit reviewed changes into SQLite upon clicking Accept.']
    ],
    cond: [
      { q: 'How to prevent direct AI overwrites?', r: 'Zero direct AI database writes; all tool calls create pending_actions (ADR 012).' }
    ]
  },
  {
    id: 'SYN',
    code: 'SYN',
    name: 'AI Synthesizer',
    short: 'SYNTHESIZER',
    group: 'ai',
    gx: 9.0,
    gy: 0.0,
    w: 2.5,
    d: 2,
    h: 28,
    kind: 'job',
    one: 'Distills unstructured Explore research notes into concrete Next Actions.',
    what: 'Reads research questions, findings, and hypotheses from Explore cards and generates 2-4 executable next tasks with estimated effort.',
    how: 'Executed via <code>generateDraftNextItems()</code> in <code>ollama-client.ts</code> and staged in <code>ItemModal.tsx</code>.',
    steps: [
      ['Extract Notes', 'Read title and research notes from target Explore card.'],
      ['Generate Actions', 'Call Ollama with JSON output schema for concise verb-noun steps.'],
      ['Stage Sandbox', 'Present editable draft rows in ItemModal for user review.'],
      ['Batch Commit', 'Atomically insert approved actions into next_items table.']
    ],
    cond: [
      { q: 'What happens if Ollama is offline?', r: 'Fall back to heuristic regex extraction of bullet points from notes (ADR 017).' }
    ]
  },
  {
    id: 'PAC',
    code: 'PAC',
    name: 'Pace & Horizon',
    short: 'PACE ENGINE',
    group: 'workflow',
    gx: 5.5,
    gy: 1.5,
    w: 2.5,
    d: 2,
    h: 24,
    kind: 'slab',
    one: 'Calculates project velocity and horizon consumption without stressful alerts.',
    what: 'Analyzes weekly logged effort against Epic planning horizons to derive elapsed percentage and velocity pace.',
    how: 'Implemented in <code>src/main/db/pace.ts</code> and displayed across Dual Progress meters and effort tabs.',
    steps: [
      ['Read Logs', 'Aggregate actual logged effort from effort_log table.'],
      ['Calculate Burn', 'Compute weekly burn rate and compare to time budget horizon.'],
      ['Derive Elapsed %', 'Calculate elapsed time ratio (elapsed / budget) without disruptive alarms.']
    ],
    cond: [
      { q: 'How is capacity modeled?', r: 'Configurable weekly_personal_hours (default: 28 hrs/week) modeling discretionary side-project time (ADR 018).' }
    ]
  },
  {
    id: 'GHO',
    code: 'GHO',
    name: 'Cloud & Sync',
    short: 'CLOUD SYNC',
    group: 'off',
    ghost: true,
    gx: 1.5,
    gy: -1.0,
    w: 2.5,
    d: 2,
    h: 26,
    kind: 'box',
    one: 'Planned: End-to-end encrypted multi-device sync and mobile companion.',
    what: 'Optional encrypted sync layer allowing stack updates and daily Today check-ins from mobile devices.',
    how: 'Designed for zero-knowledge CRDT sync over encrypted SQLite delta streams.',
    steps: [
      ['Delta Sync', 'Export local encrypted SQLite change stream.'],
      ['Merge CRDT', 'Reconcile offline edits across mobile and desktop clients.']
    ],
    cond: [
      'Encryption key management and secure enclave backup.',
      'Conflict-free resolution for Today focus reordering.'
    ]
  }
];

export const FLOWS = [
  {
    id: 'synth',
    name: 'Explore → Next AI Synthesis',
    hops: [
      ['UI', 'IPC', 'generateNextItems', { explore_id: 'exp-101', notes: 'Investigate Trinity College MSc fees and visa requirements' }, 'xy'],
      ['IPC', 'SYN', 'distill_notes', { topic: 'Trinity MSc', notes: '...' }, 'yx'],
      ['SYN', 'AI', 'ollama_generate_json', { prompt: 'Generate 3 concrete next actions...', format: 'json' }, 'xy'],
      ['AI', 'SYN', 'json_actions', { items: [{ title: 'Download course brochure', effort: '1 hr' }, { title: 'Check GPA equivalence', effort: '2 hrs' }] }, 'yx'],
      ['SYN', 'IPC', 'staged_drafts', { drafts: 2 }, 'xy'],
      ['IPC', 'UI', 'render_staging_sandbox', { staged_count: 2 }, 'yx'],
      ['UI', 'IPC', 'commit_batch', { approved: [{ title: 'Download course brochure' }] }, 'xy'],
      ['IPC', 'DB', 'insert_next_items', { count: 1, parent_explore_id: 'exp-101' }, 'xy'],
      ['DB', 'VEC', 'index_new_item', { text: 'search_document: Download course brochure' }, 'xy']
    ]
  },
  {
    id: 'chat_plan',
    name: 'Conversational Planning & Action Diff Card',
    hops: [
      ['UI', 'IPC', 'chat_send', { prompt: 'Break down my goal to build an AI hardware side hustle' }, 'xy'],
      ['IPC', 'AST', 'process_turn', { prompt: '...' }, 'yx'],
      ['AST', 'AI', 'ollama_chat_tools', { tools: ['items_create', 'explore_create', 'next_items_create'] }, 'xy'],
      ['AI', 'AST', 'tool_call', { name: 'items_create', args: { title: 'AI Hardware Venture', explore_topics: ['Compare Jetson vs Coral'], next_items: ['Order dev board'] } }, 'yx'],
      ['AST', 'DB', 'insert_pending_action', { status: 'pending' }, 'xy'],
      ['AST', 'IPC', 'chat_delta', { has_pending_action: true }, 'xy'],
      ['IPC', 'UI', 'render_diff_card', { title: 'AI Hardware Venture', explore_count: 1, next_count: 1 }, 'yx'],
      ['UI', 'IPC', 'accept_action', { action_id: 'act-402' }, 'xy'],
      ['IPC', 'DB', 'commit_epic_and_children', { epic: 'AI Hardware Venture' }, 'xy'],
      ['DB', 'ST', 'refresh_all', { success: true }, 'yx']
    ]
  },
  {
    id: 'search',
    name: 'Hybrid Substring & Semantic Search',
    hops: [
      ['UI', 'IPC', 'search_keystroke', { query: 'anxious about visa' }, 'xy'],
      ['IPC', 'DB', 'instant_text_match', { query: 'anxious' }, 'xy'],
      ['DB', 'UI', 'instant_text_results', { matches: 0 }, 'yx'],
      ['IPC', 'AI', 'embed_query', { text: 'search_query: anxious about visa' }, 'xy'],
      ['AI', 'VEC', 'knn_search', { vector: '[768 floats]', k: 8 }, 'xy'],
      ['VEC', 'IPC', 'semantic_hits', { hits: [{ id: 'exp-101', title: 'Stamp 1G Visa Research', distance: 18.2 }] }, 'yx'],
      ['IPC', 'UI', 'append_semantic_matches', { marker: '✦ related to your search' }, 'yx']
    ]
  },
  {
    id: 'pace_log',
    name: 'Step Completion & Pace Recalculation',
    hops: [
      ['UI', 'IPC', 'complete_next_item', { item_id: 'nxt-505', actual_effort: '2.5 hrs' }, 'xy'],
      ['IPC', 'DB', 'update_step_and_effort', { is_done: 1, logged_hrs: 2.5 }, 'xy'],
      ['DB', 'PAC', 'recalculate_velocity', { epic_id: 'ep-001' }, 'yx'],
      ['PAC', 'DB', 'update_pace_metrics', { elapsed_pct: 35, burn_rate: '4.2 hrs/wk' }, 'xy'],
      ['DB', 'ST', 'sync_meters', { research_pct: 100, exec_pct: 66 }, 'yx'],
      ['ST', 'UI', 'render_progress_rings', { execution_meter: '66%' }, 'yx']
    ]
  }
];

export const CH = [
  {
    id: 'foundation',
    title: 'The Core 4-Tier Foundation',
    reveal: ['UI', 'ST', 'IPC', 'APP', 'DB'],
    lede: `LifeStack organizes goals across 4 distinct levels: Sectors, Epics with Horizons, Explore Research, and Next Actions.`,
    story: `<p>The React frontend communicates over a secure preload IPC hub to an in-process SQLite database. <mark>Data operations complete in &lt;5ms</mark> with zero cloud latency.</p>`,
    flow: [
      ['UI', 'IPC', 'create_epic', { title: 'Master Distributed Systems' }, 'xy'],
      ['IPC', 'DB', 'insert_epic', { sector: 'Learning', horizon: '1 year' }, 'xy'],
      ['DB', 'ST', 'state_updated', { epic_count: 1 }, 'yx'],
      ['ST', 'UI', 'render_lane_card', { title: 'Master Distributed Systems' }, 'yx']
    ]
  },
  {
    id: 'vector_memory',
    title: 'Semantic Memory & Vector Search',
    reveal: ['VEC'],
    lede: `In-process vector embeddings allow instant conceptual search and AI context retrieval.`,
    story: `<p>Whenever items or explore notes are written, background embeddings are stored in <mark>sqlite-vec virtual tables</mark> using 768-dimensional vectors with asymmetric task prefixes.</p>`,
    flow: [
      ['DB', 'VEC', 'upsert_chunks', { text: 'search_document: Distributed Systems notes' }, 'xy'],
      ['UI', 'IPC', 'memory_search', { query: 'consensus algorithms' }, 'xy'],
      ['IPC', 'VEC', 'knn_query', { k: 5 }, 'xy'],
      ['VEC', 'UI', 'semantic_matches', { marker: '✦' }, 'yx']
    ]
  },
  {
    id: 'local_ai',
    title: 'Local AI Assistant & Diff Cards',
    reveal: ['AI', 'AST'],
    lede: `Conversational planning co-pilot running 100% locally via Ollama with human-in-the-loop diff cards.`,
    story: `<p>The AI co-pilot intercepts mutations into <mark>pending diff cards</mark>, allowing users to inspect, edit, and confirm Explore research topics and Next actions before acceptance.</p>`,
    flow: [
      ['UI', 'IPC', 'chat_prompt', { text: 'Plan my Ireland Masters' }, 'xy'],
      ['IPC', 'AST', 'route_to_llm', { preferred_model: 'gemma4:e2b' }, 'yx'],
      ['AST', 'AI', 'chat_completion', { tools: ['items_create'] }, 'xy'],
      ['AI', 'AST', 'tool_call_emitted', { title: 'MS in Ireland', explore_topics: 2, next_items: 2 }, 'yx'],
      ['AST', 'UI', 'render_diff_card', { editable: true }, 'xy']
    ]
  },
  {
    id: 'synthesis_pace',
    title: 'Research Synthesis & Tactical Execution',
    reveal: ['SYN', 'PAC'],
    lede: `Bridging the gap between open-ended discovery and concrete execution.`,
    story: `<p>Explore cards can be automatically synthesized into concrete Next actions with <mark>atomic batch commits</mark>, while the derived pace engine tracks horizon burn rate without stressful alarms.</p>`,
    flow: [
      ['UI', 'IPC', 'synthesize_explore', { explore_id: 'exp-101' }, 'xy'],
      ['IPC', 'SYN', 'distill_findings', { notes: '...' }, 'yx'],
      ['SYN', 'AI', 'generate_actions', { format: 'json' }, 'xy'],
      ['AI', 'SYN', 'actions_json', { count: 3 }, 'yx'],
      ['SYN', 'UI', 'staging_sandbox', { editable: true }, 'xy'],
      ['UI', 'PAC', 'log_completion', { hours: 2 }, 'xy'],
      ['PAC', 'ST', 'update_velocity', { pace: '4.2 hrs/wk' }, 'yx']
    ]
  },
  {
    id: 'future',
    title: 'Designed for Later: Cloud & Mobile Sync',
    reveal: ['GHO'],
    lede: `Architectural blueprint for encrypted multi-device synchronization.`,
    story: `<p>Designed for <mark>zero-knowledge CRDT sync</mark> over encrypted SQLite delta streams for future mobile companion apps.</p>`,
    flow: [
      ['DB', 'GHO', 'export_encrypted_deltas', { changes: 3 }, 'yx']
    ]
  },
  {
    id: 'all',
    title: 'The Whole LifeStack 2.0 System',
    reveal: [],
    lede: `The complete LifeStack 2.0 desktop architecture for free exploration.`,
    story: `<p>Choose which flow runs from the selector (bottom left). Hover any structure to inspect; click to pin; press <mark>→</mark> to go inside and inspect execution steps.</p>`,
    flow: null
  }
];

export const HOW_HTML = `<div class="eyebrow">LifeStack 2.0 · Architecture Atlas</div>
<h1 class="t">How it's built</h1>
<div class="sub">4-Tier Life Operating System with In-Process Vector Memory & Local AI</div>

<h3 class="sec">1. The 4-Tier Relational Hierarchy</h3>
<p>LifeStack separates life domains into four strictly normalized tiers in SQLite:</p>
<ul>
  <li><b>Tier 1: Sectors</b> — Career, Health, Learning, Side Projects, Relationships, Home & Admin.</li>
  <li><b>Tier 2: Active Epics</b> — In-flight initiatives capped at 5 with planning horizons (e.g. 6 months, 2 years).</li>
  <li><b>Tier 3: Explore Topics 🔬</b> — Open-ended research, hypotheses, questions, and findings notes.</li>
  <li><b>Tier 4: Next Actions ⚡ & Today 🎯</b> — Crisp execution tasks with effort estimates, pullable into Today (max 3).</li>
</ul>

<h3 class="sec">2. In-Process Vector Engine (sqlite-vec)</h3>
<p>Unlike cloud SaaS architectures that rely on remote vector databases, LifeStack embeds <code>sqlite-vec</code> virtual tables directly inside the primary SQLite database:</p>
<pre>CREATE VIRTUAL TABLE memory_chunks_vec USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding float[768] distance_metric=L2
);</pre>
<p>Queries use asymmetric task prefixes (<code>search_query:</code> vs <code>search_document:</code>) calibrated for <code>nomic-embed-text</code>.</p>

<h3 class="sec">3. Human-in-the-Loop AI Assistant</h3>
<p>The local AI assistant connects to Ollama (<code>http://127.0.0.1:11434</code>) with native tool schemas for <code>items_create</code>, <code>explore_create</code>, and <code>next_items_create</code>. <b>Zero direct database writes occur</b>; all mutations are staged as interactive frosted-glass diff cards for review and editing.</p>

<h3 class="sec">4. 2×2 Tactical Command Grid</h3>
<p>The Overview cockpit balances research and execution simultaneously:</p>
<ul>
  <li><b>Top-Left:</b> Active Epics with dual progress meters (Research % + Execution %).</li>
  <li><b>Top-Right:</b> Explore Panel sorted by Staleness (oldest touched first).</li>
  <li><b>Bottom-Left:</b> Next Actions Backlog sorted by Due Date then Effort.</li>
  <li><b>Bottom-Right:</b> Today Focus strictly capped at 3 with TodayBumpModal.</li>
</ul>

<h3 class="sec">5. Graph Relationships & Edge Diff Cards</h3>
<p>Cross-epic dependencies and graph relationships (<code>depends_on</code>, <code>supports</code>, <code>contradicts</code>, <code>relates_to</code>) strictly adhere to the propose-never-commit architecture. The conversational co-pilot utilizes a compact in-context ID-to-title index for instant single-turn resolution without lookup latency, presenting interactive edge diff cards for user review.</p>`;
