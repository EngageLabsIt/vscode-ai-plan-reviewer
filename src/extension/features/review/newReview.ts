import * as vscode from 'vscode';
import { v7 as uuidv7 } from 'uuid';
import { MarkdownParser } from '../../core/services/MarkdownParser';
import { Database } from '../../core/db/database';
import { PlanRepository } from '../../core/db/repositories/PlanRepository';
import { SectionRepository } from '../../core/db/repositories/SectionRepository';
import { CommentRepository } from '../../core/db/repositories/CommentRepository';
import { DiffEngine } from '../../core/services/DiffEngine';
import { CommentMapper } from '../../core/services/CommentMapper';
import { PlanMarkdownEngine } from '../../markdown/PlanMarkdownEngine';
import { PlanReviewPanel } from './PlanReviewPanel';
import { PlanExplorerProvider } from '../explorer/PlanExplorerProvider';
import type { Plan, Version, Section, Comment } from '../../../shared/models';

// ---------------------------------------------------------------------------
// QuickPick item carrying extra metadata
// ---------------------------------------------------------------------------

interface ExistingPlanItem extends vscode.QuickPickItem {
  readonly itemKind: 'existing';
  readonly planId: string;
  readonly planTitle: string;
  readonly nextVersion: number;
}

interface NewPlanItem extends vscode.QuickPickItem {
  readonly itemKind: 'new';
}

type ReviewPickItem = ExistingPlanItem | NewPlanItem;

// ---------------------------------------------------------------------------
// Helper: find all in_review plans
// ---------------------------------------------------------------------------

function findInReviewPlans(planRepo: PlanRepository): Plan[] {
  return planRepo.findAll().filter((p) => p.status === 'in_review');
}

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export function registerNewReviewCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'planReviewer.newReview',
    async () => {
      // Step 1 — read clipboard
      const content = await vscode.env.clipboard.readText();

      if (content.trim() === '') {
        await vscode.window.showInformationMessage(
          'Copia un piano markdown negli appunti, poi esegui di nuovo questo comando.'
        );
        return;
      }

      // Step 2 — parse markdown
      const parser = new MarkdownParser();
      const extractedTitle = parser.extractTitle(content);
      const parsedSections = parser.parseSections(content);

      // Step 3 — resolve plan and version numbers
      const db = Database.getInstance();
      const rawDb = db.getDb();
      const planRepo = new PlanRepository(rawDb);
      const sectionRepo = new SectionRepository(rawDb);
      const commentRepo = new CommentRepository(rawDb);

      const inReviewPlans = findInReviewPlans(planRepo);

      let targetPlanId: string | null = null;
      let versionNumber = 1;
      let planTitle =
        extractedTitle ?? `Untitled Plan ${new Date().toISOString()}`;

      if (inReviewPlans.length > 0) {
        const items: ReviewPickItem[] = inReviewPlans.map((plan): ExistingPlanItem => {
          const versions = planRepo.findVersionsByPlanId(plan.id);
          const nextVersion = versions.length + 1;
          return {
            itemKind: 'existing',
            planId: plan.id,
            planTitle: plan.title,
            nextVersion,
            label: `Aggiungi come versione ${nextVersion} a: ${plan.title}`,
          };
        });

        const newPlanItem: NewPlanItem = {
          itemKind: 'new',
          label: 'Nuovo piano',
        };
        items.push(newPlanItem);

        const selected = await vscode.window.showQuickPick<ReviewPickItem>(items, {
          placeHolder: 'Esiste già un piano in revisione. Cosa vuoi fare?',
        });

        if (selected === undefined) {
          return;
        }

        if (selected.itemKind === 'existing') {
          targetPlanId = selected.planId;
          versionNumber = selected.nextVersion;
          planTitle = selected.planTitle;
        }
        // else: itemKind === 'new' — targetPlanId stays null, versionNumber stays 1
      }

      const now = new Date().toISOString();

      // Step 4 — create Plan (only when it's a new plan)
      if (targetPlanId === null) {
        const newPlan: Plan = {
          id: uuidv7(),
          title: planTitle,
          source: 'manual',
          createdAt: now,
          updatedAt: now,
          status: 'in_review',
          tags: [],
        };
        planRepo.insert(newPlan);
        targetPlanId = newPlan.id;
      }

      // Step 5 — create Version
      const version: Version = {
        id: uuidv7(),
        planId: targetPlanId,
        versionNumber,
        content,
        reviewPrompt: null,
        createdAt: now,
      };
      planRepo.insertVersion(version);

      if (versionNumber > 1) {
        planRepo.update(targetPlanId, { updatedAt: now });
      }

      // Step 6 — create Sections
      const sections: Section[] = parsedSections.map((ps) => ({
        id: uuidv7(),
        versionId: version.id,
        heading: ps.heading,
        startLine: ps.startLine,
        endLine: ps.endLine,
        level: ps.level,
        orderIndex: ps.orderIndex,
      }));

      if (sections.length > 0) {
        sectionRepo.insertMany(sections);
      }

      // Step 7 — carry over unresolved comments from the previous version (versionNumber > 1 only)
      if (versionNumber > 1) {
        const allVersionsSoFar = planRepo.findVersionsByPlanId(targetPlanId);
        const prevVersion = allVersionsSoFar.find(
          (v) => v.versionNumber === versionNumber - 1
        );

        if (prevVersion !== undefined) {
          const prevComments = commentRepo.findUnresolvedByVersionId(prevVersion.id);

          if (prevComments.length > 0) {
            const diffLines = new DiffEngine().compute(prevVersion.content, version.content);
            const mappedComments = new CommentMapper().map(prevComments, diffLines);

            for (const mc of mappedComments) {
              if (mc.status === 'probably_unresolved') {
                // Guard: newTargetStart/End must be non-null (they are for probably_unresolved,
                // but we check explicitly to satisfy strict TypeScript and the quality requirement).
                if (mc.newTargetStart === null || mc.newTargetEnd === null) {
                  continue;
                }
                const carriedComment: Comment = {
                  id: uuidv7(),
                  versionId: version.id,
                  type: mc.comment.type,
                  targetStart: mc.newTargetStart,
                  targetEnd: mc.newTargetEnd,
                  sectionId: mc.comment.sectionId,
                  body: mc.comment.body,
                  category: mc.comment.category,
                  resolved: false,
                  createdAt: now,
                  carriedFromId: mc.comment.id,
                  targetStartChar: null,
                  targetEndChar: null,
                  selectedText: null,
                };
                commentRepo.insert(carriedComment);
              } else if (mc.status === 'probably_resolved') {
                commentRepo.update(mc.comment.id, { resolved: true });
              }
              // orphaned: do nothing — comment stays in old version, not copied
            }
          }
        }
      }

      // Step 8 — refresh tree view and open/reveal WebView
      PlanExplorerProvider.instance?.refresh();
      const panel = PlanReviewPanel.createOrShow(context.extensionUri);

      // Step 9 — retrieve the full Plan object and send planLoaded
      const plan = planRepo.findById(targetPlanId);
      if (plan === null) {
        await vscode.window.showErrorMessage(
          "Errore interno: piano non trovato dopo l'inserimento."
        );
        return;
      }

      const allVersions = planRepo.findVersionsByPlanId(targetPlanId);

      // Fetch all comments for the new version (includes any carried-over ones).
      const versionComments = commentRepo.findByVersionId(version.id);

      panel.postMessage({
        type: 'planLoaded',
        payload: {
          plan,
          version,
          versions: allVersions,
          sections,
          comments: versionComments,
          html: new PlanMarkdownEngine().render(version.content, sections).html,
        },
      });
    }
  );
}
