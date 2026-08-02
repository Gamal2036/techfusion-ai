import { randomUUID } from 'crypto';

export interface JobCorrelationData {
  requestId: string;
  correlationId: string;
  traceId?: string;
  userId?: string;
  orgId?: string;
}

export function extractCorrelationFromJob(jobData: Record<string, unknown>): JobCorrelationData | undefined {
  const meta = jobData as any;
  if (meta?._correlation) {
    return meta._correlation as JobCorrelationData;
  }
  return undefined;
}

export function attachCorrelationToJobData(
  jobData: Record<string, unknown>,
  correlation?: JobCorrelationData,
): Record<string, unknown> {
  if (!correlation) return jobData;
  return {
    ...jobData,
    _correlation: {
      requestId: correlation.requestId,
      correlationId: correlation.correlationId,
      traceId: correlation.traceId,
      userId: correlation.userId,
      orgId: correlation.orgId,
    },
  };
}

export function generateCorrelationId(): string {
  return randomUUID();
}
