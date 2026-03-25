import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Database } from './core/db/database';
import { runMigrations } from './core/db/migrations';
import { PlanReviewPanel } from './features/review/PlanReviewPanel';
import { PlanExplorerProvider } from './features/explorer/PlanExplorerProvider';
import { registerNewReviewCommand } from './features/review/newReview';
import { registerExportPlanCommand } from './features/import-export/exportPlan';
import { registerImportPlanCommand } from './features/import-export/importPlan';

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  console.log('Plan Reviewer is now active!');

  // Ensure the global storage directory exists
  const storageDir = context.globalStorageUri.fsPath;
  fs.mkdirSync(storageDir, { recursive: true });

  // Init DB and run migrations before any command can use it
  const dbPath = path.join(storageDir, 'plan-reviewer.db');
  try {
    await Database.getInstance().init(dbPath);
    runMigrations(Database.getInstance().getDb());
  } catch (err) {
    await vscode.window.showErrorMessage(
      `Plan Reviewer: database initialization failed — ${String(err)}`,
    );
    return;
  }

  // ── Plan Explorer (sidebar TreeView) ──────────────────────────────────────

  const planExplorer = new PlanExplorerProvider();
  const treeView = vscode.window.createTreeView('planReviewer.explorer', {
    treeDataProvider: planExplorer,
    showCollapseAll: true,
  });

  // ── Commands ──────────────────────────────────────────────────────────────

  const openPanelCommand = vscode.commands.registerCommand(
    'planReviewer.openPanel',
    () => {
      PlanReviewPanel.createOrShow(context.extensionUri);
    },
  );

  // Explorer context-menu commands
  const explorerOpenCommand = vscode.commands.registerCommand(
    'planReviewer.explorer.openPlan',
    (item) => planExplorer.handleOpen(item, context),
  );
  const explorerArchiveCommand = vscode.commands.registerCommand(
    'planReviewer.explorer.archivePlan',
    (item) => planExplorer.handleArchive(item),
  );
  const explorerDeleteCommand = vscode.commands.registerCommand(
    'planReviewer.explorer.deletePlan',
    (item) => planExplorer.handleDelete(item),
  );
  const explorerRenameCommand = vscode.commands.registerCommand(
    'planReviewer.explorer.renamePlan',
    (item) => planExplorer.handleRename(item),
  );
  const explorerSearchCommand = vscode.commands.registerCommand(
    'planReviewer.explorer.search',
    () => planExplorer.handleSearch(),
  );
  const explorerRefreshCommand = vscode.commands.registerCommand(
    'planReviewer.explorer.refresh',
    () => planExplorer.refresh(),
  );

  context.subscriptions.push(
    treeView,
    openPanelCommand,
    explorerOpenCommand,
    explorerArchiveCommand,
    explorerDeleteCommand,
    explorerRenameCommand,
    explorerSearchCommand,
    explorerRefreshCommand,
    registerNewReviewCommand(context),
    registerExportPlanCommand(context),
    registerImportPlanCommand(context),
    {
      dispose: () => {
        void Database.getInstance().close();
      },
    },
  );
}

export function deactivate(): void {
  // cleanup if needed
}
