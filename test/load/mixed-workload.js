import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('mixed_errors');
const allLatency = new Trend('all_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // ramp up
    { duration: '3m', target: 550 },   // surge: 500 devices + 50 techs
    { duration: '1m', target: 0 },     // ramp down
  ],
  thresholds: {
    mixed_errors: ['rate<0.005'],
    all_latency: ['p(95)<10000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const DEVICE_TOKENS = Array.from({ length: 50 }, (_, i) => `load-device-${String(i + 1).padStart(3, '0')}`);

export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, {
    email: __ENV.TEST_EMAIL || 'loadtest@techfusion.dev',
    password: __ENV.TEST_PASSWORD || 'password123',
  });
  return { accessToken: loginRes.json('accessToken') };
}

export default function (data) {
  const token = data.accessToken;
  const scenario = Math.random();

  let res;
  let ok;

  group('mixed workload', () => {
    if (scenario < 0.4) {
      // 40%: device telemetry
      const dt = DEVICE_TOKENS[Math.floor(Math.random() * DEVICE_TOKENS.length)];
      res = http.post(`${BASE_URL}/devices/metrics`, JSON.stringify({
        deviceToken: dt,
        cpuUsage: Math.random() * 100,
        ramUsed: Math.floor(Math.random() * 8 * 1024 * 1024 * 1024),
        ramTotal: 16 * 1024 * 1024 * 1024,
        ramPercent: Math.random() * 100,
        diskUsed: Math.floor(Math.random() * 500 * 1024 * 1024 * 1024),
        diskTotal: 1024 * 1024 * 1024 * 1024,
        networkRxBytes: Math.floor(Math.random() * 100000000),
        networkTxBytes: Math.floor(Math.random() * 50000000),
      }), { headers: { 'Content-Type': 'application/json' } });
      ok = check(res, { 'telemetry OK': (r) => r.status === 201 });

    } else if (scenario < 0.6) {
      // 20%: AI troubleshoot
      res = http.post(`${BASE_URL}/ai/troubleshoot`, JSON.stringify({
        message: 'Check device performance',
        deviceId: DEVICE_TOKENS[0],
      }), { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
      ok = check(res, { 'AI OK': (r) => r.status === 201 });

    } else if (scenario < 0.8) {
      // 20%: list devices / alerts (read operations)
      res = http.get(`${BASE_URL}/devices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      ok = check(res, { 'list devices OK': (r) => r.status === 200 });

    } else {
      // 20%: report generation + remote support
      const devId = DEVICE_TOKENS[Math.floor(Math.random() * DEVICE_TOKENS.length)];
      res = http.post(`${BASE_URL}/reports/generate`, JSON.stringify({
        type: 'fleet_summary', format: 'pdf', title: 'Mixed Load Report',
      }), { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
      ok = check(res, { 'report OK': (r) => r.status === 201 });
    }

    errorRate.add(!ok);
    if (res) allLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 0.5);
}
