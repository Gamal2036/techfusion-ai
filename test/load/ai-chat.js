import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('ai_errors');
const aiLatency = new Trend('ai_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ai_errors: ['rate<0.01'],           // < 1% error rate
    ai_latency: ['p(95)<5000'],         // p95 < 5s
    http_req_duration: ['p(95)<10000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Technicians authenticate first, then send AI queries
export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, {
    email: __ENV.TEST_EMAIL || 'loadtest@techfusion.dev',
    password: __ENV.TEST_PASSWORD || 'password123',
  });

  const accessToken = loginRes.json('accessToken');
  return { accessToken };
}

export default function (data) {
  const token = data.accessToken;

  group('AI troubleshooting chat', () => {
    const payload = {
      message: 'Device is running slow with high CPU usage. What should I check?',
      deviceId: 'load-test-device-001',
    };

    const res = http.post(`${BASE_URL}/ai/troubleshoot`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const ok = check(res, {
      'AI response received': (r) => r.status === 201,
    });

    errorRate.add(!ok);
    aiLatency.add(res.timings.duration);
  });

  sleep(3 + Math.random() * 5);
}
