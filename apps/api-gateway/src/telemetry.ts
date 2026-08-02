import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { tracing } from '@opentelemetry/sdk-node';
const { ParentBasedSampler, TraceIdRatioBasedSampler } = tracing;
import { createStructuredLogger } from './common/structured-logger';

const logger = createStructuredLogger('Telemetry');

const otelEnabled = process.env.OTEL_ENABLED !== 'false';
const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const serviceName = process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway';
const sampleRate = parseFloat(process.env.OTEL_SAMPLE_RATE || '0.1');

let sdk: NodeSDK | null = null;

export async function initTelemetry(): Promise<void> {
  if (!otelEnabled) {
    logger.log('OpenTelemetry disabled via OTEL_ENABLED=false');
    return;
  }

  try {
    const sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(sampleRate),
    });

    sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
      sampler,
    });

    sdk.start();
    logger.log(`OpenTelemetry SDK initialized (sampleRate=${sampleRate}, endpoint=${otelEndpoint})`);
  } catch (err) {
    logger.warn('OpenTelemetry initialization failed (non-fatal)', {
      errorType: err instanceof Error ? err.name : 'OtelInitError',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    logger.log('OpenTelemetry SDK shut down');
  } catch (err) {
    logger.warn('OpenTelemetry shutdown error', {
      errorType: err instanceof Error ? err.name : 'OtelShutdownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
