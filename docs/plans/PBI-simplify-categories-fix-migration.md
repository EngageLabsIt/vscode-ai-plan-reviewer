# PBI — Semplificazione Categorie Commenti + Bugfix Migrazione DB

## Descrizione

Come reviewer, voglio che i commenti non abbiano più categorie multiple (issue, suggestion, question, approval) ma siano tutti di tipo "suggestion", in modo da semplificare l'interfaccia e il flusso di lavoro. Inoltre, va corretto un bug nella migrazione V3 del database che impedisce l'inserimento di commenti su database esistenti.

## Criteri di Accettazione

### Semplificazione categorie
- AC-01: Il tipo `Comment.category` accetta solo `'suggestion'`
- AC-02: I comment card non mostrano badge/icona categoria né dropdown per cambiarla
- AC-03: La toolbar non mostra chip conteggio per categoria, solo il totale commenti
- AC-04: Il navigator mostra una lista flat di commenti senza filtri per categoria né raggruppamento
- AC-05: Il PromptGenerator genera una singola sezione "Suggestions" invece di 4 sezioni per categoria
- AC-06: L'export markdown non include `[category]` nel formato
- AC-07: Il CSS non contiene classi/token specifici per issue, question, approval
- AC-08: La demo HTML riflette le stesse semplificazioni

### Bugfix migrazione DB
- AC-09: Database esistenti a version ≥ 3 ma con colonne `target_start_char`/`target_end_char` mancanti vengono riparati automaticamente
- AC-10: La migrazione V3 usa `PRAGMA table_info` invece di `try/catch` per verificare l'esistenza delle colonne
- AC-11: Una migrazione V4 normalizza tutti i commenti esistenti a `category = 'suggestion'`

## Task

### T1: Semplificare il tipo `Comment`
**File:** `src/shared/models.ts`
- `category: 'suggestion' | 'issue' | 'question' | 'approval'` → `category: 'suggestion'`

### T2: Ridurre costante `COMMENT_CATEGORIES`
**File:** `src/shared/constants.ts`
- `['suggestion'] as const`

### T3: Semplificare CommentCard
**File:** `src/webview/components/CommentCard.tsx`
- Rimossi `CATEGORY_META`, `CATEGORY_OPTIONS`, dropdown edit categoria, stato `editCategory`
- Rimossa classe CSS `comment-card--${category}`
- `onEdit` semplificato a `(id: string, body: string)` senza parametro category

### T4: Rimuovere chip conteggio dalla ReviewToolbar
**File:** `src/webview/components/ReviewToolbar.tsx`
- Rimossi `CommentCounts`, `countComments`, `CHIP_CONFIG`
- Il conteggio totale usa direttamente `comments.length`

### T5: Semplificare CommentNavigator
**File:** `src/webview/components/CommentNavigator.tsx`
- Rimossi `CATEGORY_ORDER`, `CategoryGroup`, `CommentItem`, filtri per categoria, `handleToggleCategory`, `groupedComments`
- Lista flat di `CommentCard` senza raggruppamento per tipo
- Filtro solo per "Unresolved only"

### T6: Rimuovere CATEGORY_ICONS da PlanViewer
**File:** `src/webview/components/PlanViewer.tsx`
- Rimosso `CATEGORY_ICONS` e il suo uso in `SectionCommentBadge`
- `onEdit` prop semplificato a `(id: string, body: string)`

### T7: Semplificare PromptGenerator
**File:** `src/shared/PromptGenerator.ts`
- Rimosso raggruppamento per 4 categorie
- Singola sezione `### Suggestions` con lista flat di commenti
- Closing instructions ridotte a un solo punto

### T8: Semplificare CSS
**File:** `src/webview/styles/planViewer.css`
- Rimossi token: `--md-issue-*`, `--md-quest-*`, `--md-appr-*`
- Rimossi classi: `.comment-card--issue/question/approval`, `.comment-card-category`
- Rimossi chip: `.review-toolbar__count-chip--*`
- Rimossi filtri: `.comment-navigator__filter-btn--active[data-category=*]`
- Rimossi dot gutter: `.line-gutter__dot--issue/question/approval`
- Riferimenti residui (`delete-btn`, `resolve-btn`, `badge--needs-revision`, `diff-line__sign`, ecc.) sostituiti con variabili `--vscode-*` dirette

### T9: Aggiornare handlers in App.tsx
**File:** `src/webview/App.tsx`
- `handleEditComment` semplificato a `(id: string, body: string)`
- Rimosso parametro `category` dal messaggio `updateComment`

### T10: Aggiornare messaggi
**File:** `src/shared/messages.ts`
- Rimosso `category?: Comment['category']` dal payload `updateComment`

### T11: Aggiornare extension host
**File:** `src/extension/webview/PlanReviewPanel.ts`, `src/extension/commands/exportPlan.ts`
- `handleUpdateComment` non accetta più `category`
- `exportPlan` usa formato senza `[category]`

### T12: Fix migrazione DB + repair path
**File:** `src/extension/db/migrations.ts`
- Aggiunta helper `getColumnNames(db, table)` che usa `PRAGMA table_info`
- V3 riscritta: usa `getColumnNames` per verificare esistenza colonne prima di `ALTER TABLE` (niente più `try/catch`)
- V4 aggiunta: normalizza tutti i commenti a `category = 'suggestion'`
- Repair path alla fine di `runMigrations`: verifica e aggiunge colonne `target_start_char`/`target_end_char` se mancanti, indipendentemente dalla schema version

### T13: Aggiornare test
**File:** `src/test/PromptGenerator.test.ts`, `src/test/demo-scenarios.test.ts`, `src/test/CommentMapper.test.ts`, `src/test/migrations.test.ts`
- Tutte le factory/fixture usano `category: 'suggestion'`
- Rimossi test per raggruppamento per categoria (issues/questions/approvals)
- Aggiunto test per repair path DB (DB a version 3 senza colonne char)
- Aggiunto campo `targetStartChar`/`targetEndChar` alle factory

### T14: Aggiornare demo HTML
**File:** `docs/plan-reviewer-demo.html`
- Tutti i commenti demo con `category: 'suggestion'`
- Rimosso oggetto `CAT` multi-categoria
- Rimossi filtri navigatore per categoria
- Rimossi conteggi per categoria
- Prompt generator semplificato

### T15: Aggiornare test E2E
**File:** `src/test/e2e/demo.spec.ts`
- Rimossi test per filter chips (non esistono più)
- Aggiunto test che verifica assenza filter chips nel navigator

## File modificati

| File | Azione |
|------|--------|
| `src/shared/models.ts` | Tipo category → solo 'suggestion' |
| `src/shared/constants.ts` | COMMENT_CATEGORIES ridotto |
| `src/shared/messages.ts` | Rimosso category da updateComment |
| `src/shared/PromptGenerator.ts` | Lista flat, sezione unica |
| `src/webview/components/CommentCard.tsx` | Rimossi badge/dropdown/stato categoria |
| `src/webview/components/ReviewToolbar.tsx` | Rimossi chip conteggio |
| `src/webview/components/CommentNavigator.tsx` | Rimossi filtri/raggruppamento |
| `src/webview/components/PlanViewer.tsx` | Rimosso CATEGORY_ICONS |
| `src/webview/App.tsx` | handleEditComment semplificato |
| `src/webview/styles/planViewer.css` | Rimossi token/classi categoria |
| `src/extension/webview/PlanReviewPanel.ts` | handleUpdateComment senza category |
| `src/extension/commands/exportPlan.ts` | Export senza [category] |
| `src/extension/db/migrations.ts` | Fix V3 + V4 + repair path |
| `src/extension/db/repositories/CommentRepository.ts` | Nessuna modifica (già corretto) |
| `src/test/PromptGenerator.test.ts` | Factory e test aggiornati |
| `src/test/demo-scenarios.test.ts` | Commenti e test aggiornati |
| `src/test/CommentMapper.test.ts` | Factory aggiornata |
| `src/test/migrations.test.ts` | Test repair path aggiunto |
| `src/test/e2e/demo.spec.ts` | Test filter chips aggiornati |
| `docs/plan-reviewer-demo.html` | Demo semplificata |

## Verifica

1. `npm run compile` — no errori ✅
2. `npm run build` — build OK ✅
3. `npm run test` — 73/73 test passano ✅
4. `npm run test:e2e` — 21/21 test passano ✅
5. F5 → commenti senza badge categoria, nessun dropdown, nessun filtro, nessun chip conteggio
6. DB esistenti riparati automaticamente al primo avvio
