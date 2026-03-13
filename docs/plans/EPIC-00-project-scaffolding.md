# EPIC 0 — Project Scaffolding

**Priorità**: P0 (bloccante per tutto il resto)
**Sprint**: 1
**Stima**: 2-3 giorni
**Dipendenze**: nessuna

---

## Contesto

Stiamo costruendo **Plan Reviewer**, un plugin VS Code che permette di revisionare iterativamente i piani generati da Copilot Chat (o qualsiasi AI) con commenti inline stile GitHub PR, e di generare prompt strutturati per la ri-pianificazione. Il tutto persistito in SQLite.

Stack: TypeScript strict + React (WebView) + SQLite (sql.js WASM) + esbuild

---

## Story 0.1 — Inizializzazione del progetto VS Code Extension

**Come** sviluppatore, **voglio** un progetto estensione VS Code funzionante con la struttura di cartelle corretta, **per** avere una base solida su cui costruire.

### Tasks

1. Inizializzare il progetto con `yo code` (TypeScript extension)
2. Strutturare le cartelle così:
   ```
   plan-reviewer/
   ├── src/
   │   ├── extension/          # Extension host code
   │   │   ├── extension.ts    # Entry point (activate/deactivate)
   │   │   ├── commands/       # Command handlers
   │   │   ├── services/       # Business logic (PlanManager, CommentManager, etc.)
   │   │   └── db/             # SQLite layer
   │   ├── webview/            # React WebView code
   │   │   ├── index.tsx       # React entry point
   │   │   ├── App.tsx         # Root component
   │   │   ├── components/     # React components
   │   │   ├── hooks/          # Custom hooks
   │   │   └── styles/         # CSS/Tailwind
   │   └── shared/             # Shared TypeScript types
   │       ├── messages.ts     # WebView ↔ Host message contracts
   │       ├── models.ts       # Domain models (Plan, Version, Comment, Section)
   │       └── constants.ts    # Shared constants
   ├── package.json
   ├── tsconfig.json
   ├── tsconfig.webview.json   # Separate tsconfig for React
   ├── esbuild.mjs             # Build script
   └── .vscode/
       └── launch.json         # Debug configuration
   ```
3. Configurare `tsconfig.json` con strict mode abilitato
4. Creare un secondo `tsconfig.webview.json` per il codice React (jsx: react-jsx)

### Criteri di accettazione

- [ ] `npm run compile` compila senza errori
- [ ] L'estensione si attiva in VS Code (Extension Development Host)
- [ ] Il comando "Hello World" di default funziona dal Command Palette
- [ ] Le cartelle sono strutturate come descritto
- [ ] TypeScript strict mode attivo su entrambi i tsconfig

---

## Story 0.2 — Configurazione esbuild (dual bundle)

**Come** sviluppatore, **voglio** un build system che produca due bundle separati (extension host + WebView React), **per** avere build veloci e output ottimizzato.

### Tasks

1. Installare esbuild come dev dependency
2. Creare `esbuild.mjs` con due configurazioni:
   - **Extension bundle**: entry `src/extension/extension.ts` → `dist/extension.js` (format: cjs, platform: node, external: ['vscode'])
   - **WebView bundle**: entry `src/webview/index.tsx` → `dist/webview.js` (format: iife, platform: browser)
3. Configurare il watch mode per development (`--watch`)
4. Aggiungere gli script npm:
   - `npm run build` — build di produzione
   - `npm run dev` — watch mode
   - `npm run package` — vsce package

### Criteri di accettazione

- [ ] `npm run build` produce `dist/extension.js` e `dist/webview.js`
- [ ] Il bundle extension non include `vscode` (è external)
- [ ] Il bundle webview è self-contained (include React)
- [ ] Watch mode rileva modifiche e ricompila in < 500ms
- [ ] Nessun errore di build

---

## Story 0.3 — SQLite con sql.js (WASM)

**Come** sviluppatore, **voglio** un database SQLite funzionante dentro l'estensione, **per** persistere piani, versioni e commenti tra sessioni.

### Decisione tecnica

Usiamo `sql.js` (SQLite compilato in WASM) invece di `better-sqlite3` per evitare problemi con binary nativi su architetture diverse. È più lento, ma universalmente compatibile e senza step di build nativi.

### Tasks

1. Installare `sql.js` e i suoi tipi TypeScript
2. Creare `src/extension/db/database.ts` con:
   - Classe `Database` singleton
   - `init(storagePath: string)` — carica o crea il DB nel `globalStorageUri` dell'estensione
   - `close()` — salva e chiude
   - Il file WASM di sql.js deve essere copiato nella cartella dist (configurare esbuild per questo)
3. Creare `src/extension/db/migrations.ts` con:
   - Schema migration v1 con le tabelle: `plans`, `versions`, `sections`, `comments`
   - Tabella `schema_version` per gestire migrazioni future
4. Creare `src/extension/db/repositories/` con:
   - `PlanRepository.ts` — CRUD per plans + versions
   - `CommentRepository.ts` — CRUD per comments
   - `SectionRepository.ts` — CRUD per sections

### Schema SQL da implementare

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_review',
  tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  review_prompt TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(plan_id, version_number)
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  level INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('line', 'range', 'section')),
  target_start INTEGER NOT NULL,
  target_end INTEGER NOT NULL,
  section_id TEXT REFERENCES sections(id),
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('suggestion', 'issue', 'question', 'approval')),
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_versions_plan ON versions(plan_id, version_number);
CREATE INDEX idx_comments_version ON comments(version_id);
CREATE INDEX idx_sections_version ON sections(version_id);
CREATE INDEX idx_comments_resolved ON comments(version_id, resolved);
```

### Criteri di accettazione

- [ ] Il database viene creato al primo avvio dell'estensione in `globalStorageUri`
- [ ] Le 4 tabelle vengono create con lo schema corretto
- [ ] I repository supportano CRUD basico (insert, select by id, select by FK, update, delete)
- [ ] Il DB persiste tra riavvii di VS Code
- [ ] `sql.js` WASM si carica correttamente in ambiente VS Code
- [ ] Tutte le operazioni usano prepared statements (no SQL injection)

---

## Story 0.4 — Shared Types e Message Contract

**Come** sviluppatore, **voglio** tipi TypeScript condivisi tra extension host e WebView, **per** avere type safety nella comunicazione via postMessage.

### Tasks

1. Creare `src/shared/models.ts`:
   ```typescript
   export interface Plan {
     id: string;
     title: string;
     source: 'copilot' | 'manual' | 'other';
     createdAt: string;
     updatedAt: string;
     status: 'in_review' | 'approved' | 'archived';
     tags: string[];
   }

   export interface Version {
     id: string;
     planId: string;
     versionNumber: number;
     content: string;
     reviewPrompt: string | null;
     createdAt: string;
   }

   export interface Section {
     id: string;
     versionId: string;
     heading: string;
     startLine: number;
     endLine: number;
     level: number;
     orderIndex: number;
   }

   export interface Comment {
     id: string;
     versionId: string;
     type: 'line' | 'range' | 'section';
     targetStart: number;
     targetEnd: number;
     sectionId: string | null;
     body: string;
     category: 'suggestion' | 'issue' | 'question' | 'approval';
     resolved: boolean;
     createdAt: string;
   }
   ```

2. Creare `src/shared/messages.ts`:
   ```typescript
   // Host → WebView
   export type HostMessage =
     | { type: 'planLoaded'; payload: { plan: Plan; version: Version; sections: Section[]; comments: Comment[] } }
     | { type: 'commentAdded'; payload: Comment }
     | { type: 'commentUpdated'; payload: Comment }
     | { type: 'commentDeleted'; payload: { commentId: string } }
     | { type: 'error'; payload: { message: string } };

   // WebView → Host
   export type WebViewMessage =
     | { type: 'addComment'; payload: Omit<Comment, 'id' | 'createdAt'> }
     | { type: 'updateComment'; payload: { id: string; body?: string; category?: Comment['category'] } }
     | { type: 'deleteComment'; payload: { id: string } }
     | { type: 'resolveComment'; payload: { id: string } }
     | { type: 'requestPlan'; payload: { planId: string; versionNumber?: number } }
     | { type: 'ready' };
   ```

### Criteri di accettazione

- [ ] I tipi sono importabili sia da `src/extension/` che da `src/webview/`
- [ ] Nessun `any` nei tipi condivisi
- [ ] I messaggi coprono tutte le operazioni CRUD sui commenti
- [ ] Il contratto è estendibile senza breaking changes (union type)

---

## Story 0.5 — WebView Shell con React

**Come** sviluppatore, **voglio** una WebView React funzionante dentro VS Code, **per** avere la base su cui costruire l'interfaccia di review.

### Tasks

1. Installare React, ReactDOM e i relativi tipi
2. Creare `src/webview/index.tsx` come entry point React
3. Creare `src/webview/App.tsx` con un componente placeholder ("Plan Reviewer — Ready")
4. Creare `src/extension/webview/PlanReviewPanel.ts`:
   - Gestisce il ciclo di vita del WebviewPanel
   - Carica il bundle React (`dist/webview.js`)
   - Implementa `postMessage` / `onDidReceiveMessage`
   - Usa `ViewColumn.Beside` come default
   - Supporta il tema VS Code (inietta CSS variables)
5. Creare un comando `planReviewer.openPanel` che apre la WebView
6. Creare `src/webview/hooks/useVsCodeApi.ts` — hook per comunicare con l'host via `acquireVsCodeApi()`

### Criteri di accettazione

- [ ] Il comando "Plan Reviewer: Open Panel" apre una WebView a fianco dell'editor
- [ ] La WebView mostra il componente React
- [ ] Un messaggio "ready" viene inviato dalla WebView all'host all'avvio
- [ ] L'host può inviare un messaggio alla WebView e la WebView lo riceve
- [ ] La WebView rispetta il tema chiaro/scuro di VS Code
- [ ] La WebView sopravvive al cambio di tab (retainContextWhenHidden: true)

---

## Definition of Done — Epic 0

Alla fine di questa epic, hai un'estensione VS Code che:

1. Si compila e si avvia senza errori
2. Ha un database SQLite funzionante con lo schema completo
3. Ha una WebView React che comunica con l'extension host
4. Ha un contratto TypeScript condiviso per i messaggi
5. Ha una struttura di cartelle pulita e manutenibile
6. È pronta per ricevere la logica di business nelle epic successive

**Nessuna feature utente visibile** — è pura infrastruttura. Ma è l'infrastruttura su cui tutto il resto si appoggia.

---

## Note per Claude Code

- Usa `uuid` (npm package) per generare gli ID
- Per sql.js, il file WASM (`sql-wasm.wasm`) deve essere accessibile a runtime: copialo in `dist/` durante la build
- Il `PlanReviewPanel` deve gestire il caso di pannello già aperto (focus instead of create)
- Testa il DB creando un piano di test in `extension.ts activate()` e verificando che persista dopo restart
