import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '60s', target: 600 },
    { duration: '60s', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_APP = __ENV.APP_BASE || 'https://app.brandvx.io';
const BASE_API = __ENV.API_BASE || 'https://api.brandvx.io';

export default function () {
  const r1 = http.get(`${BASE_APP}/brandvx`);
  check(r1, { 'landing 200': (r) => r.status === 200 });
  const r2 = http.get(`${BASE_API}/ai/config`);
  check(r2, { 'ai config 200': (r) => r.status === 200 });
  const r3 = http.get(`${BASE_API}/integrations/redirects`);
  check(r3, { 'redirects 200': (r) => r.status === 200 });
  sleep(1);
}
