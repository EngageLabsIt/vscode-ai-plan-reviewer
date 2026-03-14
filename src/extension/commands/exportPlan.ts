import * as vscode from 'vscode';
import * as fs from 'fs';
import { Database } from '../db/database';
import { PlanRepository } from '../db/repositories/PlanRepository';
import { SectionRepository } from '../db/repositories/SectionRepository';
import { CommentRepository } from '../db/repositories/CommentRepository';
import type { Plan, Version, Section, Comment } from '../../shared/models';

// ---------------------------------------------------------------------------
// Export format
// ---------------------------------------------------------------------------

interface PlanExport {
  exportVersion: 1;
  exportDate: string;
  plan: Plan;
  versions: Array<Version & { sections: Section[]; comments: Comment[] }>;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export function registerExportPlanCommand(
  _context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('planReviewer.exportPlan', async () => {
    const db = Database.getInstance().getDb();
    const planRepo = new PlanRepository(db);
    const sectionRepo = new SectionRepository(db);
    const commentRepo = new CommentRepository(db);

    // Step 1 — choose plan
    const allPlans = planRepo.findAll();
    if (allPlans.length === 0) {
      await vscode.window.showInformationMessage('Nessun piano da esportare.');
      return;
    }

    const planItems = allPlans.map((p) => ({
      label: p.title,
      description: p.status,
      plan: p,
    }));

    const selectedPlan = await vscode.window.showQuickPick(planItems, {
      placeHolder: 'Seleziona il piano da esportare',
    });
    if (selectedPlan === undefined) return;

    // Step 2 — choose format
    const formatItems = [
      { label: 'JSON (completo — piano + versioni + sezioni + commenti)', format: 'json' as const },
      { label: 'Markdown (ultima versione con commenti in fondo)', format: 'md' as const },
    ];

    const selectedFormat = await vscode.window.showQuickPick(formatItems, {
      placeHolder: 'Scegli il formato di esportazione',
    });
    if (selectedFormat === undefined) return;

    // Step 3 — save dialog
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        `${selectedPlan.plan.title.replace(/[^\w\s-]/g, '').trim()}.${selectedFormat.format}`,
      ),
      filters:
        selectedFormat.format === 'json'
          ? { JSON: ['json'] }
          : { Markdown: ['md'] },
    });
    if (uri === undefined) return;

    // Step 4 — build content and save
    const { plan } = selectedPlan;
    const versions = planRepo.findVersionsByPlanId(plan.id);

    if (selectedFormat.format === 'json') {
      const payload: PlanExport = {
        exportVersion: 1,
        exportDate: new Date().toISOString(),
        plan,
        versions: versions.map((v) => ({
          ...v,
          sections: sectionRepo.findByVersionId(v.id),
          comments: commentRepo.findByVersionId(v.id),
        })),
      };
      fs.writeFileSync(uri.fsPath, JSON.stringify(payload, null, 2), 'utf-8');
    } else {
      // Markdown export — latest version + comments appended
      const latest = planRepo.findLatestVersion(plan.id);
      if (latest === null) {
        await vscode.window.showErrorMessage('Nessuna versione trovata.');
        return;
      }
      const comments = commentRepo.findByVersionId(latest.id);
      const annotationBlock =
        comments.length === 0
          ? ''
          : [
              '\n\n---\n\n## Commenti di Review\n',
              ...comments.map((c) => {
                const lineRef =
                  c.type === 'range' && c.targetStart !== c.targetEnd
                    ? `righe ${c.targetStart}–${c.targetEnd}`
                    : `riga ${c.targetStart}`;
                return `- ${lineRef}: ${c.body}${c.resolved ? ' ✅' : ''}`;
              }),
            ].join('\n');

      fs.writeFileSync(uri.fsPath, latest.content + annotationBlock, 'utf-8');
    }

    await vscode.window.showInformationMessage(
      `Piano esportato in: ${uri.fsPath}`,
    );
  });
}
