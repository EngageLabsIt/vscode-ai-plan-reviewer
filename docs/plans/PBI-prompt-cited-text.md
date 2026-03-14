# PBI — Prompt con citazione testo del piano

## Descrizione

Come reviewer, voglio che il prompt generato riporti il testo esatto del piano
a cui si riferisce ogni commento, in modo da rendere il feedback autocontenuto
e comprensibile senza dover riaprire il piano.

## Criteri di Accettazione

- AC-01: Ogni commento nel prompt mostra un blockquote con il testo del piano
         che precede il corpo del commento
- AC-02: Per commenti di tipo `line`, viene citata la riga esatta
- AC-03: Per commenti di tipo `range`, vengono citate le righe target_start..target_end
- AC-04: Per commenti di tipo `section`, vengono citate le righe start_line..end_line
         della section corrispondente
- AC-05: Se il range supera 8 righe, viene mostrato un `> ...` di troncamento
- AC-06: Il riferimento appare in grassetto su riga propria: `**[Line N]**`
- AC-07: Nessuna categoria mostrata nel prompt (campo `category` ignorato; ridondante dopo migrazione V4)
- AC-08: Tutti i test esistenti di PromptGenerator passano con il nuovo formato

## Task

### T1: Aggiornare PromptGenerator.ts ✅
Aggiungere `extractLines()`. Riscrivere `formatEntry()` per includere il blockquote.
Aggiornare `feedbackBody` per usare `formatEntry`.

### T2: Aggiornare PromptGenerator.test.ts ✅
Aggiornare i test esistenti al nuovo formato. Aggiungere test per citazione,
truncation e section range.

### T3: Creare il PBI in docs/plans ✅
Scrivere `docs/plans/PBI-prompt-cited-text.md` con i criteri sopra.
