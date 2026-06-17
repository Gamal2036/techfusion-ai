import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'techfusion-api-gateway',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${otelEndpoint}/v1/traces`,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

export async function initTelemetry(): Promise<void> {
  try {
    sdk.start();
    console.log('OpenTelemetry SDK initialized');
  } catch (err) {
    console.warn('OpenTelemetry initialization failed (non-fatal):', err);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  try {
    await sdk.shutdown();
  } catch (err) {
    console.warn('OpenTelemetry shutdown error:', err);
  }
}
