/**
 * Resolution API Client
 *
 * Utility functions for communicating with the bridge service resolution API
 */

import { BRIDGE_SERVICE_URL } from '../constants';

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

/**
 * Schedule automated resolution for a market
 */
export async function scheduleResolution(params: ScheduleResolutionRequest): Promise<ScheduleResolutionResponse> {
  console.log(`[Frontend] Scheduling resolution for: ${params.marketTitle}`);

  try {
    const response = await fetch(`${BRIDGE_SERVICE_URL}/resolution/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    console.log(`[Frontend] Resolution scheduled: ${data.jobId}`);
    return data;
  } catch (error: any) {
    console.error(`[Frontend] Schedule failed:`, error.message);

    // Return a structured error response
    return {
      success: false,
      message: error.message || 'Failed to communicate with bridge service'
    };
  }
}

/**
 * Check if bridge service is available
 */
export async function checkBridgeServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_SERVICE_URL}/health`, {
      method: 'GET',
    });

    return response.ok;
  } catch (error) {
    console.warn('Bridge service health check failed:', error);
    return false;
  }
}