import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('remote_errors');
const remoteLatency = new Trend('remote_latency');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 30 },
    { duration: '2m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    remote_errors: ['rate<0.01'],
    remote_latency: ['p(95)<2000'],
    http_req_duration: ['p(95)<5000'],
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
  const deviceId = `load-device-${Math.floor(Math.random() * 500) + 1}`;

  group('remote support session lifecycle', () => {
    // Create session
    const createRes = http.post(
      `${BASE_URL}/remote-support/sessions`,
      JSON.stringify({ deviceId }),
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } },
    );

    check(createRes, {
      'session created': (r) => r.status === 201,
    });

    const sessionId = createRes.json('id');

    if (sessionId) {
      // Grant consent
      const consentRes = http.post(
        `${BASE_URL}/remote-support/consent`,
        JSON.stringify({ sessionId, deviceId, granted: true, method: 'click' }),
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer device-token-${deviceId}` } },
      );

      // End session
      const endRes = http.post(
        `${BASE_URL}/remote-support/sessions/${sessionId}/end`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } },
      );

      check(endRes, {
        'session ended': (r) => r.status === 201,
      });
    }

    remoteLatency.add(createRes.timings.duration);
    errorRate.add(!createRes);
  });

  sleep(1 + Math.random() * 2);
}
