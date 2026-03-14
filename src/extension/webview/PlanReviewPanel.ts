import * as vscode from 'vscode';
import { v7 as uuidv7 } from 'uuid';
import type { HostMessage, WebViewMessage } from '../../shared/messages';
import { Database } from '../db/database';
import { PlanRepository } from '../db/repositories/PlanRepository';
import { SectionRepository } from '../db/repositories/SectionRepository';
import { CommentRepository } from '../db/repositories/CommentRepository';
import { DiffEngine } from '../services/DiffEngine';
import { CommentMapper } from '../services/CommentMapper';
import type { Comment, Plan } from '../../shared/models';
import { PlanExplorerProvider } from '../views/PlanExplorerProvider';

export class PlanReviewPanel {
  public static readonly viewType = 'planReviewer.reviewPanel';

  private static instance: PlanReviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private pendingMessage: HostMessage | null = null;
  private isReady = false;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtmlContent(this.panel.webview);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebViewMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri): PlanReviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (PlanReviewPanel.instance) {
      PlanReviewPanel.instance.panel.reveal(column);
      return PlanReviewPanel.instance;
    }

    const mdExt = vscode.extensions.getExtension('vscode.markdown-language-features');
    const mdMediaUri = mdExt ? vscode.Uri.joinPath(mdExt.extensionUri, 'media') : undefined;

    const panel = vscode.window.createWebviewPanel(
      PlanReviewPanel.viewType,
      'Plan Reviewer',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          ...(mdMediaUri ? [mdMediaUri] : []),
        ],
      }
    );

    PlanReviewPanel.instance = new PlanReviewPanel(panel, extensionUri);
    return PlanReviewPanel.instance;
  }

  public postMessage(message: HostMessage): void {
    if (this.isReady) {
      void this.panel.webview.postMessage(message);
    } else {
      this.pendingMessage = message;
    }
  }

  private handleMessage(message: WebViewMessage): void {
    switch (message.type) {
      case 'ready':
        this.handleReady();
        break;
      case 'requestPlan':
        this.handleRequestPlan(message.payload);
        break;
      case 'updatePlanStatus':
        this.handleUpdatePlanStatus(message.payload);
        break;
      case 'addComment':
        this.handleAddComment(message.payload);
        break;
      case 'updateComment':
        this.handleUpdateComment(message.payload);
        break;
      case 'deleteComment':
        this.handleDeleteComment(message.payload);
        break;
      case 'resolveComment':
        this.handleResolveComment(message.payload);
        break;
      case 'requestDiff':
        this.handleRequestDiff(message.payload);
        break;
      case 'saveReviewPrompt':
        this.handleSaveReviewPrompt(message.payload);
        break;
      default:
        break;
    }
  }

  private handleReady(): void {
    this.isReady = true;
    if (this.pendingMessage !== null) {
      void this.panel.webview.postMessage(this.pendingMessage);
      this.pendingMessage = null;
    }
  }

  private handleRequestPlan(payload: { planId: string; versionNumber?: number }): void {
    const rawDb = Database.getInstance().getDb();
    const planRepo = new PlanRepository(rawDb);
    const sectionRepo = new SectionRepository(rawDb);
    const commentRepo = new CommentRepository(rawDb);

    const plan = planRepo.findById(payload.planId);
    if (plan === null) {
      this.postMessage({ type: 'error', payload: { message: `Plan not found: ${payload.planId}` } });
      return;
    }

    const allVersions = planRepo.findVersionsByPlanId(payload.planId);
    const version =
      payload.versionNumber !== undefined
        ? allVersions.find((v) => v.versionNumber === payload.versionNumber) ?? null
        : planRepo.findLatestVersion(payload.planId);

    if (version === null) {
      this.postMessage({ type: 'error', payload: { message: `Version not found for plan: ${payload.planId}` } });
      return;
    }

    const sections = sectionRepo.findByVersionId(version.id);
    const comments = commentRepo.findByVersionId(version.id);

    this.postMessage({
      type: 'planLoaded',
      payload: { plan, version, versions: allVersions, sections, comments },
    });
  }

  private handleUpdatePlanStatus(payload: { planId: string; status: Plan['status']; note?: string }): void {
    const rawDb = Database.getInstance().getDb();
    const planRepo = new PlanRepository(rawDb);

    planRepo.update(payload.planId, {
      status: payload.status,
      updatedAt: new Date().toISOString(),
    });

    PlanExplorerProvider.instance?.refresh();

    this.postMessage({
      type: 'planStatusUpdated',
      payload: { planId: payload.planId, status: payload.status },
    });
  }

  private handleAddComment(payload: Omit<Comment, 'id' | 'createdAt'>): void {
    const rawDb = Database.getInstance().getDb();
    const commentRepo = new CommentRepository(rawDb);

    const comment: Comment = {
      ...payload,
      id: uuidv7(),
      createdAt: new Date().toISOString(),
    };
    console.log('Adding comment:', comment);
    commentRepo.insert(comment);
    this.postMessage({ type: 'commentAdded', payload: comment });
  }

  private handleUpdateComment(payload: { id: string; body?: string }): void {
    const rawDb = Database.getInstance().getDb();
    const commentRepo = new CommentRepository(rawDb);

    commentRepo.update(payload.id, {
      ...(payload.body !== undefined ? { body: payload.body } : {}),
    });

    const updated = commentRepo.findById(payload.id);
    if (updated !== null) {
      this.postMessage({ type: 'commentUpdated', payload: updated });
    }
  }

  private handleDeleteComment(payload: { id: string }): void {
    const rawDb = Database.getInstance().getDb();
    const commentRepo = new CommentRepository(rawDb);

    commentRepo.delete(payload.id);
    this.postMessage({ type: 'commentDeleted', payload: { commentId: payload.id } });
  }

  private handleResolveComment(payload: { id: string }): void {
    const rawDb = Database.getInstance().getDb();
    const commentRepo = new CommentRepository(rawDb);

    commentRepo.update(payload.id, { resolved: true });

    const updated = commentRepo.findById(payload.id);
    if (updated !== null) {
      this.postMessage({ type: 'commentUpdated', payload: updated });
    }
  }

  private handleRequestDiff(payload: { planId: string; versionNumberOld: number; versionNumberNew: number }): void {
    const rawDb = Database.getInstance().getDb();
    const planRepo = new PlanRepository(rawDb);
    const commentRepo = new CommentRepository(rawDb);

    const allVersions = planRepo.findVersionsByPlanId(payload.planId);

    const versionOld = allVersions.find((v) => v.versionNumber === payload.versionNumberOld) ?? null;
    if (versionOld === null) {
      this.postMessage({
        type: 'error',
        payload: { message: `Version ${payload.versionNumberOld} not found for plan: ${payload.planId}` },
      });
      return;
    }

    const versionNew = allVersions.find((v) => v.versionNumber === payload.versionNumberNew) ?? null;
    if (versionNew === null) {
      this.postMessage({
        type: 'error',
        payload: { message: `Version ${payload.versionNumberNew} not found for plan: ${payload.planId}` },
      });
      return;
    }

    const diffLines = new DiffEngine().compute(versionOld.content, versionNew.content);
    const oldComments = commentRepo.findByVersionId(versionOld.id);
    const mappedComments = new CommentMapper().map(oldComments, diffLines);

    this.postMessage({
      type: 'diffLoaded',
      payload: {
        diffLines,
        oldVersionNumber: payload.versionNumberOld,
        newVersionNumber: payload.versionNumberNew,
        mappedComments,
      },
    });
  }

  private handleSaveReviewPrompt(payload: { versionId: string; prompt: string }): void {
    const repo = new PlanRepository(Database.getInstance().getDb());
    repo.updateVersionReviewPrompt(payload.versionId, payload.prompt);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css')
    );

    const nonce = getNonce();

    const mdExt = vscode.extensions.getExtension('vscode.markdown-language-features');
    const mdCssLinks = mdExt
      ? [
          webview.asWebviewUri(vscode.Uri.joinPath(mdExt.extensionUri, 'media', 'markdown.css')),
          webview.asWebviewUri(vscode.Uri.joinPath(mdExt.extensionUri, 'media', 'highlight.css')),
        ]
          .map(uri => `  <link rel="stylesheet" href="${uri}">`)
          .join('\n')
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plan Reviewer</title>
  <link rel="stylesheet" href="${styleUri}">
${mdCssLinks}
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    PlanReviewPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
