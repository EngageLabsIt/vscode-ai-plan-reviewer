# EPIC 4 — Review Prompt Generation

**Priorità**: P0
**Sprint**: 5
**Stima**: 2-3 giorni
**Dipendenze**: Epic 2 completata (Epic 3 consigliata ma non bloccante)

---

## Contesto

Questa è la feature che chiude la prima metà del loop: i commenti dell'utente diventano un prompt strutturato, pronto per essere incollato in Copilot Chat. È il ponte tra la review umana e la ri-pianificazione AI.

---

## Story 4.1 — PromptGenerator Service

**Come** sviluppatore, **voglio** che i miei commenti vengano trasformati in un prompt strutturato, **per** comunicare feedback preciso all'AI.

### Tasks

1. Creare `src/extension/services/PromptGenerator.ts`:
   - Input: array di `Comment` + `Version` corrente
   - Output: stringa markdown formattata
   - Raggruppa i commenti per categoria (issues first, poi suggestions, poi questions)
   - Per ogni commento, include: il riferimento alla riga/range/sezione + il testo del commento
   - Non include il piano intero (modalità "same session")
2. Template default del prompt:

```markdown
## Plan Review — Iteration {N}

The plan has been reviewed. Here is the feedback to apply to the next version:

### Issues (must fix)
- **[Line 12]** The database setup doesn't handle rollback on error. Add a rollback mechanism.
- **[Lines 25-30]** JWT authentication doesn't consider refresh tokens. Integrate the refresh flow.

### Suggestions (recommended improvements)
- **[Section "Step 3: API Design"]** Consider using a CQRS pattern instead of pure REST for write operations.

### Questions (clarification needed)
- **[Line 8]** Why PostgreSQL instead of SQLite for a prototype? Justify the choice.

### Approved sections (keep as-is)
- [Section "Step 1: Project Setup"] ✅
- [Line 42] ✅

Please generate an updated version of the plan that:
1. Resolves all issues
2. Integrates suggestions where appropriate
3. Answers questions within the plan context
4. Keeps approved and uncommented sections unchanged
```

3. Il template deve essere configurabile via VS Code settings (`planReviewer.promptTemplate`)
4. Supportare la variabile `{lang}` per la lingua (default: English)

### Criteri di accettazione

- [ ] Il service genera un prompt markdown corretto dai commenti
- [ ] I commenti sono raggruppati per categoria
- [ ] Ogni commento ha il riferimento alla riga/range/sezione
- [ ] Le sezioni approvate (o non commentate) sono elencate come "keep as-is"
- [ ] Il template è configurabile via settings

---

## Story 4.2 — "Full Context" Prompt Mode

**Come** sviluppatore, **voglio** poter generare un prompt che include anche il piano completo, **per** usarlo in una nuova sessione di Copilot Chat.

### Tasks

1. Estendere `PromptGenerator` con due modalità:
   - **"Same session"**: solo commenti (Story 4.1)
   - **"New session"**: piano completo + commenti
2. Il prompt "New session" ha questo formato:

```markdown
## Plan to Review

{contenuto completo del piano markdown}

---

## Review Feedback — Iteration {N}

{stessa struttura della Story 4.1}
```

3. Quando il piano ha più di un certo numero di ore (configurabile, default: 4h) dalla creazione, il plugin suggerisce automaticamente "New session" mode con un avviso: "This plan was created {N} hours ago. Copilot might not remember it. Use 'Full context' mode?"

### Criteri di accettazione

- [ ] Due modalità: "Same session" (leggero) e "New session" (piano + commenti)
- [ ] Warning automatico se il piano è vecchio
- [ ] L'utente sceglie la modalità prima dell'export

---

## Story 4.3 — Export e Clipboard

**Come** sviluppatore, **voglio** copiare il prompt in clipboard con un click, **per** incollarlo in Copilot Chat.

### Tasks

1. Bottone "Generate Review Prompt" nella toolbar della WebView (visibile solo se status = "in_review" o "needs_revision" e ci sono commenti)
2. Click → mostra una preview del prompt in un modal/panel:
   - L'utente può leggere il prompt prima di copiarlo
   - Può scegliere la modalità (same session / new session) con un toggle
   - Bottone "Copy to Clipboard" che copia e chiude il modal
   - Feedback visivo: "✓ Copied to clipboard! Paste in Copilot Chat."
3. Il prompt generato viene salvato in `versions.review_prompt` (come riferimento storico per capire cosa ha generato la versione successiva)
4. Shortcut: `Ctrl+Shift+G` per generare direttamente

### Criteri di accettazione

- [ ] Il bottone "Generate Review Prompt" appare nella toolbar
- [ ] Preview mostra il prompt generato
- [ ] Toggle same session / new session
- [ ] Copy to clipboard funziona
- [ ] Feedback visivo dopo la copia
- [ ] Il prompt viene salvato nel DB
- [ ] Il shortcut Ctrl+Shift+G funziona

---

## Definition of Done — Epic 4

L'utente può:
1. Fare la review completa del piano con commenti
2. Generare un prompt strutturato con un click
3. Scegliere se includere il piano completo o solo i commenti
4. Copiare il prompt nella clipboard e incollarlo in Copilot Chat

**A questo punto il plugin è già utilizzabile end-to-end** (anche se il loop non è automatizzato — l'utente ri-cattura manualmente il nuovo piano).

---

## Note per Claude Code

- Il `PromptGenerator` deve essere una classe pura (no dipendenze VS Code) per facilitare il testing
- Il template usa template literals con segnaposto. Attenzione alla corretta escaping del markdown
- Per la preview del prompt, usa un componente `PromptPreview.tsx` con rendering markdown readonly
- I commenti con category "approval" vengono listati nella sezione "Approved" piuttosto che mischiati con gli altri
- Se non ci sono commenti di un certo tipo, la sezione corrispondente viene omessa dal prompt
