export interface ProcessingStatistics {
  total: number;
  success: number;
  failed: number;
  retries: number;
  lastError?: string;
}

