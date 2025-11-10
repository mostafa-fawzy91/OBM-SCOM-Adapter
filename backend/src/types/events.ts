export type ScomSeverity =
  | 'Critical'
  | 'Error'
  | 'Warning'
  | 'Information'
  | 'Informational'
  | 'Verbose';

export interface ScomEvent {
  eventId: string;
  name: string;
  severity: ScomSeverity;
  description: string;
  netbiosComputerName?: string;
  monitoringObjectPath?: string;
  category?: string;
  timeRaised?: string;
  timeAdded?: string;
  priority?: number;
  resolutionState?: string;
  customFields?: Record<string, unknown>;
  rawXml?: string;
  sourceFile?: string;
  receivedAt: string;
}

export type ObmSeverity = 'critical' | 'warning' | 'normal';

export interface ObmEventPayload {
  title: string;
  severity: ObmSeverity;
  source: string;
  category: string;
  application: string;
  object: string;
  description: string;
  customAttributes?: Record<string, unknown>;
  occurredAt: string;
  receivedAt: string;
  correlationId: string;
}

export interface ObmEvent {
  event: ObmEventPayload;
}

export interface ProcessingContext {
  correlationId: string;
  eventId: string;
  sourceFile: string;
  attempt: number;
  startedAt: number;
}

export interface ProcessingResult {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  retryScheduled?: boolean;
  processingTimeMs: number;
}

