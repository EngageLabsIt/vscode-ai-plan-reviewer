# EPIC 5 — Versioning & Diff (Closing the Loop)

**Priorità**: P1
**Sprint**: 6-7
**Stima**: 5-6 giorni
**Dipendenze**: Epic 4 completata

---

## Contesto

Il prompt è stato generato e l'utente lo ha incollato in Copilot Chat. L'AI ha prodotto un nuovo piano. Ora dobbiamo chiudere il loop: catturare la nuova versione, mostrare il diff, portare avanti i commenti non risolti, e permettere un nuovo ciclo di review.

Questa epic è la più complessa tecnicamente. Prenditi il tempo necessario.

---

## Story 5.1 — Cattura nuova versione

**Come** sviluppatore, **voglio** catturare il nuovo piano come versione successiva, **per** continuare il ciclo di review.

### Tasks

1. Modificare il comando `planReviewer.newReview`:
   - Se ci sono piani con status `in_review` o `needs_revision`:
     - QuickPick con opzioni:
       - Per ogni piano attivo: "Add as v{N+1} to: {Plan Title}"
       - "Start new plan"
     - Se c'è un solo piano attivo, pre-selezionarlo
   - Se l'utente sceglie di aggiungere una versione:
     - Crea nuovo record `Version` con `versionNumber` incrementato
     - Parsa le sezioni del nuovo markdown
     - Aggiorna `plans.updated_at`
     - Apre la WebView con la nuova versione
2. Aggiornare il version selector nella toolbar:
   - Dropdown mostra tutte le versioni: "v1", "v2", "v3"...
   - La versione corrente è selezionata
   - Click su una versione diversa → carica e renderizza quella versione

### Criteri di accettazione

- [ ] Il QuickPick offre le opzioni corrette in base ai piani attivi
- [ ] La nuova versione viene salvata con version_number corretto
- [ ] Le sezioni vengono ri-parsate per il nuovo contenuto
- [ ] Il version selector nella toolbar funziona
- [ ] Navigare tra versioni carica il contenuto e i commenti corretti

---

## Story 5.2 — Diff Engine

**Come** sviluppatore, **voglio** vedere il diff tra due versioni del piano, **per** capire cosa è cambiato.

### Tasks

1. Creare `src/extension/services/DiffEngine.ts`:
   - Input: content v(N) e content v(N+1)
   - Output: array di `DiffLine` objects:
     ```typescript
     interface DiffLine {
       type: 'added' | 'removed' | 'unchanged' | 'modified';
       lineNumberOld: number | null;
       lineNumberNew: number | null;
       content: string;
       oldContent?: string; // solo per type 'modified'
     }
     ```
   - Usare una libreria diff (consigliata: `diff` npm package, metodo `diffLines`)
2. Creare `src/extension/services/CommentMapper.ts`:
   - Input: commenti di v(N) + diff output
   - Output: per ogni commento, una mappa alla riga corrispondente in v(N+1):
     ```typescript
     interface MappedComment {
       comment: Comment;
       newTargetStart: number | null; // null = la riga è stata cancellata (orphaned)
       newTargetEnd: number | null;
       status: 'probably_resolved' | 'probably_unresolved' | 'orphaned';
     }
     ```
   - Logica di mapping:
     - Se la riga commentata è stata modificata → `probably_resolved`
     - Se la riga commentata è identica → `probably_unresolved`
     - Se la riga commentata è stata cancellata → `orphaned`

### Criteri di accettazione

- [ ] Il diff engine produce un output corretto per aggiunte, rimozioni, modifiche
- [ ] Il CommentMapper mappa i commenti alle nuove righe
- [ ] I commenti orphaned sono identificati correttamente
- [ ] I commenti su range funzionano (non solo singole righe)

---

## Story 5.3 — Diff View nella WebView

**Come** sviluppatore, **voglio** vedere il diff visualmente nella WebView, **per** confrontare le versioni a colpo d'occhio.

### Tasks

1. Creare `src/webview/components/DiffViewer.tsx`:
   - Due modalità toggle: **Inline diff** e **Side-by-side diff**
   - **Inline diff** (default):
     - Le righe rimosse hanno sfondo rosso chiaro + testo barrato
     - Le righe aggiunte hanno sfondo verde chiaro
     - Le righe invariate hanno sfondo normale
     - I numeri di riga mostrano entrambe le numerazioni: "12 → 15"
   - **Side-by-side diff**:
     - Due colonne: v(N) a sinistra, v(N+1) a destra
     - Le righe sono allineate (con righe vuote per gli inserimenti/cancellazioni)
2. Bottone nella toolbar: "Toggle Diff View" (Ctrl+Shift+D)
   - Quando attivo, la WebView mostra il diff invece del piano singolo
   - Il version selector mostra "v1 ↔ v2" (seleziona la coppia da confrontare)
3. Nella diff view, i commenti della versione precedente appaiono con indicatore di stato:
   - ✅ verde: `probably_resolved`
   - ⚠️ arancione: `probably_unresolved`
   - 🚫 grigio: `orphaned`

### Criteri di accettazione

- [ ] Toggle diff view on/off dalla toolbar
- [ ] Inline diff mostra aggiunte/rimozioni/modifiche con colori
- [ ] Side-by-side diff allinea le righe
- [ ] I commenti della versione precedente mostrano lo status di risoluzione
- [ ] Si può navigare tra coppie di versioni (v1↔v2, v2↔v3, etc.)

---

## Story 5.4 — Carry-over dei commenti non risolti

**Come** sviluppatore, **voglio** che i commenti non risolti vengano portati avanti alla nuova versione, **per** non dover riscrivere feedback ancora validi.

### Tasks

1. Quando si cattura una nuova versione (Story 5.1), dopo il salvataggio:
   - Esegui il `CommentMapper` per mappare i commenti della versione precedente
   - Per i commenti `probably_unresolved`:
     - Crea una copia del commento nella nuova versione con le nuove coordinate
     - Il commento originale viene marcato `resolved: false` (resta com'è)
     - La copia ha un badge "Carried over from v{N}"
   - Per i commenti `probably_resolved`:
     - Marca il commento originale come `resolved: true`
     - Non copiarlo nella nuova versione
   - Per i commenti `orphaned`:
     - Non copiarli
     - Mostrali in una sezione dedicata "Orphaned Comments" nella diff view
2. L'utente può sempre:
   - Marcare manualmente un commento come risolto (override)
   - "Revive" un commento orphaned (ri-ancorarlo a una nuova riga manualmente)

### Criteri di accettazione

- [ ] I commenti unresolved vengono copiati alla nuova versione con nuove coordinate
- [ ] I commenti resolved vengono marcati come tali
- [ ] I commenti orphaned appaiono nella sezione dedicata
- [ ] L'utente può fare override manuale (resolve/unresolve)
- [ ] I commenti carried-over hanno il badge visivo
- [ ] Il ciclo review → prompt → cattura → carry-over funziona end-to-end

---

## Story 5.5 — Test end-to-end del loop completo

**Come** sviluppatore, **voglio** verificare che il loop completo funzioni, **per** avere fiducia nella feature.

### Tasks

1. Creare una test suite (può essere manuale con checklist) che verifica:
   - Catturare piano v1 → aggiungere commenti → generare prompt → catturare v2 → vedere diff → commenti carried over → aggiungere nuovi commenti → generare prompt v2 → catturare v3
2. Creare test fixtures:
   - `test-fixtures/plan-v1.md` — piano iniziale
   - `test-fixtures/plan-v2.md` — piano rivisto (alcune sezioni cambiate, alcune uguali)
   - `test-fixtures/plan-v3.md` — piano finale
3. Scrivere unit test per:
   - `DiffEngine` — verifica output corretto per vari scenari di diff
   - `CommentMapper` — verifica mapping corretto (resolved, unresolved, orphaned)
   - `PromptGenerator` — verifica output per varie combinazioni di commenti

### Criteri di accettazione

- [ ] Il loop completo 3 iterazioni funziona senza errori
- [ ] Unit test passano per DiffEngine, CommentMapper, PromptGenerator
- [ ] I test fixture coprono casi realistici

---

## Definition of Done — Epic 5

L'utente può:
1. Catturare versioni successive dello stesso piano
2. Vedere il diff tra qualsiasi coppia di versioni
3. Vedere quali commenti sono stati risolti/non risolti/orphaned
4. I commenti non risolti vengono portati avanti automaticamente
5. **Il loop completo è funzionante end-to-end**

**Questo è il punto in cui il plugin diventa davvero potente.**

---

## Note per Claude Code

- Per la libreria diff, usa il package `diff` (npm) — è leggero e ben mantenuto. Il metodo `diffLines()` è quello che serve
- Il `CommentMapper` è la parte più delicata. L'algoritmo deve gestire: inserimenti (le righe successive si spostano in avanti), cancellazioni (le righe successive si spostano indietro), e modifiche (la riga cambia ma la posizione resta)
- Per il side-by-side diff, attenzione allo scroll sincronizzato: lo scroll di una colonna deve muovere anche l'altra
- I commenti carried-over sono nuove entry nel DB (nuovo UUID, nuovo version_id). Non sono riferimenti ai commenti originali. Ma un campo opzionale `carried_from_id` può tracciare la provenienza
- Aggiungi il campo `carried_from_id TEXT REFERENCES comments(id)` alla tabella comments (migration v2)
