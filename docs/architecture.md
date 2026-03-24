# Plan Reviewer — Architettura tecnica

## 1. Cos'è Plan Reviewer

Plan Reviewer è una VS Code extension per revisionare piani AI con commenti inline, con un'esperienza simile alle PR review di GitHub.

**Flusso tipico:**
1. Genera un piano con un AI (Copilot, Claude, ecc.)
2. Copia il markdown negli appunti ed esegui il comando _New Review_
3. Aggiungi commenti inline alle righe o sezioni del piano
4. Esporta il feedback come prompt strutturato e invialo all'AI
5. Incolla il piano rigenerato come nuova versione — i commenti non risolti vengono ri-ancorati automaticamente

---

## 2. Architettura — modello a due processi

VS Code impone una separazione netta tra il processo host (Node.js) e la webview (iframe sandboxed). I due layer comunicano esclusivamente via `postMessage`.

```
┌─────────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)                        │
│                                                          │
│  extension.ts ──► commands/ ──► services/ ──► db/        │
│                                    │                     │
│               PlanReviewPanel (bridge) ◄─────────────┐  │
└───────────────────────────┬─────────────────────────────┘
                            │  postMessage (HostMessage)
                            │  postMessage (WebViewMessage)
┌───────────────────────────▼─────────────────────────────┐
│  Webview (React, IIFE, browser sandbox)                  │
│                                                          │
│  index.tsx ──► App.tsx ──► components/                   │
│                   │                                      │
│           message handler ──► vscode.postMessage         │
└─────────────────────────────────────────────────────────┘
```

**Extension host** — gestisce DB, parsing, diff, mapping commenti, comandi VS Code, sidebar.
**Webview** — UI pura React: riceve dati via `planLoaded`, mostra il piano, raccoglie commenti, rimanda tutto all'host.

---

## 3. Struttura cartelle

```
src/
  extension/          VS Code host (Node.js)
    extension.ts      Punto di attivazione, registrazione comandi e sidebar
    commands/         Handler dei comandi (newReview, loadTestPlan, exportPlan, importPlan)
    db/               SQLite via sql.js: database.ts, migrations.ts, repositories/
    services/         MarkdownParser, DiffEngine, CommentMapper
    views/            PlanExplorerProvider (sidebar tree view)
    webview/          PlanReviewPanel (bridge lato host per la webview)

  webview/            React UI (gira nell'iframe)
    index.tsx         Entry point, monta App
    App.tsx           Root component, state management, message handler
    components/       ReviewToolbar, PlanViewer, CommentCard, CommentForm, CodeBlock, …
    styles/           planViewer.css — tutto il CSS (naming BEM)

  shared/             Codice condiviso tra host e webview
    models.ts         Tipi core: Plan, Version, Section, Comment, DiffLine, MappedComment
    messages.ts       HostMessage / WebViewMessage (union discriminate)
    PromptGenerator.ts  Converte commenti in prompt markdown strutturato per AI
    constants.ts      Costanti e type guard condivisi

  test/
    *.test.ts         Unit test (Vitest)
    e2e/              Test Playwright (usa docs/plan-reviewer-demo.html come harness)
```

---

## 4. Modelli dati (`src/shared/models.ts`)

| Tipo | Campi chiave | Note |
|------|-------------|------|
| `Plan` | `id`, `title`, `source`, `status`, `tags` | `status`: `in_review` \| `archived` |
| `Version` | `id`, `planId`, `versionNumber`, `content`, `reviewPrompt` | `versionNumber` parte da 1 e incrementa |
| `Section` | `id`, `versionId`, `heading`, `startLine`, `endLine`, `level`, `orderIndex` | Linee 1-based, inclusive |
| `Comment` | `id`, `versionId`, `type`, `targetStart`, `targetEnd`, `body`, `resolved`, `carriedFromId` | `type`: `line` \| `range` \| `section` |
| `DiffLine` | `type`, `lineNumberOld`, `lineNumberNew`, `content`, `oldContent?` | `type`: `added` \| `removed` \| `unchanged` \| `modified` |
| `MappedComment` | `comment`, `newTargetStart`, `newTargetEnd`, `status` | `status`: vedi §6 CommentMapper |

**Convenzioni:**
- Line numbers **1-based** ovunque (DB, modelli, UI)
- ID: **UUID v7** per tutti gli entity
- Timestamp: stringhe **ISO 8601**
- TypeScript usa **camelCase**; il DB usa **snake_case** (la mappatura avviene nei repository)

---

## 5. Messaggistica host ↔ webview (`src/shared/messages.ts`)

Tutte le comunicazioni usano union discriminate — ogni messaggio ha un campo `type` letterale.

### Host → WebView (`HostMessage`)

| `type` | Payload | Quando |
|--------|---------|--------|
| `planLoaded` | `{ plan, version, versions, sections, comments }` | Dopo newReview o requestPlan |
| `commentAdded` | `Comment` | Dopo insert in DB |
| `commentUpdated` | `Comment` | Dopo update in DB |
| `commentDeleted` | `{ commentId }` | Dopo delete in DB |
| `planStatusUpdated` | `{ planId, status }` | Dopo updatePlanStatus |
| `diffLoaded` | `{ diffLines, oldVersionNumber, newVersionNumber, mappedComments }` | In risposta a requestDiff |
| `error` | `{ message }` | Qualsiasi errore lato host |

### WebView → Host (`WebViewMessage`)

| `type` | Payload | Quando |
|--------|---------|--------|
| `addComment` | `Omit<Comment, 'id' \| 'createdAt'>` | L'utente salva un commento |
| `updateComment` | `{ id, body? }` | L'utente modifica un commento |
| `deleteComment` | `{ id }` | L'utente elimina un commento |
| `resolveComment` | `{ id }` | L'utente risolve un commento |
| `requestPlan` | `{ planId, versionNumber? }` | Cambio versione dalla toolbar |
| `requestDiff` | `{ planId, versionNumberOld, versionNumberNew }` | Apre la vista diff |
| `updatePlanStatus` | `{ planId, status, note? }` | Modifica stato piano |
| `saveReviewPrompt` | `{ versionId, prompt }` | Salva il prompt generato |
| `ready` | — | Webview pronta a ricevere dati |

---

## 6. Servizi principali

### MarkdownParser (`src/extension/services/MarkdownParser.ts`)

Converte il testo markdown in `ParsedSection[]`. Usa una strategia a cascata:
1. **heading** — rileva `#` / `##` / ecc. → strategia predefinita se presenti
2. **bold** — rileva righe `**testo**` autonome
3. **numbered** — rileva elementi `1. Titolo`

Le code fence (` ``` `) sono tracciate con un flag booleano: le righe al loro interno non vengono mai considerate section starter.

Il titolo del piano è estratto dal primo heading trovato nel documento.

### DiffEngine (`src/extension/services/DiffEngine.ts`)

Wrapper della libreria npm `diff`. Chiama `diffLines()` su due contenuti stringa e produce `DiffLine[]` con line numbers 1-based sia per la vecchia che per la nuova versione.

### CommentMapper (`src/extension/services/CommentMapper.ts`)

Classe pura (nessuno stato) che ri-ancora i commenti tra versioni.

Logica in un singolo pass su `DiffLine[]`:
- **`probably_unresolved`** — le righe target esistono ancora invariate nella nuova versione → il commento viene copiato con posizione aggiornata
- **`probably_resolved`** — le righe target sono state rimosse e seguite immediatamente da righe aggiunte (modifica testuale) → il commento viene marcato come risolto nella vecchia versione e non copiato
- **`orphaned`** — le righe target sono state cancellate senza alcuna aggiunta adiacente → il commento resta nella vecchia versione, non viene copiato

### PromptGenerator (`src/shared/PromptGenerator.ts`)

Produce un prompt markdown strutturato per l'AI a partire dai commenti. Due modalità:
- **`same_session`** — include il contenuto completo del piano (sessione corrente aperta con l'AI)
- **`new_session`** — include solo contesto necessario (nuova finestra AI)

Ogni commento viene serializzato con il riferimento testuale (`[Line N]`, `[Lines N–M]`, `[Section "Titolo"]`) e un estratto quotato delle righe target (max 8 righe).

---

## 7. Database (SQLite via sql.js)

Il database gira **in-memory** con sql.js (WebAssembly), e viene **persistito su file** in `~/.vscode/plan-reviewer.db` tramite `globalStorageUri` di VS Code. Al caricamento il file viene letto in memoria; dopo ogni scrittura viene salvato su disco.

### Schema (5 migration)

| Versione | Modifica |
|----------|---------|
| V1 | Schema iniziale: tabelle `plans`, `versions`, `sections`, `comments`, `schema_version` + indici |
| V2 | `comments.carried_from_id` — traccia il commento di origine nel carry-over |
| V3 | `comments.target_start_char`, `target_end_char` — selezione testuale parziale |
| V4 | Normalizzazione categoria a `suggestion` per tutti i commenti esistenti |
| V5 | `comments.selected_text` — testo selezionato al momento del commento |

### Repositories

- **`PlanRepository`** — CRUD per `Plan` e `Version`; metodi: `findAll`, `findById`, `insert`, `update`, `findVersionsByPlanId`, `insertVersion`
- **`CommentRepository`** — CRUD per `Comment`; metodi: `findByVersionId`, `findUnresolvedByVersionId`, `insert`, `update`, `delete`
- **`SectionRepository`** — insert e lookup per `Section`

---

## 8. Flusso "New Review" (passo chiave)

Il comando `planReviewer.newReview` esegue questi passi in sequenza:

```
1. Leggi clipboard                 → contenuto markdown
2. Parse markdown                  → titolo + ParsedSection[]
3. Carica piani in_review/needs_revision dal DB
4. Mostra QuickPick                → nuovo piano o versione aggiuntiva a un piano esistente
5. Crea Plan in DB                 (solo se nuovo piano)
6. Crea Version in DB
7. Crea Sections in DB
8. Carry-over commenti             (solo se versionNumber > 1)
   ├─ Carica commenti non risolti della versione precedente
   ├─ DiffEngine.compute(prevContent, newContent)
   ├─ CommentMapper.map(comments, diffLines)
   ├─ probably_unresolved → inserisce copia con posizione aggiornata
   ├─ probably_resolved   → marca il commento originale come risolto
   └─ orphaned            → non fa nulla
9. Refresh sidebar (PlanExplorerProvider)
10. Apri/porta in primo piano la webview (PlanReviewPanel)
11. Invia messaggio planLoaded con tutti i dati
```

---

## 9. Singletons

| Classe | Accesso | Ruolo |
|--------|---------|-------|
| `Database` | `Database.getInstance()` | Unica istanza del DB in-memory |
| `PlanReviewPanel` | `PlanReviewPanel.instance` | Pannello webview aperto (null se chiuso) |
| `PlanExplorerProvider` | `PlanExplorerProvider._instance` | Sidebar tree view |

**Ordine di inizializzazione in `extension.ts`:**
1. `Database.getInstance()` — DB pronto
2. `new PlanExplorerProvider(...)` — sidebar registrata
3. Registrazione comandi — i comandi usano DB e provider già inizializzati

---

## 10. Testing

### Unit test (Vitest)

File in `src/test/`:

| File | Cosa testa |
|------|-----------|
| `DiffEngine.test.ts` | Produzione corretta di `DiffLine[]` con line numbers |
| `CommentMapper.test.ts` | Status `probably_unresolved` / `probably_resolved` / `orphaned` |
| `PromptGenerator.test.ts` | Formato del prompt generato nelle due modalità |
| `migrations.test.ts` | Idempotenza e upgrade delle migration |
| `demo-scenarios.test.ts` | Scenari end-to-end sui dati demo |

Esecuzione singolo file: `npx vitest run src/test/DiffEngine.test.ts`

### E2E e capture (Playwright)

I test Playwright in `src/test/e2e/` usano `docs/plan-reviewer-demo.html` come harness standalone — un'HTML page che carica il bundle React senza avviare VS Code. Questo permette di testare e catturare screenshot/video dell'UI senza l'overhead dell'extension host.

---

## 11. Build

esbuild compila due entry point **in parallelo**:

| Entry point | Output | Formato | Target |
|-------------|--------|---------|--------|
| `src/extension/extension.ts` | `dist/extension.js` | CJS | Node.js |
| `src/webview/index.tsx` | `dist/webview.js` | IIFE | Browser |

Il file `sql-wasm.wasm` viene copiato da `node_modules/sql.js/dist/` a `dist/` ad ogni build.

### Script npm

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Watch mode — rebuild automatico al salvataggio |
| `npm run build` | Build di produzione |
| `npm run compile` | Solo type-check (tsc --noEmit), nessun output |
| `npm run lint` | ESLint |
| `npm run test` | Unit test (Vitest) |
| `npm run test:e2e` | E2E test (Playwright) |
| `npm run package` | Build + genera `.vsix` per la distribuzione |
