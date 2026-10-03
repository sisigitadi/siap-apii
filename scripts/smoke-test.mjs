/**
 * Utilitas Smoke Testing Post-Deployment untuk SIAP APII
 *
 * Pemakaian:
 *   node scripts/smoke-test.mjs https://apii.sigitadi.id
 *   node scripts/smoke-test.mjs http://localhost:3000
 */

const targetHost = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');

console.log(`\n🔍 Memulai Smoke Test SIAP APII pada target: ${targetHost}\n`);

const checks = [
  {
    name: '1. OpenAPI Swagger UI Endpoint',
    path: '/api/v1/docs',
    expectedStatus: 200,
    validate: (res, body) => typeof body === 'string' && body.includes('swagger-ui'),
  },
  {
    name: '2. Public Portal Feed Endpoint',
    path: '/api/v1/public/feed',
    expectedStatus: 200,
    validate: (res, body) => {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      return json.success === true && json.code === 200 && Array.isArray(json.data?.items);
    },
  },
  {
    name: '3. Public Kajian & Event Schedule Endpoint',
    path: '/api/v1/public/schedules',
    expectedStatus: 200,
    validate: (res, body) => {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      return json.success === true && json.code === 200 && Array.isArray(json.data?.items);
    },
  },
  {
    name: '4. Public Document SHA-256 Verification Endpoint',
    path: '/api/v1/public/verify/0000000000000000000000000000000000000000000000000000000000000000',
    expectedStatus: 200,
    validate: (res, body) => {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      return json.success === true && json.code === 200 && json.data?.verified === false;
    },
  },
  {
    name: '5. Guard Otentikasi (/api/v1/auth/me tanpa token)',
    path: '/api/v1/auth/me',
    expectedStatus: 401,
    validate: (res, body) => {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      return json.success === false && json.code === 401;
    },
  },
];

let passed = 0;
let failed = 0;

for (const check of checks) {
  const url = `${targetHost}${check.path}`;
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    const isStatusOk = response.status === check.expectedStatus;
    const isBodyValid = check.validate(response, body);

    if (isStatusOk && isBodyValid) {
      console.log(`  ✅ [PASS] ${check.name} (${response.status})`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${check.name} -> HTTP ${response.status} (diharapkan ${check.expectedStatus})`);
      failed++;
    }
  } catch (err) {
    console.error(`  ❌ [ERROR] ${check.name} -> ${err.message}`);
    failed++;
  }
}

console.log(`\n========================================`);
console.log(`Hasil Smoke Test: ${passed} Lolos, ${failed} Gagal`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
