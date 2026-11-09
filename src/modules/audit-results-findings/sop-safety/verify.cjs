/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification harness. */
// All HTTP is mocked. Never reads .env, uses real sessions, or changes backend data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const zod = require('zod');
const root = process.cwd();
const feature = 'src/modules/audit-results-findings/sop-safety';
const cache = new Map();
const calls = [];
const env = {};
let role = 'ADMIN', sessionStatus = 200, grants = [], lastBody;
let handler = () => new Response('{}');
const token = 'mock-user-session';
const fileToken = 'mock-file-service-token';
const next = { NextResponse: class extends Response { static json(body, options) { return new Response(JSON.stringify(body), { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } }); } } };

function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(js, {
        exports, require: name => {
            if (name === 'zod') return zod;
            if (name === 'next/server') return next;
            if (name === 'server-only') return {};
            if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
            if (name === 'next/headers') return { cookies: async () => ({ get: () => ({ value: token }) }) };
            if (name === 'next/navigation') return { redirect: target => { throw new Error(`REDIRECT:${target}`); } };
            if (name === '@/lib/auth-utils') return { COOKIE_NAME: 'vos_access_token', decodeJwtPayload: () => ({ sub: '7', role, exp: Date.now() / 1000 + 3600 }) };
            if (name.endsWith('/server/image-processing')) return { normalizePhoto: async () => Buffer.from('normalized-image') };
            let target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
            if (!target) throw new Error(`Unexpected import ${name}`);
            if (!fs.existsSync(target)) target += '.ts';
            return load(target);
        },
        URL, URLSearchParams, JSON, Date, AbortSignal, Headers, Response, Request, File, Blob, FormData, Buffer,
        process: { env }, fetch: async (url, options = {}) => {
            const address = new URL(String(url), 'https://arf.example.test');
            calls.push({ url: address, options });
            if (address.origin === 'https://dummy.example.test') {
                assert.equal(options.headers.Authorization, `Bearer ${token}`);
                assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
                if (address.pathname === '/auth/me') return new Response('{}', { status: sessionStatus });
                if (address.pathname.includes('view-user-authorized-module')) return Response.json(grants);
            }
            return handler(address, options);
        },
    }, { filename: file });
    return exports;
}

const checklist = { id: 1, name: 'Warehouse SOP and Safety', description: 'SOP and safety compliance check of a warehouse', branchId: null, frequency: 'Weekly', maxGrade: 5, active: true, createdAt: '2026-11-04T10:19:59' };
// Verified draft header supplied by user. Populated grades/other DTOs below are simulated.
const audit = { id: 12, auditNo: 'SOP-000012', checklistId: 1, checklistName: checklist.name, branchId: 280, branchName: 'Alaminos - Bad Stock', area: null, auditDate: '2026-11-06', checkedBy: 370, status: 'Draft', maxGrade: 5, pointsEarned: null, pointsPossible: null, scorePercent: null, remarks: null, submittedAt: null, cancelledAt: null, cancelledBy: null, cancelReason: null, createdAt: '2026-11-06T12:53:26' };
const item = { id: 1, checklistId: 1, section: 'PPE', description: 'Staff wear the required safety shoes, gloves and vests', weight: 1, sortOrder: 10, active: true };
const detail = { audit, grades: [], itemsToGrade: [item] };
const uuid = '6e09eca0-37df-4e6e-a827-adac040c875a';
function req(method = 'GET', body, origin = 'https://arf.example.test', search = '') {
    const multipart = body instanceof FormData ? new Request('https://arf.example.test', { method: 'POST', body }) : null;
    const headers = new Headers(multipart?.headers ?? { 'content-type': 'application/json' }); headers.set('origin', origin);
    return { method, cookies: { get: () => ({ value: token }) }, nextUrl: { origin: 'https://arf.example.test', search }, headers, body: multipart?.body, text: async () => JSON.stringify(body), formData: async () => body };
}
const context = resource => ({ params: Promise.resolve({ path: resource.split('/') }) });

async function main() {
    const checklists = load(`${feature}/schemas/checklist.schema.ts`);
    assert.equal(checklists.sopChecklistListSchema.parse([checklist, { ...checklist, id: 2, active: false }]).length, 2);
    assert.equal(checklists.sopChecklistListSchema.safeParse({ data: [] }).success, false);
    assert.equal(checklists.sopChecklistDetailSchema.safeParse({ checklist, items: [item, item] }).success, false);
    assert.equal(checklists.sopChecklistDetailSchema.safeParse({ checklist, items: [{ ...item, checklistId: 9 }] }).success, false);
    const { groupChecklistItems } = load(`${feature}/utils/checklistUtils.ts`);
    const groups = groupChecklistItems([{ ...item, id: 2, section: 'Chemical Storage', sortOrder: 30 }, item]);
    assert.equal(groups[0].section, 'PPE'); assert.equal(groups[1].section, 'Chemical Storage');

    const responses = load(`${feature}/schemas/response.schema.ts`);
    assert.equal(responses.auditDetailSchema.safeParse(detail).success, true);
    assert.equal(responses.auditDetailSchema.safeParse({ ...detail, audit: { ...audit, status: 'Submitted', pointsEarned: 0, pointsPossible: 0, scorePercent: null }, itemsToGrade: [] }).success, true);
    const { auditQuestions, gradePayload } = load(`${feature}/utils/auditUtils.ts`);
    assert.equal(auditQuestions(detail)[0].saved, false);
    assert.equal(auditQuestions(detail)[0].grade, undefined);
    const saved = { ...detail, grades: [{ id: 9, itemId: 1, section: 'Old section', description: 'Frozen description', weight: 2, grade: null, remarks: '' }], itemsToGrade: [] };
    assert.equal(auditQuestions(saved)[0].grade, null);
    assert.equal(auditQuestions(saved)[0].description, 'Frozen description');
    assert.equal(gradePayload([{ itemId: 1, grade: 0 }, { itemId: 2, grade: null }], 5)[1].grade, null);
    assert.throws(() => gradePayload([{ itemId: 1, grade: 6 }], 5));
    assert.throws(() => gradePayload([{ itemId: 1, grade: 0 }, { itemId: 1, grade: null }], 5));
    assert.equal(responses.auditDetailSchema.safeParse({ ...saved, grades: [{ ...saved.grades[0], grade: 6 }] }).success, false);

    const writes = load(`${feature}/schemas/write.schema.ts`);
    const create = { checklistId: 1, branchId: 280, auditDate: '2026-11-06' };
    writes.validateSopWrite('audits', 'POST', create);
    for (const bad of [{ ...create, checkedBy: 999 }, { ...create, auditDate: '2026-02-30' }, { ...create, scorePercent: 100 }]) assert.throws(() => writes.validateSopWrite('audits', 'POST', bad));
    writes.validateSopWrite('audits/12/grades', 'PUT', [{ itemId: 1, grade: null }]);
    writes.validateSopWrite('items/1', 'PUT', { section: 'Chemical Storage', description: 'Labels', weight: 0, sortOrder: 1, active: true });
    const rule = { branchId: 280, frequency: 'Weekly', weekday: 7, startDate: '2026-11-09' };
    writes.validateSopWrite('schedule-rules', 'POST', rule);
    assert.throws(() => writes.validateSopWrite('schedule-rules', 'POST', { ...rule, weekday: 8 }));
    assert.throws(() => writes.validateSopWrite('schedule-rules', 'POST', { ...rule, dayOfMonth: 1 }));
    writes.validateSopWrite('schedule-rules', 'POST', { branchId: 280, frequency: 'Monthly', dayOfMonth: 28, startDate: '2026-11-09' });
    assert.throws(() => writes.validateSopWrite('schedule-rules', 'POST', { branchId: 280, frequency: 'Monthly', dayOfMonth: 29, startDate: '2026-11-09' }));
    assert.throws(() => writes.validateSopWrite('schedules', 'POST', { branchId: 280, scheduledDate: '2026-11-10', live_date: '2026-11-10' }));
    assert.throws(() => writes.validateSopWrite('audits/12/cancel', 'POST', { reason: ' ' }));

    const routes = load(`${feature}/server/routes.ts`);
    for (const [method, resource] of [['GET', 'kpi'], ['POST', 'audits/12/submit'], ['PUT', 'items/1'], ['POST', 'audits/12/attachments'], ['DELETE', 'attachments/2'], ['PUT', 'schedule-rules/1'], ['POST', 'schedules/1/cancel']]) assert.ok(routes.sopPath(resource.split('/'), method));
    for (const [method, resource] of [['GET', '../items/user'], ['POST', 'auth/login'], ['PUT', 'audits/0'], ['POST', 'kpi'], ['DELETE', 'checklists/1']]) assert.equal(routes.sopPath(resource.split('/'), method), null);
    assert.equal(routes.sopQuery('audits', new URLSearchParams()).get('pageSize'), '25');
    for (const input of ['page=0', 'url=evil', 'page=1&page=2', 'status=Bad', 'from=2026-02-30']) assert.throws(() => routes.sopQuery('audits', new URLSearchParams(input)));
    assert.throws(() => routes.sopQuery('schedules', new URLSearchParams('outcome=Expired')));

    const api = load('src/app/api/arf/sop-safety/[...path]/route.ts');
    assert.equal((await api.GET(req(), context('checklists'))).status, 503);
    assert.equal(calls.length, 0);
    env.SPRING_API_BASE_URL = 'https://dummy.example.test';
    const missing = req(); missing.cookies.get = () => undefined;
    assert.equal((await api.GET(missing, context('checklists'))).status, 401);
    assert.equal((await api.POST(req('POST', create, 'https://evil.test'), context('audits'))).status, 403);
    assert.equal((await api.POST(req('POST', { ...create, checkedBy: 99 }), context('audits'))).status, 400);
    sessionStatus = 401; assert.equal((await api.GET(req(), context('checklists'))).status, 401); sessionStatus = 200;
    role = 'USER'; grants = []; assert.equal((await api.GET(req(), context('checklists'))).status, 403);
    grants = [{ userId: 8, subsystemSlug: 'arf', basePath: '/arf/sop-safety' }]; assert.equal((await api.GET(req(), context('checklists'))).status, 403);
    grants = [{ userId: 7, subsystemSlug: 'arf', basePath: '/arf/sop-safety' }];
    assert.equal((await api.GET(req(), context('checklists'))).status, 403, 'Parent/folder access is not a role');
    grants = [{ userId: 7, subsystemSlug: 'arf', basePath: '/arf/sop-safety/viewer' }];
    assert.equal((await api.GET(req(), context('checklists'))).status, 200, 'Viewer has read access without planning mutation access');
    grants = [{ userId: 7, subsystemSlug: 'arf', basePath: '/arf/sop-safety/planner' }];
    handler = () => Response.json([checklist]);
    assert.equal((await (await api.GET(req(), context('checklists'))).json())[0].id, 1);
    role = 'ADMIN';
    handler = (_url, options) => { lastBody = options.body; return Response.json(detail, { status: 201 }); };
    const created = await api.POST(req('POST', create), context('audits'));
    assert.equal(created.status, 201); assert.equal((await created.json()).audit.id, 12);
    assert.equal(JSON.parse(lastBody).checkedBy, undefined);
    handler = () => Response.json({ message: 'Ungraded items remain' }, { status: 409 });
    const conflict = await api.POST(req('POST', {}), context('audits/12/submit'));
    assert.equal(conflict.status, 409); assert.equal((await conflict.json()).message, 'Ungraded items remain');
    handler = () => new Response('invalid body', { status: 502 });
    assert.match((await (await api.PUT(req('PUT', [{ itemId: 1, grade: 0 }]), context('audits/12/grades'))).json()).message, /may have succeeded/);
    handler = () => new Response(null, { status: 204 });
    assert.equal((await api.DELETE(req('DELETE'), context('audits/12'))).status, 204);

    // Business-role authorization is enforced before forwarding any protected operation.
    const permissions = load(`${feature}/permissions.ts`);
    assert.equal(permissions.sopRoles.join(','), 'PLANNER,INSPECTOR,VIEWER');
    assert.equal(fs.existsSync('src/app/(audit-results-findings)/arf/sop-safety/viewer/[[...section]]/page.tsx'), true);
    assert.equal(fs.existsSync('src/app/(audit-results-findings)/arf/sop-safety/viewer/audits/[id]/page.tsx'), true);
    assert.equal(permissions.rolesFromSopGrants([{ userId: 8, subsystemSlug: 'arf', basePath: '/arf/sop-safety/inspector' }], '7').length, 0);
    const setRoles = roles => { role = 'USER'; grants = roles.map(name => ({ userId: 7, subsystemSlug: 'arf', basePath: permissions.sopRolePaths[name] })); };
    const operationCalls = () => calls.filter(call => call.url.origin === 'https://dummy.example.test' && call.url.pathname.startsWith('/api/sop-safety/')).length;
    const cases = [
        ['POST', 'checklists', { name: 'Checklist', branchId: null, frequency: 'Weekly', maxGrade: 5, active: true }, 'PLANNER'],
        ['PUT', 'items/1', { section: 'PPE', description: 'Requirement', weight: 1, sortOrder: 10, active: true }, 'PLANNER'],
        ['POST', 'schedules', { branchId: 280, scheduledDate: '2030-12-10' }, 'PLANNER'],
        ['PUT', 'schedule-rules/1', { active: false }, 'PLANNER'],
        ['POST', 'audits', create, 'INSPECTOR'],
        ['PUT', 'audits/12/grades', [{ itemId: 1, grade: null }], 'INSPECTOR'],
        ['POST', 'audits/12/submit', {}, 'INSPECTOR'],
        ['POST', 'audits/12/cancel', { reason: 'Verification' }, 'INSPECTOR'],
        ['POST', 'corrective-actions/1/done', {}, 'INSPECTOR'],
        ['DELETE', 'attachments/3', undefined, 'INSPECTOR'],
    ];
    handler = () => Response.json({ confirmed: true });
    for (const assigned of ['PLANNER', 'INSPECTOR']) {
        setRoles([assigned]);
        for (const [method, resource, body, required] of cases) {
            const before = operationCalls();
            const response = await api[method](req(method, body), context(resource));
            assert.equal(response.status, required === assigned ? 200 : 403, `${assigned}: ${method} ${resource}`);
            assert.equal(operationCalls() - before, required === assigned ? 1 : 0, 'Denied operations never reach SOP');
        }
        assert.equal((await api.GET(req(), context('audits/12'))).status, 200, 'Both roles can review audit results');
        assert.equal((await api.GET(req(), context('kpi'))).status, 200, 'Both roles can read compliance performance');
        assert.equal((await api.GET(req(), context('corrective-actions'))).status, 200, 'Both roles can review findings');
        assert.equal((await api.GET(req(), context('schedules'))).status, 200);
    }
    setRoles(['PLANNER', 'INSPECTOR']);
    setRoles(['VIEWER']);
    handler = () => Response.json({ actions: [{ id: 1, description: 'Assigned finding', assignedTo: 7, status: 'Open' }], total: 1, page: 1, pageSize: 25 });
    assert.equal((await api.POST(req('POST', {}), context('corrective-actions/1/done'))).status, 200);
    assert.equal((await api.POST(req('POST', {}), context('corrective-actions/2/done'))).status, 403);
    assert.equal((await api.PUT(req('PUT', [{ itemId: 1, grade: 0 }]), context('audits/12/grades'))).status, 403);
    assert.equal((await api.POST(req('POST', create), context('audits'))).status, 403);
    handler = () => Response.json({ actions: [{ id: 1, description: 'Other user', assignedTo: 8, status: 'Open' }], total: 1, page: 1, pageSize: 25 });
    assert.equal((await api.POST(req('POST', {}), context('corrective-actions/1/cancel'))).status, 403);
    handler = () => Response.json({ actions: [{ id: 3, description: 'Unassigned finding', assignedTo: null, status: 'Open' }], total: 1, page: 1, pageSize: 25 });
    const beforeUnassigned = calls.length;
    assert.equal((await api.POST(req('POST', {}), context('corrective-actions/3/done'))).status, 200, 'Viewer may update an unassigned Open corrective action');
    const assignmentRead = calls.slice(beforeUnassigned).find(call => call.url.pathname === '/api/sop-safety/corrective-actions');
    assert.equal(assignmentRead.url.searchParams.get('status'), 'Open');
    assert.equal(assignmentRead.url.searchParams.has('assignedTo'), false, 'Server checks all Open actions, including unassigned actions');
    handler = () => Response.json({ confirmed: true });
    setRoles(['PLANNER', 'INSPECTOR']);
    const accessApi = load('src/app/api/arf/sop-safety/access/route.ts');
    const assignedAccess = await (await accessApi.GET(req())).json();
    assert.equal(assignedAccess.roles.join(','), 'PLANNER,INSPECTOR');
    assert.equal(assignedAccess.capabilities.inspect, true);
    assert.equal(assignedAccess.capabilities.managePlanning, true);
    assert.equal((await accessApi.GET(req('GET', undefined, 'https://arf.example.test', '?role=PLANNER'))).status, 400, 'Browser cannot select role grants');
    for (const [method, resource, body] of cases) assert.equal((await api[method](req(method, body), context(resource))).status, 200);
    const { SopRoleGate } = load(`${feature}/server/SopRoleGate.tsx`);
    setRoles(['VIEWER']);
    assert.equal(await SopRoleGate({ role: 'VIEWER', children: 'warehouse results' }), 'warehouse results');
    await assert.rejects(SopRoleGate({ role: 'INSPECTOR', children: 'grading' }), /REDIRECT:\/main-dashboard/);
    assert.equal(permissions.sopEntryPath(['VIEWER'], 'overview'), '/arf/sop-safety/viewer/overview');
    assert.equal(permissions.sopEntryPath(['VIEWER'], 'checklists'), null);
    setRoles(['INSPECTOR']);
    assert.equal(await SopRoleGate({ role: 'INSPECTOR', children: 'inspection view' }), 'inspection view');
    await assert.rejects(SopRoleGate({ role: 'PLANNER', children: 'private planning view' }), /REDIRECT:\/main-dashboard/);
    setRoles(['PLANNER']);
    assert.equal(await SopRoleGate({ role: 'PLANNER', children: 'planning view' }), 'planning view');
    await assert.rejects(SopRoleGate({ role: 'INSPECTOR', children: 'other role view' }), /REDIRECT:\/main-dashboard/);
    assert.equal(permissions.sopEntryPath(['PLANNER'], 'audits', 12), '/arf/sop-safety/planner/audits/12');
    assert.equal(permissions.sopEntryPath(['INSPECTOR'], 'overview'), '/arf/sop-safety/inspector/overview');
    assert.equal(permissions.sopEntryPath([], 'overview'), null);
    assert.equal(permissions.sopEntryPath(['PLANNER'], '../inspector'), null);
    const { SopEntryRedirect } = load(`${feature}/server/SopEntryRedirect.tsx`);
    await assert.rejects(SopEntryRedirect({ screen: 'audits', auditId: 12 }), /REDIRECT:\/arf\/sop-safety\/planner\/audits\/12/);
    setRoles(['PLANNER', 'INSPECTOR']);
    assert.equal(await SopRoleGate({ role: 'INSPECTOR', children: 'inspection view' }), 'inspection view');
    await assert.rejects(SopEntryRedirect({ screen: 'overview' }), /REDIRECT:\/arf\/sop-safety\/inspector\/overview/);
    sessionStatus = 401;
    await assert.rejects(SopRoleGate({ role: 'INSPECTOR', children: 'private view' }), /REDIRECT:\/login\?next=/);
    sessionStatus = 503;
    const unavailable = await SopRoleGate({ role: 'INSPECTOR', children: 'private view' });
    assert.equal(unavailable.props.role, 'alert');
    assert.equal(JSON.stringify(unavailable).includes('private view'), false);
    sessionStatus = 200;
    role = 'ADMIN';

    // Browser transport behavior, including uncertain writes and contract diagnostics.
    const client = load(`${feature}/services/sopClient.ts`);
    handler = () => Response.json({ message: 'Denied' }, { status: 403 });
    await assert.rejects(client.sopRequest('audits', { method: 'POST', body: create }), error => error.status === 403 && !error.uncertain);
    handler = () => { throw new Error('network unavailable'); };
    await assert.rejects(client.sopRequest('audits', { method: 'POST', body: create }), error => error.uncertain);
    assert.throws(() => client.parseSop(responses.auditDetailSchema, { unexpected: true }), error => error instanceof client.SopContractError && error.body.unexpected);

    // File membership and upload/link transaction behavior. No real image/file writes.
    env.NEXT_PUBLIC_API_BASE_URL = 'https://files.example.test'; env.DIRECTUS_STATIC_TOKEN = fileToken;
    const filesApi = load('src/app/api/arf/sop-safety/files/[auditId]/[fileId]/route.ts');
    const fileContext = fileId => ({ params: Promise.resolve({ auditId: '12', fileId }) });
    let cancelled = false, failLink = false;
    handler = (url, options) => {
        if (url.pathname === '/api/sop-safety/audits/12') return Response.json({ ...detail, audit: { ...audit, status: cancelled ? 'Cancelled' : 'Draft' } });
        if (url.pathname === '/api/sop-safety/audits/12/attachments') {
            if (options.method === 'POST') return Response.json({ message: 'Link rejected' }, { status: failLink ? 409 : 201 });
            return Response.json([{ id: 3, directusFileId: uuid, kind: 'Evidence', fileName: 'safe.jpg' }]);
        }
        assert.equal(url.origin, 'https://files.example.test');
        assert.equal(options.headers.Authorization, `Bearer ${fileToken}`);
        if (url.pathname === '/files') return Response.json({ data: { id: uuid } });
        return new Response('image bytes', { headers: { 'Content-Type': 'image/jpeg' } });
    };
    const noMembership = await filesApi.GET(req(), fileContext('99'));
    assert.equal(noMembership.status, 404);
    assert.equal((await filesApi.GET(req(), fileContext('3'))).headers.get('Content-Type'), 'image/jpeg');
    const multipart = new FormData(); multipart.set('file', new File(['pixels'], 'proof.png', { type: 'image/png' })); multipart.set('kind', 'Signature');
    setRoles(['PLANNER']);
    const beforeUpload = operationCalls();
    assert.equal((await filesApi.POST(req('POST', multipart), fileContext('upload'))).status, 403);
    assert.equal(operationCalls(), beforeUpload, 'Planner upload denied before audit/storage operations');
    assert.equal((await filesApi.GET(req(), fileContext('3'))).status, 200, 'Planner can view authorized evidence');
    role = 'ADMIN';
    multipart.set('gradeId', '999');
    assert.equal((await filesApi.POST(req('POST', multipart), fileContext('upload'))).status, 400);
    multipart.delete('gradeId');
    cancelled = true; assert.equal((await filesApi.POST(req('POST', multipart), fileContext('upload'))).status, 409); cancelled = false;
    failLink = true;
    const failed = await filesApi.POST(req('POST', multipart), fileContext('upload'));
    assert.equal(failed.status, 502); assert.match((await failed.json()).message, new RegExp(uuid));
    failLink = false;
    assert.equal((await filesApi.POST(req('POST', multipart), fileContext('upload'))).status, 200);
    assert.ok(calls.every(call => ['https://dummy.example.test', 'https://files.example.test', 'https://arf.example.test'].includes(call.url.origin)));
    console.log('SOP verification passed: schemas, N/A/zero, snapshots, route/query/write validation, auth, CSRF, errors, uncertainty, file membership and upload/link reconciliation. All HTTP mocked.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
