/* eslint-disable @typescript-eslint/no-require-imports -- Standalone file-route test with mocked network. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), zod = require('zod');
function load(file, imports, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { exports, require: name => { if (name in imports) return imports[name]; throw new Error(`Unexpected dependency ${name}`); }, Buffer, Blob, File, FormData, AbortSignal, Response, URL, ...globals });
    return exports;
}
const contracts = load(path.join(__dirname, 'contracts.ts'), { zod });
const workflow = load(path.join(__dirname, 'workflow.ts'), { zod, './contracts': contracts });
const uuid = '70f90cfa-02d1-4b73-8765-33175bb29eab';
let authorized = true, cancelled = false, rejectLink = false, calls = [], linkedKind;
const route = load(path.resolve(__dirname, '../../../../app/api/arf/housekeeping/files/[auditId]/[fileId]/route.ts'), {
    zod, 'next/server': { NextResponse: class extends Response { static json(body, options) { return new Response(JSON.stringify(body), options); } } },
    '@/lib/auth-utils': { COOKIE_NAME: 'session' },
    '@/modules/audit-results-findings/housekeeping/server/image-processing': { normalizePhoto: async () => Buffer.from('normalized-fixture') },
    '@/modules/audit-results-findings/housekeeping/spring/workflow': workflow,
}, { process: { env: { SPRING_API_BASE_URL: 'http://spring.test', NEXT_PUBLIC_API_BASE_URL: 'http://files.test', DIRECTUS_STATIC_TOKEN: 'file-fixture' } }, fetch: async (url, options) => {
    calls.push({ url, options });
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (url === 'http://spring.test/api/housekeeping/audits/1') { assert.equal(options.headers.Authorization, 'Bearer session-fixture'); return authorized ? json({ audit: { id: 1, auditNo: '5S-1', checklistId: 1, branchId: 190, auditDate: '2026-11-06', status: cancelled ? 'Cancelled' : 'Draft', maxGrade: 5 } }) : json({ message: 'Forbidden' }, 403); }
    if (url === 'http://spring.test/api/housekeeping/audits/1/attachments') {
        if (options.method === 'POST') { const body = JSON.parse(options.body); linkedKind = body.kind; assert.equal(body.directusFileId, uuid); assert.equal(body.mimeType, 'image/jpeg'); assert.equal(body.fileSize, Buffer.byteLength('normalized-fixture')); return json({}, rejectLink ? 409 : 201); }
        return json([{ id: 2, directusFileId: uuid, kind: 'Evidence', fileName: 'fixture.jpg', mimeType: 'image/jpeg', fileSize: 20 }]);
    }
    if (url === `http://files.test/assets/${uuid}`) { assert.equal(options.headers.Authorization, 'Bearer file-fixture'); return new Response('fixture', { headers: { 'content-type': 'image/jpeg' } }); }
    if (url === 'http://files.test/files') { assert.equal(options.headers.Authorization, 'Bearer file-fixture'); return json({ data: { id: uuid } }); }
    throw new Error(`Unexpected URL ${url}`);
} });
const request = (method = 'GET', token = true, origin = 'http://app.test', mime = 'image/png', kind = 'Evidence') => ({ method, cookies: { get: () => token ? { value: 'session-fixture' } : undefined }, nextUrl: new URL('http://app.test/'), headers: new Headers({ origin }), formData: async () => { const form = new FormData(); form.set('file', new File(['fixture'], 'my photo.png', { type: mime })); form.set('kind', kind); return form; } });
const context = fileId => ({ params: Promise.resolve({ auditId: '1', fileId }) });
(async () => {
    const security = load(path.resolve(__dirname, '../server/security.ts'), { zod });
    const normalizer = load(path.resolve(__dirname, '../server/image-processing.ts'), { 'server-only': {}, 'node:module': require('node:module'), 'node:path': path, './security': security }, { process });
    const appRequire = require('node:module').createRequire(path.join(process.cwd(), 'package.json'));
    const sharp = require('node:module').createRequire(appRequire.resolve('next/package.json'))('sharp');
    const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#518672' } }).png().toBuffer();
    const normalized = await normalizer.normalizePhoto(png);
    const metadata = await sharp(normalized).metadata();
    assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 32); assert.equal(metadata.exif, undefined);
    await assert.rejects(() => normalizer.normalizePhoto(Buffer.from('not an image')));
    assert.equal((await route.GET(request('GET', false), context('2'))).status, 401); assert.equal(calls.length, 0);
    authorized = false; assert.equal((await route.GET(request(), context('2'))).status, 403); assert.equal(calls.length, 1);
    authorized = true; calls = []; assert.equal((await route.GET(request(), context('3'))).status, 404); assert.ok(!calls.some(c => c.url.includes('/assets/')));
    const image = await route.GET(request(), context('2')); assert.equal(image.status, 200); assert.equal(image.headers.get('cache-control'), 'no-store'); assert.equal(await image.text(), 'fixture');
    calls = []; assert.equal((await route.POST(request('POST', true, 'http://evil.test'), context('upload'))).status, 403); assert.equal(calls.length, 0);
    cancelled = true; assert.equal((await route.POST(request('POST'), context('upload'))).status, 409); assert.ok(!calls.some(c => c.url === 'http://files.test/files'));
    cancelled = false; assert.equal((await route.POST(request('POST', true, 'http://app.test', 'image/svg+xml'), context('upload'))).status, 400);
    assert.equal((await route.POST(request('POST'), context('upload'))).status, 200);
    assert.equal(linkedKind, 'Evidence');
    assert.equal((await route.POST(request('POST', true, 'http://app.test', 'image/png', 'Signature'), context('upload'))).status, 200); assert.equal(linkedKind, 'Signature');
    assert.equal((await route.POST(request('POST', true, 'http://app.test', 'image/png', 'Unknown'), context('upload'))).status, 400);
    rejectLink = true; const orphan = await route.POST(request('POST'), context('upload')); assert.equal(orphan.status, 502); assert.match((await orphan.json()).message, new RegExp(uuid));
    console.log('PASS native Sharp PNG-to-JPEG/metadata stripping/invalid-image rejection; file route authentication, audit/attachment scope, no-store preview, CSRF, cancellation, MIME validation, upload/reference metadata and failed-link reconciliation. Mock network only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
