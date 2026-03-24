import * as vscode from 'vscode';
import { v7 as uuidv7 } from 'uuid';
import { MarkdownParser } from '../../core/services/MarkdownParser';
import { Database } from '../../core/db/database';
import { PlanRepository } from '../../core/db/repositories/PlanRepository';
import { SectionRepository } from '../../core/db/repositories/SectionRepository';
import { CommentRepository } from '../../core/db/repositories/CommentRepository';

import { PlanMarkdownEngine } from '../../markdown/PlanMarkdownEngine';
import { PlanReviewPanel } from './PlanReviewPanel';
import { PlanExplorerProvider } from '../explorer/PlanExplorerProvider';
import type { Plan, Version, Section } from '../../../shared/models';

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
          'Copy a markdown plan to clipboard, then run this command again.'
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
            label: `Add as version ${nextVersion} to: ${plan.title}`,
          };
        });

        const newPlanItem: NewPlanItem = {
          itemKind: 'new',
          label: 'New plan',
        };
        items.push(newPlanItem);

        const selected = await vscode.window.showQuickPick<ReviewPickItem>(items, {
          placeHolder: 'A plan is already in review. What do you want to do?',
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

      // Step 7 — refresh tree view and open/reveal WebView
      PlanExplorerProvider.instance?.refresh();
      const panel = PlanReviewPanel.createOrShow(context.extensionUri);

      // Step 9 — retrieve the full Plan object and send planLoaded
      const plan = planRepo.findById(targetPlanId);
      if (plan === null) {
        await vscode.window.showErrorMessage(
          'Internal error: plan not found after insert.'
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
