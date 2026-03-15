import * as vscode from 'vscode';
import * as fs from 'fs';
import { v7 as uuidv7 } from 'uuid';
import { Database } from '../../core/db/database';
import { PlanRepository } from '../../core/db/repositories/PlanRepository';
import { SectionRepository } from '../../core/db/repositories/SectionRepository';
import { CommentRepository } from '../../core/db/repositories/CommentRepository';
import type { Plan, Version, Section, Comment } from '../../../shared/models';

// ---------------------------------------------------------------------------
// Import format (mirrors exportPlan.ts)
// ---------------------------------------------------------------------------

interface VersionExport extends Version {
  sections: Section[];
  comments: Comment[];
}

interface PlanExport {
  exportVersion: 1;
  exportDate: string;
  plan: Plan;
  versions: VersionExport[];
}

function isValidExport(data: unknown): data is PlanExport {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d['exportVersion'] !== 1) return false;
  if (typeof d['plan'] !== 'object' || d['plan'] === null) return false;
  if (!Array.isArray(d['versions'])) return false;

  const plan = d['plan'] as Record<string, unknown>;
  if (typeof plan['id'] !== 'string' || plan['id'] === '') return false;
  if (typeof plan['title'] !== 'string' || plan['title'] === '') return false;
  if (typeof plan['status'] !== 'string') return false;

  for (const v of d['versions'] as unknown[]) {
    if (typeof v !== 'object' || v === null) return false;
    const ver = v as Record<string, unknown>;
    if (typeof ver['id'] !== 'string' || ver['id'] === '') return false;
    if (typeof ver['versionNumber'] !== 'number') return false;
    if (!Array.isArray(ver['sections'])) return false;
    if (!Array.isArray(ver['comments'])) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export function registerImportPlanCommand(
  _context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('planReviewer.importPlan', async () => {
    // Step 1 — open file dialog
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { JSON: ['json'] },
      openLabel: 'Importa piano',
    });
    if (uris === undefined || uris.length === 0) return;

    // Step 2 — read and validate JSON
    let raw: string;
    try {
      raw = fs.readFileSync(uris[0].fsPath, 'utf-8');
    } catch (err) {
      await vscode.window.showErrorMessage(`Errore lettura file: ${String(err)}`);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      await vscode.window.showErrorMessage('Il file non è un JSON valido.');
      return;
    }

    if (!isValidExport(parsed)) {
      await vscode.window.showErrorMessage(
        'Il file non è un export Plan Reviewer valido (exportVersion mancante o errato).',
      );
      return;
    }

    // Step 3 — remap all UUIDs to avoid conflicts
    const oldPlanId = parsed.plan.id;
    const newPlanId = uuidv7();

    // Map old IDs → new IDs for versions, sections, comments
    const versionIdMap = new Map<string, string>();
    const sectionIdMap = new Map<string, string>();
    const commentIdMap = new Map<string, string>();

    for (const v of parsed.versions) {
      versionIdMap.set(v.id, uuidv7());
      for (const s of v.sections) {
        sectionIdMap.set(s.id, uuidv7());
      }
      for (const c of v.comments) {
        commentIdMap.set(c.id, uuidv7());
      }
    }

    // Step 4 — insert into DB in dependency order
    const db = Database.getInstance().getDb();
    const planRepo = new PlanRepository(db);
    const sectionRepo = new SectionRepository(db);
    const commentRepo = new CommentRepository(db);
    const now = new Date().toISOString();

    const newPlan: Plan = {
      ...parsed.plan,
      id: newPlanId,
      createdAt: now,
      updatedAt: now,
    };
    planRepo.insert(newPlan);

    for (const v of parsed.versions) {
      const newVersionId = versionIdMap.get(v.id)!;

      const newVersion: Version = {
        ...v,
        id: newVersionId,
        planId: newPlanId,
      };
      planRepo.insertVersion(newVersion);

      const newSections: Section[] = v.sections.map((s) => ({
        ...s,
        id: sectionIdMap.get(s.id)!,
        versionId: newVersionId,
      }));
      if (newSections.length > 0) {
        sectionRepo.insertMany(newSections);
      }

      const newComments: Comment[] = v.comments.map((c) => {
        let sectionId: string | null = null;
        if (c.sectionId !== null) {
          const mapped = sectionIdMap.get(c.sectionId);
          if (mapped !== undefined) {
            sectionId = mapped;
          } else {
            console.warn(`[importPlan] Lost sectionId ${c.sectionId} for comment ${c.id} — FK not found in export`);
          }
        }

        let carriedFromId: string | null = null;
        if (c.carriedFromId !== null) {
          const mapped = commentIdMap.get(c.carriedFromId);
          if (mapped !== undefined) {
            carriedFromId = mapped;
          } else {
            console.warn(`[importPlan] Lost carriedFromId ${c.carriedFromId} for comment ${c.id} — FK not found in export`);
          }
        }

        return {
          ...c,
          id: commentIdMap.get(c.id)!,
          versionId: newVersionId,
          sectionId,
          carriedFromId,
        };
      });
      for (const comment of newComments) {
        commentRepo.insert(comment);
      }
    }

    await vscode.window.showInformationMessage(
      `Piano "${newPlan.title}" importato con successo.`,
    );

    // Refresh explorer if available
    const { PlanExplorerProvider } = await import('../explorer/PlanExplorerProvider');
    PlanExplorerProvider.instance?.refresh();

    void oldPlanId; // suppress unused variable warning
  });
}
