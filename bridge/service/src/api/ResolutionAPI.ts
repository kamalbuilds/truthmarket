/**
 * Resolution API - HTTP endpoints for automated market resolution
 *
 * Provides REST API for the frontend to schedule and monitor automated resolutions.
 */

import express from 'express';
import type { ResolutionQueue } from '../resolution/ResolutionQueue.js';

export interface ScheduleResolutionRequest {
  contractAddress: string;
  endDate: string; // ISO string
  marketTitle: string;
}

export interface ScheduleResolutionResponse {
  success: boolean;
  jobId?: string;
  message: string;
}

export interface QueueStatusResponse {
  success: boolean;
  jobs: Array<{
    id: string;
    contractAddress: string;
    endDate: string;
    marketTitle: string;
    status: string;
    createdAt: string;
    executedAt?: string;
    errorMessage?: string;
  }>;
  totalJobs: number;
}

export class ResolutionAPI {
  private app: express.Application;
  private resolutionQueue: ResolutionQueue;

  constructor(resolutionQueue: ResolutionQueue) {
    this.app = express();
    this.resolutionQueue = resolutionQueue;

    // Middleware
    this.app.use(express.json());

    // CORS for frontend communication
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Routes
    this.setupRoutes();

    console.log(`[ResolutionAPI] API endpoints initialized`);
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'Bridge Resolution Service is running',
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        message: 'Bridge Resolution Service is running',
        timestamp: new Date().toISOString()
      });
    });

    // Schedule a new resolution
    this.app.post('/resolution/schedule', (req, res) => {
      this.handleScheduleResolution(req, res);
    });

    // Get queue status
    this.app.get('/resolution/queue', (req, res) => {
      this.handleGetQueue(req, res);
    });

    // Get specific job status
    this.app.get('/resolution/job/:id', (req, res) => {
      this.handleGetJob(req, res);
    });

    // Cancel a specific job (DELETE)
    this.app.delete('/resolution/job/:id', (req, res) => {
      this.handleCancelJob(req, res);
    });

    // Catch-all for unknown routes
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`
      });
    });

    // Error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error(`[ResolutionAPI] Error:`, err);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  /**
   * POST /resolution/schedule
   * Schedule a new market resolution
   */
  private handleScheduleResolution(req: express.Request, res: express.Response): void {
    try {
      const { contractAddress, endDate, marketTitle }: ScheduleResolutionRequest = req.body;

      // Basic validation
      if (!contractAddress || typeof contractAddress !== 'string') {
        res.status(400).json({
          success: false,
          message: 'contractAddress is required and must be a string'
        });
        return;
      }

      if (!endDate || typeof endDate !== 'string') {
        res.status(400).json({
          success: false,
          message: 'endDate is required and must be an ISO date string'
        });
        return;
      }

      if (!marketTitle || typeof marketTitle !== 'string') {
        res.status(400).json({
          success: false,
          message: 'marketTitle is required and must be a string'
        });
        return;
      }

      // Validate contract address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        res.status(400).json({
          success: false,
          message: 'contractAddress must be a valid Ethereum address'
        });
        return;
      }

      // Parse and validate end date
      const endDateTime = new Date(endDate);
      if (isNaN(endDateTime.getTime())) {
        res.status(400).json({
          success: false,
          message: 'endDate must be a valid ISO date string'
        });
        return;
      }

      // Check if end date is in the future
      const now = new Date();
      if (endDateTime <= now) {
        res.status(400).json({
          success: false,
          message: 'endDate must be in the future'
        });
        return;
      }

      // Add job to queue
      const jobId = this.resolutionQueue.addJob(contractAddress, endDateTime, marketTitle);

      const response: ScheduleResolutionResponse = {
        success: true,
        jobId,
        message: `Resolution scheduled for ${endDateTime.toISOString()}`
      };

      res.json(response);

    } catch (error: any) {
      console.error(`[API] Schedule error:`, error.message);

      res.status(500).json({
        success: false,
        message: 'Failed to schedule resolution',
        error: error.message
      });
    }
  }

  /**
   * GET /resolution/queue
   * Get all jobs in the queue
   */
  private handleGetQueue(req: express.Request, res: express.Response): void {
    try {
      const jobs = this.resolutionQueue.getAllJobs();

      const response: QueueStatusResponse = {
        success: true,
        jobs: jobs.map(job => ({
          id: job.id,
          contractAddress: job.contractAddress,
          endDate: job.endDate.toISOString(),
          marketTitle: job.marketTitle,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          executedAt: job.executedAt?.toISOString(),
          errorMessage: job.errorMessage
        })),
        totalJobs: jobs.length
      };

      res.json(response);

    } catch (error: any) {
      console.error(`[ResolutionAPI] Queue status error:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to get queue status',
        error: error.message
      });
    }
  }

  /**
   * GET /resolution/job/:id
   * Get specific job details
   */
  private handleGetJob(req: express.Request, res: express.Response): void {
    try {
      const { id } = req.params;
      const job = this.resolutionQueue.getJob(id);

      if (!job) {
        res.status(404).json({
          success: false,
          message: `Job not found: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        job: {
          id: job.id,
          contractAddress: job.contractAddress,
          endDate: job.endDate.toISOString(),
          marketTitle: job.marketTitle,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          executedAt: job.executedAt?.toISOString(),
          errorMessage: job.errorMessage
        }
      });

    } catch (error: any) {
      console.error(`[ResolutionAPI] Get job error:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to get job details',
        error: error.message
      });
    }
  }

  /**
   * DELETE /resolution/job/:id
   * Cancel a specific job
   */
  private handleCancelJob(req: express.Request, res: express.Response): void {
    try {
      const { id } = req.params;
      const removed = this.resolutionQueue.removeJob(id);

      if (!removed) {
        res.status(404).json({
          success: false,
          message: `Job not found or already completed: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        message: `Job cancelled: ${id}`
      });


    } catch (error: any) {
      console.error(`[ResolutionAPI] Cancel job error:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel job',
        error: error.message
      });
    }
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}