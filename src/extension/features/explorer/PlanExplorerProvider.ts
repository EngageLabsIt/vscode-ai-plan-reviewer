import * as vscode from 'vscode';
import { Database } from '../../core/db/database';
import { PlanRepository } from '../../core/db/repositories/PlanRepository';
import { CommentRepository } from '../../core/db/repositories/CommentRepository';
import { SectionRepository } from '../../core/db/repositories/SectionRepository';
import { PlanReviewPanel } from '../review/PlanReviewPanel';
import { PlanMarkdownEngine } from '../../markdown/PlanMarkdownEngine';
import type { Plan } from '../../../shared/models';

// ---------------------------------------------------------------------------
// Tree item kinds
// ---------------------------------------------------------------------------

type ItemKind = 'group' | 'plan' | 'version';

export class PlanTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly itemKind: ItemKind,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly planId?: string,
    public readonly versionNumber?: number,
  ) {
    super(label, collapsibleState);
    this.contextValue = itemKind;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class PlanExplorerProvider implements vscode.TreeDataProvider<PlanTreeItem> {
  private static _instance: PlanExplorerProvider | undefined;

  static get instance(): PlanExplorerProvider | undefined {
    return PlanExplorerProvider._instance;
  }

  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<PlanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _filterTerm = '';

  constructor() {
    PlanExplorerProvider._instance = this;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setFilter(term: string): void {
    this._filterTerm = term.trim();
    this.refresh();
  }

  // ── Handlers (called from extension.ts registered commands) ───────────────

  handleOpen(item: PlanTreeItem, context: vscode.ExtensionContext): void {
    if (item.planId === undefined) return;
    const db = Database.getInstance().getDb();
    const planRepo = new PlanRepository(db);
    const plan = planRepo.findById(item.planId);
    if (plan === null) {
      void vscode.window.showErrorMessage('Piano non trovato.');
      return;
    }
    // Open the latest version, or the specific version if clicked on a version node
    const versionNumber = item.versionNumber;
    const allVersions = planRepo.findVersionsByPlanId(item.planId);
    const version = versionNumber !== undefined
      ? allVersions.find((v) => v.versionNumber === versionNumber)
      : allVersions[allVersions.length - 1];

    if (version === undefined) {
      void vscode.window.showErrorMessage('Nessuna versione trovata.');
      return;
    }

    const sectionRepo = new SectionRepository(db);
    const commentRepo = new CommentRepository(db);
    const sections = sectionRepo.findByVersionId(version.id);
    const comments = commentRepo.findByVersionId(version.id);

    const panel = PlanReviewPanel.createOrShow(context.extensionUri);
    panel.postMessage({
      type: 'planLoaded',
      payload: { plan, version, versions: allVersions, sections, comments, html: new PlanMarkdownEngine().render(version.content, sections).html },
    });
  }

  handleArchive(item: PlanTreeItem): void {
    if (item.planId === undefined) return;
    const db = Database.getInstance().getDb();
    const planRepo = new PlanRepository(db);
    planRepo.update(item.planId, { status: 'archived', updatedAt: new Date().toISOString() });
    this.refresh();
  }

  handleDelete(item: PlanTreeItem): void {
    if (item.planId === undefined) return;
    void vscode.window
      .showWarningMessage(
        `Eliminare il piano "${item.label as string}" e tutti i suoi dati?`,
        { modal: true },
        'Elimina',
      )
      .then((choice) => {
        if (choice !== 'Elimina') return;
        const db = Database.getInstance().getDb();
        const planRepo = new PlanRepository(db);
        planRepo.delete(item.planId!);
        this.refresh();
      });
  }

  handleRename(item: PlanTreeItem): void {
    if (item.planId === undefined) return;
    void vscode.window
      .showInputBox({
        prompt: 'Nuovo nome del piano',
        value: item.label as string,
      })
      .then((newTitle) => {
        if (!newTitle || newTitle.trim() === '') return;
        const db = Database.getInstance().getDb();
        const planRepo = new PlanRepository(db);
        planRepo.update(item.planId!, {
          title: newTitle.trim(),
          updatedAt: new Date().toISOString(),
        });
        this.refresh();
      });
  }

  handleSearch(): void {
    void vscode.window
      .showInputBox({ prompt: 'Cerca piani per titolo', placeHolder: 'es. autenticazione' })
      .then((term) => {
        this.setFilter(term ?? '');
      });
  }

  // ── TreeDataProvider ───────────────────────────────────────────────────────

  getTreeItem(element: PlanTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PlanTreeItem): PlanTreeItem[] {
    if (element === undefined) {
      return this._buildRootGroups();
    }
    if (element.itemKind === 'group') {
      return this._buildPlanNodes(element.label as string);
    }
    if (element.itemKind === 'plan' && element.planId !== undefined) {
      return this._buildVersionNodes(element.planId);
    }
    return [];
  }

  // ── Private builders ───────────────────────────────────────────────────────

  private _buildRootGroups(): PlanTreeItem[] {
    return [
      this._makeGroupItem('In Review'),
      this._makeGroupItem('Archived'),
    ];
  }

  private _makeGroupItem(label: string): PlanTreeItem {
    return new PlanTreeItem(
      label,
      'group',
      vscode.TreeItemCollapsibleState.Expanded,
    );
  }

  private _groupLabelToStatus(label: string): Plan['status'] {
    return label === 'Archived' ? 'archived' : 'in_review';
  }

  private _buildPlanNodes(groupLabel: string): PlanTreeItem[] {
    const db = Database.getInstance().getDb();
    const planRepo = new PlanRepository(db);
    const commentRepo = new CommentRepository(db);

    const status = this._groupLabelToStatus(groupLabel);
    let plans = planRepo.findAll().filter((p) => p.status === status);

    if (this._filterTerm !== '') {
      const term = this._filterTerm.toLowerCase();
      plans = plans.filter((p) => p.title.toLowerCase().includes(term));
    }

    return plans.map((plan): PlanTreeItem => {
      const openCount = commentRepo.countOpenByPlanId(plan.id);
      const date = new Date(plan.updatedAt).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
      });

      const item = new PlanTreeItem(
        plan.title,
        'plan',
        vscode.TreeItemCollapsibleState.Collapsed,
        plan.id,
      );
      item.description = `${date}${openCount > 0 ? ` · ${openCount} open` : ''}`;
      item.iconPath = new vscode.ThemeIcon('notebook');
      if (openCount > 0) {
        item.tooltip = `${openCount} commenti aperti`;
      }
      return item;
    });
  }

  private _buildVersionNodes(planId: string): PlanTreeItem[] {
    const db = Database.getInstance().getDb();
    const planRepo = new PlanRepository(db);
    const versions = planRepo.findVersionsByPlanId(planId);

    return versions.map((v): PlanTreeItem => {
      const date = new Date(v.createdAt).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
      });
      const item = new PlanTreeItem(
        `v${v.versionNumber}`,
        'version',
        vscode.TreeItemCollapsibleState.None,
        planId,
        v.versionNumber,
      );
      item.description = date;
      item.iconPath = new vscode.ThemeIcon('versions');
      return item;
    });
  }
}
