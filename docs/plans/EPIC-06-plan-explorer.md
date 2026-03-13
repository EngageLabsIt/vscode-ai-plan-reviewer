# EPIC 6 — Plan Explorer & History

**Priorità**: P2
**Sprint**: 8
**Stima**: 3-4 giorni
**Dipendenze**: Epic 5 completata

---

## Contesto

Il loop funziona. Ora servono gli strumenti per gestire più piani nel tempo: esplorarli, archiviarli, cercarli, e avere una visione d'insieme della storia di revisione.

---

## Story 6.1 — Plan Explorer (TreeView sidebar)

**Come** sviluppatore, **voglio** un pannello nella sidebar di VS Code con tutti i miei piani, **per** trovarli e aprirli rapidamente.

### Tasks

1. Registrare un `TreeDataProvider` in `package.json` (contributes.views + viewsContainers)
2. Creare `src/extension/views/PlanExplorerProvider.ts`:
   - Root level: raggruppamento per status ("In Review", "Approved", "Archived")
   - Sotto ogni gruppo: lista dei piani con icona, titolo, data
   - Sotto ogni piano: lista delle versioni ("v1 — 12 Mar", "v2 — 13 Mar")
   - Ogni piano mostra un badge con il numero di commenti aperti
3. Azioni contestuali (right-click menu):
   - **Open** → apre la WebView con il piano
   - **Archive** → cambia status a "archived"
   - **Delete** → conferma + cancellazione dal DB (piano + versioni + commenti)
   - **Rename** → inline rename del titolo
4. L'icona del piano nella sidebar mostra un badge con il numero totale di piani "in_review"
5. Il TreeView si aggiorna automaticamente quando si creano/modificano piani

### Criteri di accettazione

- [ ] Il Plan Explorer appare nella sidebar di VS Code
- [ ] I piani sono raggruppati per status
- [ ] Ogni piano mostra titolo, data, numero commenti aperti
- [ ] Right-click: Open, Archive, Delete, Rename
- [ ] Il badge conta i piani in review
- [ ] Si aggiorna in tempo reale

---

## Story 6.2 — Timeline di un piano

**Come** sviluppatore, **voglio** vedere la storia delle iterazioni di un piano, **per** capire come è evoluto.

### Tasks

1. Nella WebView, aggiungere un componente `PlanTimeline.tsx`:
   - Visuale orizzontale sotto la toolbar:
   ```
   v1 ──[3 issues, 2 sugg]──→ v2 ──[1 issue]──→ v3 ✅ Approved
   ```
   - Ogni nodo è un cerchio cliccabile:
     - Il colore indica lo stato (rosso = aveva issues, verde = approved, grigio = intermedio)
     - Hover: tooltip con data + riepilogo commenti
     - Click: carica quella versione
   - Le frecce tra i nodi mostrano quanti commenti sono stati risolti
2. La timeline è collassabile (toggle) per non occupare spazio quando non serve
3. Mostra il tempo trascorso tra una versione e l'altra ("2h 15m later")

### Criteri di accettazione

- [ ] Timeline visuale delle versioni sotto la toolbar
- [ ] Nodi cliccabili che caricano la versione
- [ ] Tooltip con riepilogo
- [ ] Tempo trascorso tra versioni
- [ ] Collassabile

---

## Story 6.3 — Search e Tags

**Come** sviluppatore, **voglio** cercare nei piani e organizzarli con tag, **per** ritrovarli facilmente.

### Tasks

1. Nel Plan Explorer, aggiungere una search box in cima:
   - Full-text search su: titolo piano, contenuto markdown, testo commenti
   - I risultati filtrano il TreeView in tempo reale
2. Tag system:
   - Ogni piano ha un campo `tags` (array JSON)
   - Right-click → "Add Tag" → input box → il tag viene aggiunto
   - I tag appaiono come chip nel TreeView e nella toolbar della WebView
   - Filtro per tag nel Plan Explorer
3. Tag suggeriti automaticamente: il plugin suggerisce tag basati sulle keyword del piano (es. se contiene "database" → suggerisce tag "database")

### Criteri di accettazione

- [ ] Search box nel Plan Explorer con ricerca full-text
- [ ] Aggiunta/rimozione tag su piani
- [ ] Filtro per tag nel TreeView
- [ ] Tag suggeriti (best effort, non bloccante)

---

## Story 6.4 — Export/Import

**Come** sviluppatore, **voglio** esportare un piano (con tutta la sua storia) e importarlo, **per** condividerlo con colleghi o fare backup.

### Tasks

1. Comando `planReviewer.exportPlan`:
   - Mostra QuickPick per scegliere il formato:
     - **JSON** (completo: piano + versioni + sezioni + commenti)
     - **Markdown** (solo l'ultima versione con commenti come annotazioni)
   - Salva il file con dialogo "Save As"
2. Comando `planReviewer.importPlan`:
   - Apre dialogo file picker per selezionare un JSON
   - Importa il piano con nuovi UUID (per evitare conflitti)
   - Apre il piano nella WebView

### JSON Export format

```json
{
  "exportVersion": 1,
  "exportDate": "2026-03-12T10:00:00Z",
  "plan": { "...plan fields..." },
  "versions": [
    {
      "...version fields...",
      "sections": [ "...sections..." ],
      "comments": [ "...comments..." ]
    }
  ]
}
```

### Criteri di accettazione

- [ ] Export JSON con struttura completa
- [ ] Export Markdown con commenti inline
- [ ] Import da JSON funzionante
- [ ] Nessun conflitto di ID dopo import

---

## Definition of Done — Epic 6

L'utente può:
1. Esplorare i piani dalla sidebar
2. Vedere la timeline delle iterazioni
3. Cercare e taggare i piani
4. Esportare/importare piani

---

## Note per Claude Code

- Il `TreeDataProvider` di VS Code usa un pattern specifico (`getTreeItem`, `getChildren`, `onDidChangeTreeData`). Segui l'API ufficiale
- Per la search full-text, SQLite ha `LIKE '%term%'` che funziona bene per volumi piccoli. Non serve FTS5 per ora
- L'export JSON deve gestire i circular references (non ce ne dovrebbero essere, ma usa `JSON.stringify` con cura)
- Il TreeView refresh va chiamato con `this._onDidChangeTreeData.fire()` — non forzare il refresh troppo spesso (debounce a 500ms)
