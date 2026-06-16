export interface HealthCheckResponse {
  status: string;
  timestamp?: string;
  version?: string;
}

export type WorkspaceName = 'web' | 'api-gateway' | 'agent' | 'worker';
