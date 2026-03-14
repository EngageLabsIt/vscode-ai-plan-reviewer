# PBI — Preview Markdown con Stile VS Code Nativo

## Descrizione

Come reviewer, voglio che la preview del markdown nel Plan Reviewer abbia lo stesso aspetto della preview markdown nativa di VS Code, in modo che si adatti automaticamente al tema attivo (dark, light, high contrast).

## Criteri di Accettazione

- AC-01: Headings (h1-h6) usano il font e il colore del tema VS Code attivo
- AC-02: Code inline e code block usano lo sfondo di VS Code per i blocchi di codice
- AC-03: Link usano il colore link del tema VS Code
- AC-04: Blockquote, tabelle, hr seguono i colori bordo del tema
- AC-05: La preview si adatta automaticamente cambiando tema (dark → light → high contrast)
- AC-06: L'app shell (toolbar, navigator, comment cards, search) resta con stile MD3

## Task

### T1: Sostituire colori hardcoded con variabili `--vscode-*`
Aggiornare tutte le regole CSS `.plan-viewer [elemento]` per usare variabili CSS di VS Code.

### T2: Mantenere stili app shell invariati
I token `--md-*` restano per toolbar, navigator, comment cards, search bar.
