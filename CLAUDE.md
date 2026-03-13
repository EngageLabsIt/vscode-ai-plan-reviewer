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
src/extension/          VS Code host (Node.js)
  extension.ts          Activation, command registration
  commands/             Command handlers (newReview, loadTestPlan, exportPlan, importPlan)
  db/                   SQLite via sql.js (database.ts, migrations.ts, repositories/)
  services/             MarkdownParser, DiffEngine, CommentMapper
  views/                PlanExplorerProvider (sidebar tree view)
  webview/              PlanReviewPanel (host-side webview bridge)

src/webview/            React UI (runs in webview iframe)
  App.tsx               Root component, state management, message handling
  components/           ReviewToolbar, PlanViewer, CommentCard, CommentForm, etc.
  styles/planViewer.css All styling (BEM naming)

src/shared/             Code shared between host and webview
  models.ts             Core types: Plan, Version, Section, Comment, DiffLine, MappedComment
  messages.ts           HostMessage / WebViewMessage discriminated unions
  PromptGenerator.ts    Converts comments to structured AI prompts
```

**Build:** esbuild (esbuild.mjs) compiles two entry points in parallel — extension and webview. It also copies `sql-wasm.wasm` to dist/.

### Key Data Flow

1. User copies markdown to clipboard, runs "New Review" command
2. `newReview.ts` parses sections (MarkdownParser), creates Plan+Version in SQLite, opens webview
3. Webview receives `planLoaded` message with plan data, renders with react-markdown
4. User adds comments targeting lines/ranges/sections
5. On new version: `CommentMapper` uses `DiffEngine` to remap unresolved comments

### Database

SQLite via sql.js, stored in VS Code global storage (`~/.vscode/plan-reviewer.db`). Schema managed through numbered migrations in `migrations.ts`. Repositories handle data access with snake_case DB columns mapped to camelCase TypeScript.

### Singletons

`Database.getInstance()`, `PlanExplorerProvider._instance`, `PlanReviewPanel.instance` — be aware when modifying initialization order.

## Conventions

- **Line numbers are 1-based** everywhere (DB, models, UI)
- **UUIDs (v7)** for all entity IDs
- **ISO strings** for all timestamps
- **Discriminated unions** for message types — always handle exhaustively
- Webview tsconfig is separate: `tsconfig.webview.json` (ESNext modules, JSX)
