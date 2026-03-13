# EPIC 1 — Plan Capture & Rendering

**Priorità**: P0
**Sprint**: 2
**Stima**: 3-4 giorni
**Dipendenze**: Epic 0 completata

---

## Contesto

L'infrastruttura è pronta (Epic 0). Ora diamo al plugin la sua prima feature utente: catturare un piano dalla clipboard e visualizzarlo nella WebView con numeri di riga, sezioni collassabili e syntax highlighting per i blocchi di codice.

Al termine di questa epic, l'utente può copiare un piano da Copilot Chat, invocarlo nel plugin, e vederlo renderizzato in modo leggibile.

---

## Story 1.1 — Comando di cattura piano

**Come** sviluppatore, **voglio** catturare un piano markdown dalla clipboard con un comando, **per** iniziare il processo di review.

### Tasks

1. Creare il comando `planReviewer.newReview` registrato in `package.json` (contributes.commands) e nel Command Palette
2. Quando invocato:
   - Legge il contenuto dalla clipboard (`vscode.env.clipboard.readText()`)
   - Se la clipboard è vuota → mostra un messaggio informativo con istruzioni
   - Se contiene testo:
     a. Crea un record `Plan` con titolo estratto dal primo heading (o "Untitled Plan" + timestamp)
     b. Crea un record `Version` (versionNumber: 1) con il contenuto markdown
     c. Parsa il markdown per estrarre le sezioni (heading) → crea record `Section`
     d. Apre la WebView con il piano appena creato
3. Gestire il caso "piano sovrapposto": se esiste già un piano con status `in_review`, mostrare un QuickPick:
   - "Add as version {N} to: {Plan Title}"
   - "Start new plan"

### Parsing sezioni — regole

Usare una heuristic chain per estrarre le sezioni dal markdown:
1. Cercare heading markdown (`# `, `## `, `### `, etc.)
2. Se non ci sono heading, cercare righe in bold (`**...**`)
3. Se niente, cercare pattern numerati (`1. `, `2. `, etc.) come sezioni
4. Ogni sezione va dalla sua riga di inizio fino alla riga prima della sezione successiva (o fine file)

Creare un `MarkdownParser` service in `src/extension/services/MarkdownParser.ts` per questa logica.

### Criteri di accettazione

- [ ] Il comando appare nel Command Palette come "Plan Reviewer: New Review"
- [ ] Il piano viene catturato dalla clipboard e salvato nel DB
- [ ] Il titolo viene estratto automaticamente dal primo heading
- [ ] Le sezioni vengono identificate e salvate nel DB
- [ ] Se la clipboard è vuota, appare un messaggio informativo
- [ ] Se c'è un piano in review, viene offerta la scelta "add version" / "new plan"
- [ ] La WebView si apre automaticamente dopo la cattura

---

## Story 1.2 — Rendering del piano nella WebView

**Come** sviluppatore, **voglio** vedere il piano renderizzato nella WebView con numeri di riga, **per** poterlo leggere in modo strutturato.

### Tasks

1. Creare `src/webview/components/PlanViewer.tsx`:
   - Riceve il contenuto markdown e le sezioni come props
   - Splitta il markdown in righe
   - Renderizza ogni riga con il suo numero di riga a sinistra (gutter)
   - Il gutter ha stile simile a un editor di codice (grigio, monospace, allineato a destra)
   - Il contenuto markdown viene renderizzato come HTML (usare `marked` o simile)
2. Creare `src/webview/components/LineGutter.tsx`:
   - Mostra il numero di riga
   - Al hover, mostra un'icona "+" per aggiungere commenti (preparazione per Epic 2, per ora solo visuale)
3. Syntax highlighting per blocchi di codice:
   - Usare `highlight.js` (bundle leggero con i linguaggi più comuni: js, ts, python, bash, json, yaml, sql)
   - I blocchi ` ```lang ``` ` vengono renderizzati con highlighting
4. Sezioni collassabili:
   - Ogni heading è cliccabile per collassare/espandere la sua sezione
   - Icona chevron (▶/▼) a fianco dell'heading
   - Le sezioni sono tutte espanse per default

### Layout della WebView

```
┌─────────────────────────────────────────────┐
│  [Plan Title]                    [v1] [...]  │  ← Toolbar (placeholder per ora)
├─────────────────────────────────────────────┤
│  1  │ # My Implementation Plan              │
│  2  │                                        │
│  3  │ ▼ ## Step 1: Setup Database            │
│  4  │   Create a PostgreSQL database...      │
│  5  │   ```sql                               │
│  6  │   CREATE TABLE users (                 │  ← syntax highlighted
│  7  │     id SERIAL PRIMARY KEY              │
│  8  │   );                                   │
│  9  │   ```                                  │
│ 10  │                                        │
│ 11  │ ▼ ## Step 2: API Design                │
│ 12  │   Use Express.js with...               │
└─────────────────────────────────────────────┘
```

### Criteri di accettazione

- [ ] Il piano viene renderizzato con numeri di riga visibili
- [ ] Il markdown viene convertito in HTML formattato (heading, bold, liste, link)
- [ ] I blocchi di codice hanno syntax highlighting
- [ ] Le sezioni (heading) sono collassabili
- [ ] Il rendering rispetta il tema VS Code (chiaro/scuro)
- [ ] Il font del gutter è monospace, il font del contenuto segue il tema VS Code
- [ ] Lo scroll funziona fluidamente su piani di 200+ righe

---

## Story 1.3 — Flusso completo: cattura → rendering

**Come** sviluppatore, **voglio** che il flusso cattura-rendering funzioni end-to-end, **per** poter testare il plugin su piani reali.

### Tasks

1. Collegare il comando di cattura (Story 1.1) al rendering (Story 1.2):
   - Dopo la cattura, l'host invia il messaggio `planLoaded` alla WebView
   - La WebView riceve e renderizza
2. Gestire il caso "WebView già aperta":
   - Se la WebView è già aperta, aggiornare il contenuto senza riaprire
   - Se è in background, portarla in foreground (`reveal()`)
3. Aggiungere un piano di test per lo sviluppo:
   - File `test-fixtures/sample-plan.md` con un piano realistico (15-20 sezioni, blocchi di codice, liste miste)
   - Comando dev-only `planReviewer.loadTestPlan` che carica il fixture

### Criteri di accettazione

- [ ] Copiare markdown → Ctrl+Shift+P → "New Review" → la WebView mostra il piano
- [ ] Ripetere il processo aggiorna la WebView esistente
- [ ] Il piano di test funziona correttamente
- [ ] Nessun errore nella console dello sviluppatore

---

## Definition of Done — Epic 1

L'utente può:
1. Copiare un piano markdown da Copilot Chat (o qualsiasi fonte)
2. Invocarlo nel plugin con un comando
3. Vederlo renderizzato con numeri di riga, sezioni collassabili, syntax highlighting
4. Il piano è persistito nel database

Non può ancora: commentare, generare prompt, vedere diff.

---

## Note per Claude Code

- Per il markdown rendering, valuta `marked` (leggero) o `markdown-it` (più estendibile). Marked è preferibile per semplicità
- `highlight.js` ha bundle selettivi — importa solo i linguaggi necessari per ridurre la dimensione del webview bundle
- Il `MarkdownParser` deve essere robusto: il markdown di Copilot non è sempre pulito. Gestisci heading senza spazio dopo `#`, blocchi di codice non chiusi, liste indentate in modo inconsistente
- Per le sezioni collassabili, usa un semplice stato React `collapsedSections: Set<string>` piuttosto che una libreria esterna
- Ricorda di gestire i link nel markdown: devono aprirsi nel browser esterno (`window.open`) e non navigare dentro la WebView
