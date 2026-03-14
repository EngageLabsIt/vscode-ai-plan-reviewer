# PBI — Form Commento Inline + Selezione Testo

## Descrizione

Come reviewer, voglio che il form per aggiungere commenti appaia direttamente sotto la riga selezionata (inline) invece che come modale a schermo intero, e voglio poter commentare una selezione di testo con un bottone floating.

## Criteri di Accettazione

- AC-01: Il form commento appare inline sotto la riga cliccata, compatto (textarea + bottoni)
- AC-02: Il form inline funziona per tutti i tipi: line, range e section
- AC-03: Selezionando testo con il mouse, le righe coinvolte vengono evidenziate in azzurro pastello
- AC-04: Dopo la selezione testo, appare un bottone floating con icona `add_comment`
- AC-05: Cliccando il bottone floating, il form inline si apre sotto l'ultima riga selezionata
- AC-06: Il form ha solo textarea + Cancel + Submit (icona send), categoria default `suggestion`
- AC-07: Escape chiude il form, Ctrl+Enter invia
- AC-08: Submit crea il commento e chiude il form

## Task

### T1: Riscrivere CommentForm come componente inline minimale
Rimuovere backdrop/modale. Nuovo DOM: `.comment-form-inline` con textarea auto-resize + bottoni.

### T2: Rendere il form inline dentro PlanViewer
Spostare il rendering da App.tsx (modale) a dentro PlanViewer, sotto la riga target.

### T3: Selezione testo con bottone floating
Handler `onMouseUp` su `.plan-viewer` per catturare selezione testo. Bottone floating con icona Material.

### T4: Highlight selezione azzurro pastello
Classe `.line-row--selecting` con `background: rgba(130, 200, 255, 0.18)`.

### T5: Stili CSS per form inline e selezione
Nuovi stili `.comment-form-inline`, `.selection-comment-btn`, `.line-row--selecting`.

### T6: Aggiornare demo HTML e test E2E
Form inline nel demo. Test per click "+", selezione testo, bottone floating, submit.
