# PBI — Migrazione Colori App Shell a Variabili VS Code

## Descrizione

Come reviewer, voglio che tutta l'interfaccia del Plan Reviewer (toolbar, gutter, comment cards, navigator, search bar, prompt preview, diff viewer) si adatti automaticamente al tema VS Code attivo, senza colori hardcoded.

## Criteri di Accettazione

- AC-01: I token `--md-*` in `:root` puntano a variabili `--vscode-*` con fallback
- AC-02: I colori categoria (issue/suggestion/question/approval) usano `--vscode-editorError/Warning/Info-foreground`
- AC-03: Superfici, bordi, testi usano `--vscode-editor-background`, `--vscode-panel-border`, `--vscode-foreground`
- AC-04: Bottoni usano `--vscode-button-background/foreground`
- AC-05: Input/textarea usano `--vscode-input-background/foreground/border`
- AC-06: Search highlight usa `--vscode-editor-findMatch*`
- AC-07: Diff viewer usa `--vscode-diffEditor-*`
- AC-08: Funziona con tema dark, light e high contrast

## Task

### T1: Ridefinire design token `:root` con mapping `--vscode-*`
Superfici, testi, primary, category, elevation, font.

### T2: Sostituire colori hardcoded rgba/hex nelle regole CSS
Line hover, active anchor, range selected, selecting, search, diff, button text `#fff`, approve `#238636`.

### T3: Aggiornare body/html globali
Font e sfondo dal tema VS Code.

### T4: Verificare con temi dark, light, high contrast
