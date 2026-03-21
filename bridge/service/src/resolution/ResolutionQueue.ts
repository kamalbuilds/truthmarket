/**
 * Resolution Queue Manager
 *
 * Manages automated market resolution using node-cron for exact datetime scheduling.
 * Provides persistent queue storage and automatic cleanup of completed jobs.
 */

import cron from "node-cron";
import fs from "fs";
import path from "path";
import { AutoResolver } from "./AutoResolver.js";

export interface ResolutionJob {
  id: string;
  contractAddress: string;
  endDate: Date;
  marketTitle: string;
  cronJobId?: string;
  status: 'pending' | 'scheduled' | 'completed' | 'failed';
  createdAt: Date;
  executedAt?: Date;
  errorMessage?: string;
}

interface QueueStorage {
  jobs: ResolutionJob[];
  version: string;
}

export class ResolutionQueue {
  private jobs: Map<string, ResolutionJob>;
  private cronJobs: Map<string, cron.ScheduledTask>;
  private autoResolver: AutoResolver;
  private storageFile: string;

  constructor() {
    this.jobs = new Map();
    this.cronJobs = new Map();
    this.autoResolver = new AutoResolver();

    // Storage file in the bridge service root
    this.storageFile = path.join(process.cwd(), 'resolution-queue.json');

    // Load existing jobs on startup
    this.loadFromStorage();

    // Cleanup completed jobs every hour
    cron.schedule('0 * * * *', () => this.cleanupCompletedJobs());
  }

  /**
   * Add a new resolution job to the queue
   */
  public addJob(contractAddress: string, endDate: Date, marketTitle: string): string {
    const id = this.generateJobId(contractAddress, endDate);

    console.log(`[Resolution] Scheduled: ${marketTitle}`);

    // Check if job already exists
    if (this.jobs.has(id)) {
      return id;
    }

    const job: ResolutionJob = {
      id,
      contractAddress,
      endDate,
      marketTitle,
      status: 'pending',
      createdAt: new Date(),
    };

    // Add to memory
    this.jobs.set(id, job);

    // Schedule the cron job
    this.scheduleJob(job);

    // Persist to storage
    this.saveToStorage();

    return id;
  }

  /**
   * Remove a job from the queue
   */
  public removeJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) {
      return false;
    }

    // Cancel cron job if it exists
    if (job.cronJobId) {
      const cronJob = this.cronJobs.get(job.cronJobId);
      if (cronJob) {
        cronJob.stop();
        this.cronJobs.delete(job.cronJobId);
      }
    }

    // Remove from memory
    this.jobs.delete(id);

    // Persist changes
    this.saveToStorage();

    return true;
  }

  /**
   * Get all jobs (for API endpoint)
   */
  public getAllJobs(): ResolutionJob[] {
    return Array.from(this.jobs.values()).sort((a, b) =>
      a.endDate.getTime() - b.endDate.getTime()
    );
  }

  /**
   * Get job by ID
   */
  public getJob(id: string): ResolutionJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Schedule a cron job for the exact datetime
   */
  private scheduleJob(job: ResolutionJob): void {
    const now = new Date();
    const endDate = new Date(job.endDate);
    const hoursUntil = Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60) * 10) / 10;

    // If the end date is in the past, mark as failed
    if (endDate <= now) {
      job.status = 'failed';
      job.errorMessage = 'End date is in the past';
      return;
    }

    // Create cron expression for the exact datetime
    const cronExpression = this.dateToCronExpression(endDate);
    job.cronJobId = `cron_${job.id}`;

    try {
      const cronJob = cron.schedule(cronExpression, async () => {
        console.log(`[Resolution] EXECUTING: ${job.marketTitle} (${job.contractAddress})`);
        await this.executeJob(job.id);
      }, {
        scheduled: false, // Don't start immediately
        timezone: 'UTC'
      });

      // Start the cron job
      cronJob.start();

      // Store reference
      this.cronJobs.set(job.cronJobId, cronJob);
      job.status = 'scheduled';


    } catch (error) {
      job.status = 'failed';
      job.errorMessage = `Failed to schedule: ${error}`;
      console.error(`[Resolution] Schedule error:`, error);
    }
  }

  /**
   * Execute a resolution job
   */
  private async executeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`[Resolution] Job not found: ${jobId}`);
      return;
    }

    try {
      // Call the auto resolver
      await this.autoResolver.resolveMarket(job.contractAddress, job.marketTitle);

      // Mark as completed
      job.status = 'completed';
      job.executedAt = new Date();

      // Cleanup cron job
      if (job.cronJobId) {
        const cronJob = this.cronJobs.get(job.cronJobId);
        if (cronJob) {
          cronJob.stop();
          this.cronJobs.delete(job.cronJobId);
        }
      }

      console.log(`[Resolution] COMPLETED: ${job.marketTitle}`);

    } catch (error: any) {
      job.status = 'failed';
      job.errorMessage = error.message || String(error);
      job.executedAt = new Date();

      console.error(`[Resolution] FAILED: ${job.marketTitle} - ${job.errorMessage}`);
    }

    // Persist changes
    this.saveToStorage();
  }

  /**
   * Convert Date to cron expression (runs once at exact time)
   */
  private dateToCronExpression(date: Date): string {
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1; // cron months are 1-12

    // Format: minute hour day month *
    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Generate unique job ID from contract address and date
   */
  private generateJobId(contractAddress: string, endDate: Date): string {
    const timestamp = endDate.getTime();
    const addressSuffix = contractAddress.slice(-8); // Last 8 chars of address
    return `resolve_${addressSuffix}_${timestamp}`;
  }

  /**
   * Clean up completed jobs older than 24 hours
   */
  private cleanupCompletedJobs(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanupCount = 0;

    for (const [id, job] of this.jobs) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.executedAt &&
        job.executedAt < cutoffTime
      ) {
        this.jobs.delete(id);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      this.saveToStorage();
    }
  }

  /**
   * Save jobs to persistent storage
   */
  private saveToStorage(): void {
    const storage: QueueStorage = {
      jobs: Array.from(this.jobs.values()),
      version: '1.0'
    };

    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(storage, null, 2));
    } catch (error) {
      console.warn(`[ResolutionQueue] Failed to save to storage:`, error);
    }
  }

  /**
   * Load jobs from persistent storage
   */
  private loadFromStorage(): void {
    try {
      if (!fs.existsSync(this.storageFile)) {
        return;
      }

      const data = fs.readFileSync(this.storageFile, 'utf-8');
      const storage: QueueStorage = JSON.parse(data);

      let loadedCount = 0;
      let rescheduledCount = 0;

      for (const jobData of storage.jobs) {
        // Restore Date objects
        const job: ResolutionJob = {
          ...jobData,
          endDate: new Date(jobData.endDate),
          createdAt: new Date(jobData.createdAt),
          executedAt: jobData.executedAt ? new Date(jobData.executedAt) : undefined,
        };

        this.jobs.set(job.id, job);
        loadedCount++;

        // Reschedule pending jobs that haven't executed yet
        if (job.status === 'pending' || job.status === 'scheduled') {
          this.scheduleJob(job);
          rescheduledCount++;
        }
      }

      if (loadedCount > 0) {
        console.log(`[ResolutionQueue] Loaded ${loadedCount} jobs`);
      }

    } catch (error) {
      console.warn(`[ResolutionQueue] Failed to load from storage:`, error);
    }
  }

  /**
   * Graceful shutdown - cancel all cron jobs
   */
  public shutdown(): void {
    console.log(`[ResolutionQueue] Shutting down...`);

    // Cancel all cron jobs
    for (const cronJob of this.cronJobs.values()) {
      cronJob.stop();
    }
    this.cronJobs.clear();

    // Save final state
    this.saveToStorage();

    console.log(`[ResolutionQueue] Shutdown complete`);
  }
}