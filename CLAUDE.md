# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plan Reviewer is a VS Code extension for reviewing AI-generated plans with inline comments, similar to GitHub PR reviews. Plans are stored as markdown, parsed into sections, and support versioning with smart comment migration across versions.

## Commands

```bash
npm run dev          # Watch mode (esbuild, rebuilds on change)
npm run build        # Production build
npm run compile      # Type-check only (tsc --noEmit)
npm run lint         # ESLint
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run package      # Build + create .vsix
```

Run a single test file: `npx vitest run src/test/DiffEngine.test.ts`

Debug the extension: F5 in VS Code (uses `.vscode/launch.json`).

## Architecture

**Two-process model:** The extension runs in the VS Code host process; the UI runs in a sandboxed webview (React). They communicate via typed messages defined in `src/shared/messages.ts`.

```
src/extension/          VS Code host (Node.js) — vertical slice structure
  extension.ts          Activation, command registration
  core/
    db/                 SQLite via sql.js (database.ts, dbUtils.ts, migrations.ts, repositories/)
    services/           MarkdownParser, DiffEngine, CommentMapper
  features/
    review/             newReview.ts, loadTestPlan.ts, PlanReviewPanel.ts, MessageHandler.ts
    explorer/           PlanExplorerProvider (sidebar tree view)
    import-export/      importPlan.ts, exportPlan.ts

src/webview/            React UI (runs in webview iframe) — vertical slice structure
  App.tsx               Root component, state management
  hooks/                useVsCodeApi.ts, usePlanMessages.ts
  components/           PlanReviewView, MarkdownBody, CommentThread, RangeHighlighter
  features/
    comments/           CommentCard, CommentForm, CommentNavigator, CommentContext
    prompt/             PromptPreview
    search/             SearchBar, useSearch.ts
    toolbar/            ReviewToolbar
  styles/               planViewer.css, annotations.css — all styling (BEM naming)

src/shared/             Code shared between host and webview
  models.ts             Core types: Plan, Version, Section, Comment, DiffLine, MappedComment
  messages.ts           HostMessage / WebViewMessage discriminated unions
  PromptGenerator.ts    Converts comments to structured AI prompts
```

**Build:** esbuild (esbuild.mjs) compiles two entry points in parallel — extension and webview. It also copies `sql-wasm.wasm` to dist/.

### Key Data Flow

1. User copies markdown to clipboard, runs "New Review" command
2. `features/review/newReview.ts` parses sections (MarkdownParser), creates Plan+Version in SQLite, opens webview
3. `features/review/PlanReviewPanel.ts` manages the webview lifecycle; `MessageHandler.ts` handles all incoming messages
4. Webview receives `planLoaded` message, `usePlanMessages` hook dispatches state updates, React renders HTML pre-built by `PlanMarkdownEngine` (markdown-it)
5. User adds comments targeting lines/ranges/sections; `CommentContext` provides callbacks to all comment components
6. On new version: `CommentMapper` uses `DiffEngine` to remap unresolved comments

### Database

SQLite via sql.js, stored in VS Code global storage (`~/.vscode/plan-reviewer.db`). Schema managed through numbered migrations in `migrations.ts`. Repositories handle data access with snake_case DB columns mapped to camelCase TypeScript.

### Singletons

`Database.getInstance()`, `PlanExplorerProvider._instance`, `PlanReviewPanel.instance` — be aware when modifying initialization order.

### React Patterns (webview)

- **`CommentContext`** (`features/comments/CommentContext.tsx`) — provides `comments`, edit/delete/resolve callbacks, and form state to all comment components. Use `useComments()` hook; do not prop-drill these values.
- **`usePlanMessages`** (`hooks/usePlanMessages.ts`) — handles `window.addEventListener('message', ...)` for all `HostMessage` types; returns `loadedPlan` state.
- **`useSearch`** (`features/search/useSearch.ts`) — encapsulates search state and match computation; takes `content: string | undefined`.
- **`React.memo`** on `CommentCard` and `LineGutter` — list-rendered components. Keep their callback props stable with `useCallback`.

## Conventions

- **Line numbers are 1-based** everywhere (DB, models, UI)
- **UUIDs (v7)** for all entity IDs
- **ISO strings** for all timestamps
- **Discriminated unions** for message types — always handle exhaustively
- Webview tsconfig is separate: `tsconfig.webview.json` (ESNext modules, JSX)
