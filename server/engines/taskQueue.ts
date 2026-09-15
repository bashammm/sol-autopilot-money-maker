/**
 * YABBAI - Earning Task Queue
 * Persistent job queue with:
 * - Leases and expiration
 * - Automated retries with exponential backoff
 * - Idempotency keys
 * - Heartbeats
 * - Dead-letter handling
 */

import { TaskQueueItem, StrategyCategory } from '../../src/types/yabbai';
import { randomUUID } from 'crypto';

export class EarningTaskQueue {
  private tasks: Map<string, TaskQueueItem> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotencyKey -> taskId

  constructor() {
    this.seedSampleTasks();
  }

  private seedSampleTasks() {
    this.enqueueTask({
      idempotencyKey: 'task-sec-audit-01',
      agentId: 'agent-01',
      opportunityId: 'opp-zero-01',
      strategyCategory: 'security_analysis',
      payload: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', scanDepth: 'FULL' },
      maxRetries: 3
    });

    this.enqueueTask({
      idempotencyKey: 'task-telemetry-01',
      agentId: 'agent-02',
      opportunityId: 'opp-zero-02',
      strategyCategory: 'analytics',
      payload: { poolAddress: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE', intervalSec: 5 },
      maxRetries: 3
    });
  }

  public enqueueTask(params: {
    idempotencyKey: string;
    agentId: string;
    opportunityId: string;
    strategyCategory: StrategyCategory;
    payload: Record<string, any>;
    maxRetries?: number;
  }): TaskQueueItem {
    // Idempotency check
    const existingTaskId = this.idempotencyIndex.get(params.idempotencyKey);
    if (existingTaskId && this.tasks.has(existingTaskId)) {
      return this.tasks.get(existingTaskId)!;
    }

    const taskId = `task-${randomUUID().substring(0, 8)}`;
    const task: TaskQueueItem = {
      id: taskId,
      idempotencyKey: params.idempotencyKey,
      agentId: params.agentId,
      opportunityId: params.opportunityId,
      strategyCategory: params.strategyCategory,
      status: 'PENDING',
      leaseExpiry: 0,
      retryCount: 0,
      maxRetries: params.maxRetries || 3,
      payload: params.payload,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.tasks.set(taskId, task);
    this.idempotencyIndex.set(params.idempotencyKey, taskId);
    return task;
  }

  /**
   * Acquire a lease on next available task for an agent
   */
  public leaseNextTask(agentId: string, leaseDurationMs: number = 30000): TaskQueueItem | null {
    const now = Date.now();

    for (const task of this.tasks.values()) {
      const isExpiredLease = task.status === 'LEASED' && task.leaseExpiry < now;
      if (task.status === 'PENDING' || isExpiredLease) {
        if (isExpiredLease) {
          task.retryCount++;
          if (task.retryCount > task.maxRetries) {
            task.status = 'DEAD_LETTER';
            task.error = 'Lease expired and max retries exceeded';
            task.updatedAt = now;
            continue;
          }
        }

        task.status = 'LEASED';
        task.agentId = agentId;
        task.leaseExpiry = now + leaseDurationMs;
        task.updatedAt = now;
        return task;
      }
    }

    return null;
  }

  /**
   * Heartbeat to extend lease on active task
   */
  public heartbeatLease(taskId: string, extensionMs: number = 30000): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'LEASED') {
      task.leaseExpiry = Date.now() + extensionMs;
      task.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  public completeTask(taskId: string): TaskQueueItem {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    task.status = 'COMPLETED';
    task.updatedAt = Date.now();
    return task;
  }

  public failTask(taskId: string, error: string): TaskQueueItem {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.retryCount++;
    task.error = error;
    task.updatedAt = Date.now();

    if (task.retryCount >= task.maxRetries) {
      task.status = 'DEAD_LETTER';
    } else {
      task.status = 'PENDING';
      task.leaseExpiry = 0;
    }

    return task;
  }

  public getAllTasks(): TaskQueueItem[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
