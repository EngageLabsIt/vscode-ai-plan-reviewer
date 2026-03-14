# PBI — Ricerca Testuale nella Preview

## Descrizione

Come reviewer, voglio poter cercare testo nel piano visualizzato nella preview, in modo da trovare rapidamente sezioni o parole chiave senza scorrere manualmente.

## Criteri di Accettazione

- AC-01: Ctrl+F (Cmd+F su Mac) apre una barra di ricerca sotto la toolbar
- AC-02: Un bottone "search" nella toolbar apre/chiude la barra di ricerca
- AC-03: Digitando nella barra, le righe con match vengono evidenziate in giallo tenue
- AC-04: Un counter mostra "N / M" (indice corrente / totale match)
- AC-05: Enter avanza al match successivo, Shift+Enter torna al precedente
- AC-06: Il match corrente è evidenziato più intensamente e scrollato in vista
- AC-07: Escape chiude la barra e rimuove tutti gli highlight
- AC-08: La ricerca è case-insensitive

## Task

### T1: Creare componente `SearchBar.tsx`
Componente con input, counter, bottoni prev/next/close con icone Material Symbols.

### T2: Aggiungere stato search in `App.tsx`
Stato per query, match, indice. Keydown handler per Ctrl+F. Handlers per navigazione e chiusura.

### T3: Aggiungere bottone Search nella `ReviewToolbar.tsx`
Bottone con icona `search` nella sezione destra, prima del Navigator toggle.

### T4: Aggiungere props search a `PlanViewer.tsx`
Props `searchMatches` e `searchCurrentLine`. Classi CSS per highlight. Scroll automatico al match corrente.

### T5: Aggiungere stili CSS in `planViewer.css`
Stili per `.search-bar`, `.line-row--search-match`, `.line-row--search-current`.

### T6: Aggiornare demo HTML e test E2E
Aggiungere funzionalità search al demo HTML. Aggiungere test Playwright per Ctrl+F, match, navigazione, chiusura.
