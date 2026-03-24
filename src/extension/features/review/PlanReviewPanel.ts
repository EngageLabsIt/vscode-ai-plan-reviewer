import * as vscode from 'vscode';
import type { HostMessage, WebViewMessage } from '../../../shared/messages';
import { MessageHandler } from './MessageHandler';

export class PlanReviewPanel {
  public static readonly viewType = 'planReviewer.reviewPanel';

  private static instance: PlanReviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly messageHandler: MessageHandler;
  private disposables: vscode.Disposable[] = [];
  private pendingMessage: HostMessage | null = null;
  private isReady = false;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.messageHandler = new MessageHandler((msg) => this.postMessage(msg));

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
    if (message.type === 'ready') {
      this.isReady = true;
      if (this.pendingMessage !== null) {
        void this.panel.webview.postMessage(this.pendingMessage);
        this.pendingMessage = null;
      }
      return;
    }
    this.messageHandler.handle(message);
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
