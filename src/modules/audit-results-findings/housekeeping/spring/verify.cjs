/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification harness. */
// Local, deterministic checks. No network, credentials, database or test writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, globals = {}) {
    const fixtureModule = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { exports: fixtureModule.exports, module: fixtureModule, require: name => { if (name in imports) return imports[name]; throw new Error(`Unexpected dependency: ${name}`); }, URL, URLSearchParams, AbortSignal, Response, Headers, ...globals }, { filename: file });
    return fixtureModule.exports;
}
const routes = load(path.join(__dirname, 'routes.ts'));
const service = load(path.join(__dirname, 'service.ts'));
const naming = load(path.resolve(__dirname, '../paths.ts'));
assert.equal(naming.HOUSEKEEPING_ENTRY_ROOT, '/arf/evaluation-and-weekly-performance');
assert.equal(naming.canonicalHousekeepingPath('/arf/evaluation-and-weekly-performance/auditor'), '/arf/housekeeping/auditor');
assert.equal(naming.canonicalHousekeepingPath('/arf/evaluation-and-weekly-performance'), '/arf/housekeeping');
assert.equal(naming.canonicalHousekeepingPath('/arf/evaluation-and-weekly-performance-other/auditor'), '/arf/evaluation-and-weekly-performance-other/auditor');
assert.equal(naming.canonicalHousekeepingPath('/arf/sop-safety'), '/arf/sop-safety');
assert.equal(naming.canonicalHousekeepingPath('/arf/housekeeping/scheduler'), '/arf/housekeeping/scheduler');
const writes = load(path.join(__dirname, 'write-contracts.ts'), { zod: require('zod') });
const workflow = load(path.join(__dirname, 'workflow.ts'), { zod: require('zod'), './contracts': load(path.join(__dirname, 'contracts.ts'), { zod: require('zod') }) });
assert.equal(routes.springHousekeepingPath(['audits', '1', 'submit'], 'POST'), '/api/housekeeping/audits/1/submit');
assert.equal(routes.springHousekeepingPath(['audits', '1', 'submit'], 'PUT'), null);
assert.equal(routes.springHousekeepingPath(['kpi'], 'POST'), null);
assert.throws(() => writes.validateSpringWrite('audits', 'POST', { checklistId: 1, branchId: 190, auditDate: '2026-11-06', checkedBy: 99 }));
assert.throws(() => writes.validateSpringWrite('audits/1/cancel', 'POST', { reason: '' }));
assert.throws(() => writes.validateSpringWrite('schedule-rules', 'POST', { branchId: 190, frequency: 'Monthly', startDate: '2026-11-06', dayOfMonth: 31 }));
for (const weekday of [0, 6, 7]) assert.throws(() => writes.validateSpringWrite('schedule-rules', 'POST', { branchId: 190, frequency: 'Weekly', startDate: '2026-11-06', weekday }));
for (const weekday of [1, 2, 3, 4, 5]) assert.equal(writes.validateSpringWrite('schedule-rules', 'POST', { branchId: 190, frequency: 'Weekly', startDate: '2026-11-06', weekday, dayOfMonth: null }).weekday, weekday);
const weekdays = load(path.join(__dirname, 'weekdays.ts'));
assert.equal(weekdays.weeklyDayOptions.length, 5); assert.equal(weekdays.weekdayLabel(4), 'Thursday');
assert.equal(writes.validateSpringWrite('audits/1/grades', 'PUT', [{ itemId: 1, grade: 0 }])[0].grade, 0);
assert.equal(writes.validateSpringWrite('audits/1/grades', 'PUT', [{ itemId: 1, grade: null }])[0].grade, null);
const draftFixture = { audit: { id: 1, auditNo: '5S-000001', branchId: 190, checklistId: 1, auditDate: '2026-11-06', status: 'Draft', maxGrade: 5 }, grades: [{ id: 1, itemId: 1, section: 'Sort', description: 'Existing N/A', weight: 1, grade: null }], itemsToGrade: [{ id: 2, section: 'Shine', description: 'Unanswered', weight: 1 }] };
const edited = workflow.editableItems(workflow.auditDetail.parse(draftFixture));
assert.equal(edited[0].answered, true); assert.equal(edited[0].grade, null); assert.equal(edited[1].answered, false);
const contracts = load(path.join(__dirname, 'contracts.ts'), { zod: require('zod') });
assert.deepEqual(Array.from(contracts.dummyWarehouses, w => w.id), [190, 194, 196, 278]);
const checklist = { id: 1, name: 'Warehouse 5S', description: 'Weekly 5S check of a warehouse', branchId: null,
    frequency: 'Weekly', maxGrade: 5, active: true, createdAt: '2026-11-04T10:19:59' };
assert.ok(contracts.springChecklistListSchema.safeParse([checklist]).success);
const item = { id: 1, checklistId: 1, section: 'Sort', description: 'Keep necessary items', weight: 1, sortOrder: 10, active: true };
assert.ok(contracts.springChecklistDetailSchema.safeParse({ checklist, items: [item] }).success);
assert.ok(!contracts.springChecklistDetailSchema.safeParse({ checklist, items: [item, item] }).success);
assert.ok(!contracts.springChecklistDetailSchema.safeParse({ checklist, items: [{ ...item, checklistId: 2 }] }).success);
assert.ok(!contracts.springChecklistDetailSchema.safeParse({ checklist, items: [{ ...item, weight: -1 }] }).success);
assert.ok(!contracts.springChecklistDetailSchema.safeParse({ checklist, items: [{ ...item, section: 'Other' }] }).success);
assert.ok(!contracts.springChecklistListSchema.safeParse([{ ...checklist, active: 'true' }]).success);
assert.ok(contracts.springAuditPageSchema.safeParse({ audits: [], total: 0, page: 1, pageSize: 25 }).success);
assert.ok(!contracts.springAuditPageSchema.safeParse({ data: [], total: 0, page: 1, pageSize: 25 }).success);
const emptyKpi = { branchIds: [190], from: '2026-11-01', to: '2026-11-09', audits: 0,
    pointsEarned: 0, pointsPossible: 0, scorePercent: null, sections: ['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain'].map(section => ({ section, pointsEarned: 0, pointsPossible: 0, scorePercent: null })),
    weeks: [], schedule: { scheduled: 0, done: 0, doneLate: 0, missed: 0, due: 0, upcoming: 0, cancelled: 0, counted: 0, donePercent: null } };
assert.equal(contracts.springKpiSchema.parse(emptyKpi).scorePercent, null);
assert.equal(contracts.springKpiSchema.parse({ ...emptyKpi, scorePercent: 0 }).scorePercent, 0);
assert.ok(!contracts.springKpiSchema.safeParse({ ...emptyKpi, scorePercent: 101 }).success);
assert.match(contracts.validateSpringResponse('audits', {}), /does not match/);
assert.match(contracts.validateSpringResponse('audits', { audits: [], total: 0, page: 1, pageSize: 25 }), /individual record fields remain unverified/);
assert.equal(routes.springHousekeepingPath(['audits', '12', 'attachments']), '/api/housekeeping/audits/12/attachments');
assert.equal(routes.springHousekeepingPath(['kpi']), '/api/bia/warehouse-kpi/housekeeping');
assert.equal(routes.springHousekeepingPath(['checklists', '1']), '/api/housekeeping/checklists/1');
for (const value of ['../auth', 'audits/0', 'audits/12/submit', 'http://evil', 'checklists/1/items']) assert.equal(routes.springHousekeepingPath(value.split('/')), null);
for (const query of ['from=2026-02-30', 'page=0', 'pageSize=101', 'branchId=1&branchId=2', 'token=secret', 'from=2026-12-01&to=2026-11-01']) assert.throws(() => routes.springHousekeepingQuery('audits', new URLSearchParams(query)));
assert.equal(routes.springHousekeepingQuery('audits', new URLSearchParams('branchId=174&page=1')).toString(), 'branchId=174&page=1');
const grades = service.springGradePayload([{ itemId: 1, grade: 0 }, { itemId: 2, grade: null }], 5);
assert.equal(grades.length, 2); assert.equal(grades[0].grade, 0); assert.equal(grades[1].grade, null);
assert.equal(service.springGradePayload([], 5).length, 0);
assert.throws(() => service.springGradePayload([{ itemId: 1, grade: undefined }], 5));
assert.throws(() => service.springGradePayload([{ itemId: 1, grade: 6 }], 5));
assert.throws(() => service.springGradePayload([{ itemId: 1, grade: 1 }, { itemId: 1, grade: 2 }], 5));

(async () => {
    const retired = load(path.resolve(__dirname, '../archive/retired-write.ts'));
    for (const mode of ['auditor', 'scheduler']) {
        const entry = load(path.resolve(`src/app/(audit-results-findings)/arf/evaluation-and-weekly-performance/${mode}/page.tsx`), {
            'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
            '@/modules/audit-results-findings/housekeeping/HousekeepingEntry': { HousekeepingEntry: 'canonical-entry' },
        });
        assert.equal(entry.default().type, 'canonical-entry'); assert.equal(entry.default().props.mode, mode);
    }
    const forwards = [];
    const handler = name => async (req, context) => { forwards.push(name); return Response.json({ name, params: context ? await context.params : null }, { status: name === 'me' ? 401 : 200 }); };
    const legacy = load(path.resolve('src/app/api/arf/evaluation-and-weekly-performance/[...path]/route.ts'), {
        '@/app/api/arf/housekeeping/me/route': { GET: handler('me') },
        '@/app/api/arf/housekeeping/warehouses/route': { GET: handler('warehouses') },
        '@/app/api/arf/housekeeping/schedules/route': { GET: handler('schedules') },
        '@/app/api/arf/housekeeping/schedules/[id]/route': { GET: handler('detail') },
        '@/app/api/arf/housekeeping/schedules/[id]/evidence/[evidenceId]/route': { GET: handler('evidence') },
        '@/app/api/arf/housekeeping/recurrences/route': { GET: handler('recurrences') },
        '@/modules/audit-results-findings/housekeeping/archive/retired-write': retired,
    });
    const legacyContext = path => ({ params: Promise.resolve({ path }) });
    assert.equal((await legacy.GET({}, legacyContext(['me']))).status, 401);
    const forwarded = await legacy.GET({}, legacyContext(['schedules', '17', 'evidence', '2']));
    assert.deepEqual((await forwarded.json()).params, { id: '17', evidenceId: '2' });
    assert.equal((await legacy.GET({}, legacyContext(['unlisted']))).status, 404);
    assert.equal((await legacy.POST()).status, 410); assert.equal((await legacy.PATCH()).status, 410);
    assert.deepEqual(forwards, ['me', 'evidence']);
    const archiveWrite = await retired.retiredEvaluationWrite();
    assert.equal(archiveWrite.status, 410); assert.equal((await archiveWrite.json()).error.code, 'ARCHIVE_READ_ONLY');
    let calls = 0, nextStatus = 200, json = { content: [{ id: 1 }] }, redirect = false;
    const route = load(path.resolve(__dirname, '../../../../app/api/arf/housekeeping/spring/[...path]/route.ts'), {
        'next/server': { NextResponse: class extends Response { static json(body, options) { return new Response(JSON.stringify(body), options); } } },
        '@/lib/auth-utils': { COOKIE_NAME: 'session' },
        '@/modules/audit-results-findings/housekeeping/spring/routes': routes,
        '@/modules/audit-results-findings/housekeeping/spring/write-contracts': writes,
    }, { process: { env: { SPRING_API_BASE_URL: 'http://dummy.test' } }, fetch: async (url, options) => {
        calls++;
        assert.equal(url.origin, 'http://dummy.test');
        assert.equal(options.headers.Authorization, 'Bearer fixture');
        assert.equal(options.redirect, 'manual');
        return new Response(redirect ? 'not json' : JSON.stringify(json), { status: nextStatus });
    } });
    const request = (token = true, query = '', method = 'GET', origin = 'http://app.test', body = {}) => ({ method, headers: new Headers({ origin, 'content-type': 'application/json' }), text: async () => JSON.stringify(body), cookies: { get: () => token ? { value: 'fixture' } : undefined }, nextUrl: new URL(`http://app.test/${query}`) });
    const context = parts => ({ params: Promise.resolve({ path: parts }) });
    assert.equal((await route.GET(request(false), context(['audits']))).status, 401); assert.equal(calls, 0);
    assert.equal((await route.GET(request(), context(['auth']))).status, 404); assert.equal(calls, 0);
    assert.equal((await route.GET(request(true, '?page=0'), context(['audits']))).status, 400); assert.equal(calls, 0);
    const ok = await route.GET(request(), context(['audits']));
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await ok.json(), json);
    assert.equal((await route.POST(request(true, '', 'POST', 'http://evil.test'), context(['audits']))).status, 403);
    assert.equal((await route.POST(request(true, '', 'POST', 'http://app.test', { branchId: 190 }), context(['audits']))).status, 400);
    assert.equal((await route.POST(request(true, '', 'POST', 'http://app.test', { branchId: 190, checklistId: 1, auditDate: '2026-11-06' }), context(['audits']))).status, 200);
    for (const status of [401, 403, 404, 409]) { nextStatus = status; json = { message: 'Fixture conflict' }; assert.equal((await route.GET(request(), context(['audits']))).status, status); }
    nextStatus = 302; assert.equal((await route.GET(request(), context(['audits']))).status, 502);
    nextStatus = 200; redirect = true; assert.equal((await route.GET(request(), context(['audits']))).status, 502);
    console.log('PASS route allowlist, query validation, missing vs N/A/zero, auth forwarding, no-store, response preservation, upstream errors and redirects');
})().catch(error => { console.error(error); process.exitCode = 1; });
