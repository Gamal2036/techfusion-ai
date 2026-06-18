import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const ingestLatency = new Trend('ingest_latency');

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // ramp up to 100 concurrent agents
    { duration: '1m', target: 500 },   // ramp to 500 concurrent agents
    { duration: '2m', target: 500 },   // sustain at 500
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    errors: ['rate<0.001'],            // < 0.1% error rate
    ingest_latency: ['p(95)<500'],     // p95 < 500ms
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Pre-registered device tokens for load simulation
// In production these would be provisioned via the agent registration flow
const DEVICE_TOKENS = [
  'load-test-device-001', 'load-test-device-002', 'load-test-device-003',
  'load-test-device-004', 'load-test-device-005', 'load-test-device-006',
  'load-test-device-007', 'load-test-device-008', 'load-test-device-009',
  'load-test-device-010',
];

export default function () {
  const deviceToken = DEVICE_TOKENS[Math.floor(Math.random() * DEVICE_TOKENS.length)];

  group('device telemetry ingestion', () => {
    const payload = {
      cpuUsage: Math.random() * 100,
      ramUsed: Math.floor(Math.random() * 16 * 1024 * 1024 * 1024),
      ramTotal: 16 * 1024 * 1024 * 1024,
      ramPercent: Math.random() * 100,
      diskUsed: Math.floor(Math.random() * 500 * 1024 * 1024 * 1024),
      diskTotal: 1024 * 1024 * 1024 * 1024,
      diskReadBytes: Math.floor(Math.random() * 1000000),
      diskWriteBytes: Math.floor(Math.random() * 500000),
      diskSmartStatus: Math.random() > 0.9 ? 'FAIL' : 'PASS',
      networkRxBytes: Math.floor(Math.random() * 100000000),
      networkTxBytes: Math.floor(Math.random() * 50000000),
      uptime: Math.floor(Math.random() * 86400 * 30),
      processes: Math.floor(Math.random() * 300) + 50,
      tempCpu: Math.random() * 30 + 40,
      loadAverage1Min: Math.random() * 8,
    };

    const res = http.post(`${BASE_URL}/devices/metrics`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deviceToken}` },
    });

    const ok = check(res, {
      'telemetry accepted': (r) => r.status === 200 || r.status === 201,
    });

    errorRate.add(!ok);
    ingestLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1); // stagger requests
}
