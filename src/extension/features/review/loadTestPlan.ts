import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v7 as uuidv7 } from 'uuid';
import { MarkdownParser } from '../../core/services/MarkdownParser';
import { Database } from '../../core/db/database';
import { PlanRepository } from '../../core/db/repositories/PlanRepository';
import { SectionRepository } from '../../core/db/repositories/SectionRepository';
import { PlanReviewPanel } from './PlanReviewPanel';
import { PlanExplorerProvider } from '../explorer/PlanExplorerProvider';
import { PlanMarkdownEngine } from '../../markdown/PlanMarkdownEngine';
import type { Plan, Version, Section } from '../../../shared/models';

export function registerLoadTestPlanCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'planReviewer.loadTestPlan',
    async () => {
      const fixturePath = path.join(
        context.extensionUri.fsPath,
        'test-fixtures',
        'sample-plan.md'
      );

      if (!fs.existsSync(fixturePath)) {
        await vscode.window.showErrorMessage(
          `Test fixture not found: ${fixturePath}`
        );
        return;
      }

      const content = fs.readFileSync(fixturePath, 'utf-8');

      const parser = new MarkdownParser();
      const extractedTitle = parser.extractTitle(content);
      const parsedSections = parser.parseSections(content);

      const db = Database.getInstance();
      const rawDb = db.getDb();
      const planRepo = new PlanRepository(rawDb);
      const sectionRepo = new SectionRepository(rawDb);

      const now = new Date().toISOString();
      const plan: Plan = {
        id: uuidv7(),
        title: extractedTitle ?? 'Sample Plan',
        source: 'manual',
        createdAt: now,
        updatedAt: now,
        status: 'in_review',
        tags: [],
      };
      planRepo.insert(plan);

      const version: Version = {
        id: uuidv7(),
        planId: plan.id,
        versionNumber: 1,
        content,
        reviewPrompt: null,
        createdAt: now,
      };
      planRepo.insertVersion(version);

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

      PlanExplorerProvider.instance?.refresh();
      const panel = PlanReviewPanel.createOrShow(context.extensionUri);

      const allVersions = planRepo.findVersionsByPlanId(plan.id);

      panel.postMessage({
        type: 'planLoaded',
        payload: { plan, version, versions: allVersions, sections, comments: [], html: new PlanMarkdownEngine().render(version.content, sections).html },
      });

      await vscode.window.showInformationMessage(
        `Test plan loaded: "${plan.title}" (${sections.length} sections)`
      );
    }
  );
}
