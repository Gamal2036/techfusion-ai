import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('report_errors');
const reportLatency = new Trend('report_latency');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    report_errors: ['rate<0.01'],
    report_latency: ['p(95)<10000'],
    http_req_duration: ['p(95)<15000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, {
    email: __ENV.TEST_EMAIL || 'loadtest@techfusion.dev',
    password: __ENV.TEST_PASSWORD || 'password123',
  });

  return { accessToken: loginRes.json('accessToken') };
}

export default function (data) {
  const token = data.accessToken;

  group('report generation', () => {
    const payload = {
      type: 'device_health',
      format: 'pdf',
      title: 'Load Test Report',
      sourceIds: JSON.stringify(['load-test-device-001']),
    };

    const res = http.post(`${BASE_URL}/reports/generate`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const ok = check(res, {
      'report generated': (r) => r.status === 201,
    });

    errorRate.add(!ok);
    reportLatency.add(res.timings.duration);
  });

  sleep(2 + Math.random() * 3);
}
