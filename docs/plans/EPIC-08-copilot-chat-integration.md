# EPIC 8 — Copilot Chat Integration

**Priorità**: P1
**Sprint**: 10
**Stima**: 3-4 giorni
**Dipendenze**: Epic 1 completata (plan capture), Epic 0 (scaffolding)

---

## Contesto

Attualmente l'unico modo per caricare un piano in Plan Reviewer è copiarlo nella clipboard e
invocare `Plan Reviewer: New Review`. L'utente che genera un piano con Copilot Chat deve fare
copia-incolla manuale.

Questo epic introduce due miglioramenti complementari:

1. **Chat Participant `@plan-reviewer`** — l'utente seleziona il piano nel pannello chat e digita
   `@plan-reviewer /load #selection`. Il partecipante carica il piano direttamente nell'estensione.
2. **Auto-detect source clipboard** — quando si usa il comando clipboard esistente, il sistema
   rileva automaticamente se il contenuto ha la struttura di un piano generato da AI e imposta
   `source: 'copilot'` invece di `'manual'`.

### Perché non si può "intercettare" Copilot silenziosamente

L'API `vscode.ChatContext.history` include **solo** i messaggi scambiati con il partecipante
corrente (non quelli di altri partecipanti come Copilot). Non esiste un'API pubblica per leggere
la cronologia di un'altra sessione chat. I Memory Files di VS Code (`.vscode/chat-memory/`)
contengono sommari di memoria (preferenze, istruzioni), non i piani generati — questo approccio
è stato escluso.

---

## Story 8.1 — Estrazione logica di creazione piano in `PlanCreationService`

**Come** sviluppatore, **voglio** che la logica di parsing e persistenza di un piano sia in un
servizio condiviso, **per** poterla riusare sia dal comando clipboard che dal chat participant.

### Tasks

1. Creare `src/extension/services/PlanCreationService.ts`:
   - Estrarre da `src/extension/commands/newReview.ts` la sequenza: parse markdown →
     crea/aggiorna `Plan` + `Version` + `Section` nel DB → carry-over commenti
   - Esporre:
     ```typescript
     export interface CreatePlanOptions {
       content: string;
       source: 'copilot' | 'manual' | 'other';
       extensionUri: vscode.Uri;
       targetPlanId?: string; // aggiunge versione a piano esistente
     }

     export async function createPlanFromMarkdown(
       options: CreatePlanOptions,
       db: Database
     ): Promise<{ plan: Plan; version: PlanVersion; sections: Section[] }>

     export function isPlanShaped(content: string): boolean
     // → true se il contenuto ha ≥2 heading ## e ≥1 lista numerata o checklist
     ```

2. Refactoring `src/extension/commands/newReview.ts`:
   - Sostituire il blocco di inserimento DB con la chiamata al servizio
   - Dopo la lettura clipboard, usare `isPlanShaped()` per impostare `source`:
     `'copilot'` se il contenuto sembra generato da AI, altrimenti `'manual'`
   - Il QuickPick e la gestione UI rimangono nel comando

3. Refactoring `src/extension/commands/loadTestPlan.ts`:
   - Stessa sostituzione (rimuove la logica duplicata)

### Criteri di accettazione

- [ ] `PlanCreationService` esporta le tre funzioni indicate
- [ ] `newReview.ts` usa il servizio senza cambiare il comportamento visibile all'utente
- [ ] `loadTestPlan.ts` usa il servizio
- [ ] I test esistenti passano dopo il refactoring
- [ ] `isPlanShaped` restituisce `true` per un piano con heading e liste, `false` per testo libero

---

## Story 8.2 — Chat Participant `@plan-reviewer /load`

**Come** sviluppatore che usa Copilot Chat, **voglio** poter caricare un piano generato da Copilot
direttamente in Plan Reviewer con `@plan-reviewer /load #selection`, **per** evitare il
copia-incolla manuale.

### Tasks

1. Creare `src/extension/chat/planReviewerParticipant.ts`:
   - Esporta `registerChatParticipant(context: vscode.ExtensionContext): vscode.Disposable`
   - Registra il partecipante con `vscode.chat.createChatParticipant('plan-reviewer.chatParticipant', handler)`
   - Imposta `participant.iconPath = new vscode.ThemeIcon('notebook')`

2. Handler `chatParticipantHandler: vscode.ChatRequestHandler`:
   - Se `request.command !== 'load'` → risponde con testo di usage (vedi sotto)
   - **Estrazione contenuto** (in ordine di priorità):
     1. Da `request.prompt` se non vuoto (l'utente ha incollato il markdown nel messaggio)
     2. Da `request.references` — cerca un riferimento con `id === 'vscode.selection'`:
        ```typescript
        const doc = await vscode.workspace.openTextDocument(ref.value.uri);
        const content = doc.getText(ref.value.range);
        ```
     3. Da `request.references` — cerca `id === 'vscode.file'` (legge l'intero file)
   - Se nessun contenuto trovato → `response.markdown('...')` con istruzioni, return
   - Valida con `isPlanShaped()` — se fallisce → errore gentile, return
   - Chiama `createPlanFromMarkdown({ content, source: 'copilot', extensionUri })`
   - Apre `PlanReviewPanel` e posta `planLoaded`
   - Risponde:
     ```
     response.markdown('Piano caricato: **{title}** (v{n})')
     response.button({ title: 'Apri Plan Reviewer', command: 'planReviewer.openPanel' })
     ```

3. Testo di usage (quando `/load` non viene usato):
   ```
   Usa `/load` per caricare un piano in Plan Reviewer.

   **Opzione A — con #selection:**
   1. Seleziona il piano markdown nel pannello chat di Copilot
   2. Digita: `@plan-reviewer /load #selection`

   **Opzione B — incolla direttamente:**
   `@plan-reviewer /load` seguito dal markdown del piano
   ```

4. Guard in `extension.ts`:
   ```typescript
   if ('chat' in vscode) {
     context.subscriptions.push(registerChatParticipant(context));
   }
   ```
   Questo evita crash quando Copilot non è installato.

### Criteri di accettazione

- [ ] `@plan-reviewer` appare come suggerimento nell'input del chat VS Code
- [ ] `/load` appare come slash command di `@plan-reviewer`
- [ ] Selezionando testo da Copilot + `@plan-reviewer /load #selection` → il piano si apre
- [ ] Incollando markdown in `@plan-reviewer /load {markdown}` → il piano si apre
- [ ] Il piano caricato ha `source = 'copilot'`
- [ ] Se il contenuto non è un piano valido → messaggio di errore esplicativo in chat
- [ ] Se Copilot non è installato → l'estensione si attiva senza errori (guard attivo)

---

## Story 8.3 — Aggiornamento `package.json` e `extension.ts`

**Come** sviluppatore, **voglio** che il contribution point del chat participant sia registrato
correttamente, **per** far funzionare l'autocomplete del partecipante in VS Code.

### Tasks

1. `package.json` — aggiungere in `contributes`:
   ```json
   "chatParticipants": [
     {
       "id": "plan-reviewer.chatParticipant",
       "fullName": "Plan Reviewer",
       "name": "plan-reviewer",
       "description": "Load and review AI-generated plans from chat",
       "isSticky": false,
       "commands": [
         {
           "name": "load",
           "description": "Load plan from message or #selection into Plan Reviewer"
         }
       ]
     }
   ]
   ```

2. `package.json` — bumping versioni:
   - `engines.vscode`: da `^1.85.0` a `^1.90.0` (API `vscode.chat` introdotta in 1.90)
   - `@types/vscode` devDependency: da `^1.85.0` a `^1.90.0`

3. `src/extension/extension.ts` — aggiungere:
   ```typescript
   import { registerChatParticipant } from './chat/planReviewerParticipant';
   // ...
   // Nell'activate, dopo i comandi esistenti:
   if ('chat' in vscode) {
     context.subscriptions.push(registerChatParticipant(context));
   }
   ```

### Criteri di accettazione

- [ ] `npm run compile` passa senza errori dopo il bump di `@types/vscode`
- [ ] La contribution `chatParticipants` è presente nel manifest dell'estensione packagizata
- [ ] `isSticky: false` — il partecipante non rimane "appuntato" dopo ogni messaggio

---

## Definition of Done — Epic 8

L'utente può:
1. Generare un piano con Copilot Chat
2. Selezionare il testo del piano nel pannello chat
3. Digitare `@plan-reviewer /load #selection`
4. Vedere il piano caricato in Plan Reviewer con `source: 'copilot'`

In alternativa (workflow clipboard esistente):
- Copiare il piano e usare `Plan Reviewer: New Review` → `source` impostato automaticamente

---

## Ordine consigliato di implementazione

1. Story 8.1 — Servizio (`PlanCreationService`) + refactoring
2. Story 8.3 — `package.json` + engine bump (senza questo i tipi chat non compilano)
3. Story 8.2 — Chat participant (dopo che il servizio e i tipi sono pronti)

---

## Note per Claude Code

- **`context.history` limitazione**: l'API include solo i messaggi del partecipante corrente,
  non quelli di Copilot. Non tentare di leggere la risposta di Copilot dalla history.
- **Guard `if ('chat' in vscode)`**: obbligatorio — senza Copilot installato il namespace
  `vscode.chat` non esiste e il codice lancerebbe un `TypeError` a runtime.
- **`isSticky: false`**: NON impostare a `true`. Il partecipante deve essere invocato
  esplicitamente, non rimanere attivo su ogni messaggio.
- **Estrazione `#selection`**: il valore di un `vscode.ChatPromptReference` con
  `id === 'vscode.selection'` è un `vscode.Location` — usa `doc.getText(location.range)`.
- **Bump `@types/vscode`**: necessario per avere i tipi `vscode.ChatRequest`,
  `vscode.ChatContext`, `vscode.ChatResponseStream`. Il progetto usa `skipLibCheck: true`
  ma il bump è comunque richiesto per IntelliSense corretto.
- **Memory Files** (approccio scartato): `.vscode/chat-memory/` contiene sommari di memoria
  Copilot (preferenze, istruzioni), non i piani generati. Non implementare watcher su questi file.
