import { v7 as uuidv7 } from 'uuid';
import type { HostMessage, WebViewMessage } from '../../../shared/messages';
import { Database } from '../../core/db/database';
import { PlanRepository } from '../../core/db/repositories/PlanRepository';
import { SectionRepository } from '../../core/db/repositories/SectionRepository';
import { CommentRepository } from '../../core/db/repositories/CommentRepository';
import { DiffEngine } from '../../core/services/DiffEngine';
import { CommentMapper } from '../../core/services/CommentMapper';
import { PlanMarkdownEngine } from '../../markdown/PlanMarkdownEngine';
import type { Comment, Plan } from '../../../shared/models';
import { PlanExplorerProvider } from '../explorer/PlanExplorerProvider';

/**
 * Handles all WebViewMessage types, performing DB operations and posting
 * HostMessages back to the webview.
 *
 * Separated from PlanReviewPanel so that webview lifecycle concerns
 * (panel creation, HTML rendering, nonce) stay in PlanReviewPanel,
 * while business logic lives here.
 */
export class MessageHandler {
  constructor(
    private readonly postMessage: (message: HostMessage) => void,
  ) {}

  handle(message: Exclude<WebViewMessage, { type: 'ready' }>): void {
    switch (message.type) {
      case 'requestPlan':       this.handleRequestPlan(message.payload);       break;
      case 'updatePlanStatus':  this.handleUpdatePlanStatus(message.payload);  break;
      case 'addComment':        this.handleAddComment(message.payload);        break;
      case 'updateComment':     this.handleUpdateComment(message.payload);     break;
      case 'deleteComment':     this.handleDeleteComment(message.payload);     break;
      case 'resolveComment':    this.handleResolveComment(message.payload);    break;
      case 'requestDiff':       this.handleRequestDiff(message.payload);       break;
      case 'saveReviewPrompt':  this.handleSaveReviewPrompt(message.payload);  break;
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
      payload: { plan, version, versions: allVersions, sections, comments, html: new PlanMarkdownEngine().render(version.content, sections).html },
    });
  }

  private handleUpdatePlanStatus(payload: { planId: string; status: Plan['status']; note?: string }): void {
    const planRepo = new PlanRepository(Database.getInstance().getDb());

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
    const commentRepo = new CommentRepository(Database.getInstance().getDb());

    const comment: Comment = {
      ...payload,
      id: uuidv7(),
      createdAt: new Date().toISOString(),
    };
    commentRepo.insert(comment);
    this.postMessage({ type: 'commentAdded', payload: comment });
  }

  private handleUpdateComment(payload: { id: string; body?: string }): void {
    const commentRepo = new CommentRepository(Database.getInstance().getDb());

    commentRepo.update(payload.id, {
      ...(payload.body !== undefined ? { body: payload.body } : {}),
    });

    const updated = commentRepo.findById(payload.id);
    if (updated !== null) {
      this.postMessage({ type: 'commentUpdated', payload: updated });
    }
  }

  private handleDeleteComment(payload: { id: string }): void {
    const commentRepo = new CommentRepository(Database.getInstance().getDb());

    commentRepo.delete(payload.id);
    this.postMessage({ type: 'commentDeleted', payload: { commentId: payload.id } });
  }

  private handleResolveComment(payload: { id: string }): void {
    const commentRepo = new CommentRepository(Database.getInstance().getDb());

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
    const planRepo = new PlanRepository(Database.getInstance().getDb());
    planRepo.updateVersionReviewPrompt(payload.versionId, payload.prompt);
  }
}
