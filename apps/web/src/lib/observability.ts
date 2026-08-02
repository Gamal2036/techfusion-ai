export interface ObservabilityConfig {
  enabled: boolean;
  apiEndpoint?: string;
  sampleRate: number;
}

const config: ObservabilityConfig = {
  enabled: process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED !== 'false',
  apiEndpoint: process.env.NEXT_PUBLIC_OBSERVABILITY_ENDPOINT,
  sampleRate: parseFloat(process.env.NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE || '0.1'),
};

export interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  url: string;
  userAgent?: string;
  buildId?: string;
}

export interface PerformanceEntry {
  name: string;
  type: string;
  duration: number;
  startTime: number;
}

export function reportError(error: Error, component?: string, severity: ErrorReport['severity'] = 'medium'): void {
  if (!config.enabled || !config.apiEndpoint) return;

  const report: ErrorReport = {
    message: error.message.slice(0, 500),
    stack: error.stack?.slice(0, 1000),
    component,
    severity,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  try {
    navigator.sendBeacon(
      `${config.apiEndpoint}/frontend/errors`,
      new Blob([JSON.stringify(report)], { type: 'application/json' }),
    );
  } catch {
    // Silently fail — observability must never break the application
  }
}

export function reportPerformance(entries: PerformanceEntry[]): void {
  if (!config.enabled || !config.apiEndpoint) return;

  try {
    navigator.sendBeacon(
      `${config.apiEndpoint}/frontend/performance`,
      new Blob([JSON.stringify({ entries, timestamp: new Date().toISOString() })], { type: 'application/json' }),
    );
  } catch {
    // Silently fail
  }
}

export function initFrontendObservability(): void {
  if (!config.enabled) return;

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      reportError(
        new Error(event.message || 'Unhandled error'),
        'window.error',
        'high',
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      reportError(
        reason instanceof Error ? reason : new Error(String(reason)),
        'unhandledrejection',
        'high',
      );
    });

    window.addEventListener('load', () => {
      setTimeout(() => {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
          const paint = performance.getEntriesByType('paint');
          const navigation = performance.getEntriesByType('navigation');
          const entries = [...paint, ...navigation].map((e) => ({
            name: e.name,
            type: e.entryType,
            duration: e.duration || 0,
            startTime: e.startTime,
          }));
          if (entries.length > 0) {
            reportPerformance(entries);
          }
        }
      }, 2000);
    });
  }
}
