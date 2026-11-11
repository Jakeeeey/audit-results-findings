/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic Checker authorization/BFF regression harness. */
// No .env, credentials or live requests. All upstream state is isolated in this process.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), zod = require('zod');
const env = { SPRING_API_BASE_URL: 'http://spring.test' };
let actor = { userId: 7, isAdmin: false }, grants = [], sessionRejected = false, backendDeny = false, scopeMismatch = false, largeOpen = false;
const calls = [];
const warehouses = [{ id: 501, branch_name: 'Warehouse Alpha', branch_code: 'ALPHA', isActive: 1 }, { id: 777, branch_name: 'Warehouse Beta', branch_code: 'BETA', isActive: 1 }];
const audit = { id: 10, auditNo: '5S-000010', checklistId: 1, branchId: 501, branchName: 'Warehouse Alpha', auditDate: '2026-11-09', status: 'Submitted', maxGrade: 5, checkedBy: 20, pointsEarned: 0, pointsPossible: 5, scorePercent: 0 };
const action = { id: 30, auditId: 10, auditNo: audit.auditNo, branchId: 501, description: 'Clear the walkway', status: 'Open', gradeId: 1, assignedTo: 7, dueDate: '2026-01-01' };
const grade = { id: 1, itemId: 1, section: 'Sort', description: 'Aisles clear', weight: 1, grade: 0, remarks: 'Obstructed' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
async function upstream(url, init = {}) {
    const target = new URL(url); calls.push({ path: target.pathname, method: init.method || 'GET', query: target.search, body: init.body });
    assert.equal(init.headers.Authorization, 'Bearer fixture'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
    const q = target.searchParams;
    if (target.pathname === '/api/view-user-authorized-module/all') return response(grants);
    if (target.pathname === '/api/housekeeping/audits/10') return response({ audit, grades: [grade] });
    if (target.pathname === '/api/housekeeping/audits/10/corrective-actions') return response([action]);
    if (target.pathname === '/api/housekeeping/audits/10/attachments') return response([]);
    if (target.pathname === '/api/housekeeping/corrective-actions/30/done') { if (backendDeny) return response({ message: 'Backend denied' }, 403); action.status = 'Done'; return response({ id: 30 }); }
    if (target.pathname === '/api/bia/warehouse-kpi/housekeeping') return response({ branchIds: [501], from: q.get('from'), to: q.get('to'), audits: 1, pointsEarned: 0, pointsPossible: 5, scorePercent: 0, sections: ['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain'].map(section => ({ section, pointsEarned: 0, pointsPossible: 5, scorePercent: 0 })), weeks: [], schedule: { scheduled: 1, done: 1, doneLate: 0, missed: 0, due: 0, upcoming: 0, cancelled: 0, counted: 1, donePercent: 100 } });
    if (target.pathname === '/api/housekeeping/audits') return response({ audits: scopeMismatch ? [{ ...audit, branchId: 777 }] : [audit], total: 1, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) });
    if (target.pathname === '/api/housekeeping/corrective-actions') {
        const items = (!q.get('status') || q.get('status') === action.status) ? [action] : [];
        return response({ actions: items, total: largeOpen && q.get('status') === 'Open' ? 1001 : items.length, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) });
    }
    throw new Error(`Unexpected upstream request ${target.pathname}`);
}
const overrides = {
    'server-only': {}, zod,
    '@/lib/auth-utils': { COOKIE_NAME: 'session' },
    '../../server/security': { secureEndpoint: (base, route) => new URL(route, `${base}/`), verifySession: async token => { if (!token || sessionRejected) throw { status: 401, message: 'Session rejected' }; return actor; } },
    '../../server/queries': { readItems: async (collection, fields, filter) => { assert.equal(collection, 'branches'); assert.equal(filter.isActive._eq, 1); return warehouses; } },
};
const cache = new Map();
function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, process: { env }, Buffer, URL, URLSearchParams, Response, Headers, AbortSignal, console, fetch: upstream,
        require: name => name in overrides ? overrides[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : (() => { throw new Error(`Unexpected dependency ${name}`); })() }, { filename: file });
    return exports;
}
const permissions = load(path.join(__dirname, 'permissions.ts'));
const grant = (basePath, userId = 7) => ({ userId, subsystemSlug: 'arf', basePath, status: 'active' });
assert.deepEqual(Array.from(permissions.housekeepingRoles([grant('/arf/housekeeping/checker')], 7)), ['checker']);
assert.equal(permissions.housekeepingRoles([grant('/arf/housekeeping/checker', 8)], 7).length, 0);
assert.equal(permissions.housekeepingRoles([{ ...grant('/arf/housekeeping/checker'), status: 'inactive' }], 7).length, 0);
assert.equal(permissions.housekeepingRoles([grant('/arf/housekeeping/checker-other')], 7).length, 0);
assert.equal(permissions.housekeepingRoles([grant('/arf/housekeeping')], 7).includes('checker'), false);
const handler = load(path.join(__dirname, 'server/handler.ts')).handleCheckerRequest;
const req = (query = '', method = 'GET', body = {}, token = true, origin = 'http://app.test') => ({ method, nextUrl: new URL(`http://app.test/api?${query}`), headers: new Headers({ origin, 'content-type': 'application/json' }), cookies: { get: () => token ? { value: 'fixture' } : undefined }, text: async () => JSON.stringify(body) });
(async () => {
    assert.equal((await handler(req('', 'GET', {}, false), ['access'])).status, 401);
    assert.equal((await handler(req(), ['access'])).status, 403);
    grants = [grant('/arf/housekeeping/checker')];
    // Existing Checker permission is sufficient; no additional read-policy env.
    assert.equal((await handler(req(), ['access'])).status, 200);
    const access = await (await handler(req(), ['access'])).json(); assert.equal(access.canComplete, true); assert.deepEqual(access.warehouses.map(w => w.id), [501, 777]);
    assert.equal(access.commentsSupported, false); assert.equal(access.resolutionEvidenceSupported, false);
    assert.equal((await handler(req('branchId=999'), ['actions'])).status, 403);
    assert.equal((await handler(req('branchId=501&status=Draft'), ['audits'])).status, 403);
    assert.equal((await handler(req('branchId=501'), ['audits', '10'])).status, 200);
    assert.equal((await handler(req('branchId=777'), ['audits', '10'])).status, 403);
    audit.status = 'Draft'; assert.equal((await handler(req('branchId=501'), ['audits', '10'])).status, 403); audit.status = 'Submitted';
    scopeMismatch = true; assert.equal((await handler(req('branchId=501&page=1&pageSize=25'), ['audits'])).status, 503); scopeMismatch = false;
    const summary = await (await handler(req('branchId=501&from=2026-11-01&to=2026-11-30'), ['summary'])).json();
    assert.equal(summary.kpi.scorePercent, 0); assert.equal(summary.openActions, 1); assert.equal(summary.overdueActions, 1); assert.equal(summary.attention[0].id, 30);
    largeOpen = true; const large = await (await handler(req('branchId=501&from=2026-11-01&to=2026-11-30'), ['summary'])).json(); assert.equal(large.overdueActions, null); assert.equal(large.attentionComplete, false); largeOpen = false;
    action.assignedTo = 8;
    assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 501 }), ['actions', '30', 'done'])).status, 403);
    action.assignedTo = 7;
    assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 501 }, true, 'http://evil.test'), ['actions', '30', 'done'])).status, 403);
    assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 777 }), ['actions', '30', 'done'])).status, 403);
    assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 501 }), ['actions', '99', 'done'])).status, 403);
    backendDeny = true; assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 501 }), ['actions', '30', 'done'])).status, 403); assert.equal(action.status, 'Open'); backendDeny = false;
    const beforeScore = audit.scorePercent;
    const done = await handler(req('', 'POST', { auditId: 10, branchId: 501 }), ['actions', '30', 'done']); assert.equal(done.status, 200); assert.equal((await done.json()).action.status, 'Done'); assert.equal(audit.scorePercent, beforeScore);
    assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 501 }), ['actions', '30', 'done'])).status, 409);
    action.status = 'Open'; action.assignedTo = null;
    assert.equal((await handler(req('', 'POST', { auditId: 10, branchId: 501 }), ['actions', '30', 'done'])).status, 200);
    assert.equal((await handler(req('', 'POST', { message: 'Not supported' }), ['actions', '30', 'comments'])).status, 403);
    assert.equal(calls.some(c => /comments|history/.test(c.path)), false);
    sessionRejected = true; assert.equal((await handler(req(), ['access'])).status, 401);
    sessionRejected = false;
    overrides['next/headers'] = { cookies: async () => ({ get: () => ({ value: 'fixture' }) }) };
    overrides['next/server'] = { NextResponse: { json: Response.json } };
    overrides['./security'] = { ...overrides['../../server/security'], EvaluationError: class extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } } };
    overrides['./save-readiness'] = { saveReadiness: async () => { throw new Error('Legacy storage must not be checked for a Checker-only grant'); } };
    overrides['./configuration'] = { evaluationToken: () => { throw new Error('Legacy storage must not be read for a Checker-only grant'); } };
    const legacyQueries = load(path.resolve(__dirname, '../server/queries.ts'));
    await assert.rejects(() => legacyQueries.currentAccess(), cause => cause.status === 403);
    console.log('PASS Checker roles/warehouses without extra environment configuration, submitted scope, warehouse/assignment denial, assigned and unassigned completion, backend denial, CSRF/lifecycle, confirmed Done, unchanged score and disabled unsupported comments/history. Mock upstream only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
