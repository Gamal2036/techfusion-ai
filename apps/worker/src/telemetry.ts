import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { tracing } from '@opentelemetry/sdk-node';
const { ParentBasedSampler, TraceIdRatioBasedSampler } = tracing;

const otelEnabled = process.env.OTEL_ENABLED !== 'false';
const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const serviceName = process.env.OTEL_SERVICE_NAME || 'techfusion-worker';
const sampleRate = parseFloat(process.env.OTEL_SAMPLE_RATE || '0.1');

let sdk: NodeSDK | null = null;

export async function initTelemetry(): Promise<void> {
  if (!otelEnabled) {
    console.log('[Telemetry] OpenTelemetry disabled via OTEL_ENABLED=false');
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
    console.log(`[Telemetry] OpenTelemetry SDK initialized (sampleRate=${sampleRate})`);
  } catch (err) {
    console.warn('[Telemetry] OpenTelemetry initialization failed (non-fatal):', err);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    console.log('[Telemetry] OpenTelemetry SDK shut down');
  } catch (err) {
    console.warn('[Telemetry] OpenTelemetry shutdown error:', err);
  }
}
