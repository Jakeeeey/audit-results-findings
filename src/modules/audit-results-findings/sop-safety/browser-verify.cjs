/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated browser harness. */
// Simulated DTOs only. Never reads .env or contacts Dummy/Live.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const tools = process.env.SOP_TEST_TOOLS || '/tmp/opencode/sop-test-tools/node_modules';
const toolRequire = require('node:module').createRequire(path.join(tools, '../package.json'));
const { build } = require(path.join(tools, 'esbuild'));
const { chromium } = require(path.join(tools, 'playwright'));
const root = process.cwd();
const checklist = { id: 1, name: 'Warehouse SOP and Safety', description: 'Simulated browser fixture', branchId: null, frequency: 'Weekly', maxGrade: 5, active: true, createdAt: '2026-11-04T10:19:59' };
const items = ['PPE', 'Fire Safety', 'Chemical Storage'].map((section, index) => ({ id: index + 1, checklistId: 1, section, description: `${section} requirement`, weight: index + 1, sortOrder: index * 10, active: true }));
const audits = [], grades = [], actions = [], files = [], rules = [], mutations = [], reads = [];
const schedules = [
    { id: 1, branchId: 280, branchName: 'Alaminos - Bad Stock', scheduledDate: '2026-11-09', ruleId: null, originalDate: null, status: 'Scheduled', auditId: null, auditNo: null, outcome: 'Due', cancelReason: null },
    { id: 2, branchId: 280, branchName: 'Alaminos - Bad Stock', scheduledDate: '2030-12-01', ruleId: null, originalDate: null, status: 'Scheduled', auditId: null, auditNo: null, outcome: 'Done', cancelReason: null },
    { id: 3, branchId: 280, branchName: 'Alaminos - Bad Stock', scheduledDate: '2030-12-02', ruleId: null, originalDate: null, status: 'Cancelled', auditId: null, auditNo: null, outcome: 'Cancelled', cancelReason: 'Fixture cancellation' },
    { id: 4, branchId: 280, branchName: 'Alaminos - Bad Stock', scheduledDate: '2030-12-07', ruleId: null, originalDate: null, status: 'Scheduled', auditId: null, auditNo: null, outcome: 'Upcoming', cancelReason: null },
];
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let nextId = 12, denyAudits = false;
let assignedRoles = ['PLANNER', 'INSPECTOR'];
const details = audit => ({ audit, grades: grades.filter(grade => grade.auditId === audit.id), itemsToGrade: audit.status === 'Draft' ? items.filter(item => !grades.some(grade => grade.auditId === audit.id && grade.itemId === item.id)) : [] });
const pageOf = (key, rows) => ({ [key]: rows, total: rows.length, page: 1, pageSize: 25 });

async function main() {
    const css = await toolRequire('postcss')([toolRequire('@tailwindcss/postcss')({ base: root })]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.join(root, 'src/app/globals.css') });
    const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import SopSafetyModule from './src/modules/audit-results-findings/sop-safety/SopSafetyModule';
        import {AuditDetailModule} from './src/modules/audit-results-findings/sop-safety/AuditDetailModule';
        import {SopAccessProvider} from './src/modules/audit-results-findings/sop-safety/components/SopAccessProvider';
        const match=location.pathname.match(/audits\\/(\\d+)$/);
        const workspace=location.pathname.includes('/planner')?'PLANNER':'INSPECTOR';
        const last=location.pathname.split('/').at(-1);
        const tab=['overview','audits','checklists','corrective-actions','schedules'].includes(last)?last:workspace==='PLANNER'?'checklists':'audits';
        createRoot(document.getElementById('root')).render(<SopAccessProvider>{match?<AuditDetailModule id={Number(match[1])} workspace={workspace} readOnly={workspace==='PLANNER'}/>:<SopSafetyModule initialTab={tab} workspace={workspace}/>}</SopAccessProvider>);`, resolveDir: root, loader: 'tsx', sourcefile: 'sop-browser-test.tsx' }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, tsconfig: path.join(root, 'tsconfig.json'), plugins: [{ name: 'next-test-navigation', setup(builder) {
        builder.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'next-stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'next-stub' }, args => ({ loader: 'tsx', resolveDir: root, contents: args.path === 'next/link' ? `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}` : `export const useRouter=()=>({push:p=>location.assign(p),replace:p=>location.replace(p)});` }));
    } }] });
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://test');
        const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (url.pathname === '/bundle.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(bundle.outputFiles[0].contents); }
        if (url.pathname === '/style.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(css.css); }
        if (!url.pathname.startsWith('/api/')) {
            // Mirror the separately unit-tested shared-entry redirect for this isolated server.
            if (/^\/arf\/sop-safety\/viewer(?:\/|$)/.test(url.pathname)) { res.writeHead(404); return res.end('Not found'); }
            if (url.pathname.startsWith('/arf/sop-safety') && !/^\/arf\/sop-safety\/(planner|inspector)(?:\/|$)/.test(url.pathname)) {
                const role = assignedRoles.includes('INSPECTOR') ? 'inspector' : 'planner';
                const suffix = url.pathname.slice('/arf/sop-safety'.length).replace(/^\//, '') || 'overview';
                res.writeHead(302, { Location: `/arf/sop-safety/${role}/${suffix}` }); return res.end();
            }
            res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root" style="padding:16px"></div><script>globalThis.process={env:{}}</script><script src="/bundle.js"></script></body></html>');
        }
        if (url.pathname === '/api/arf/inventory-audit') return send({ data: [{ id: 280, branch_name: 'Alaminos - Bad Stock' }] });
        if (url.pathname === '/api/shortage/inventory') return send({ data: [{ user_id: 370, user_fname: 'Test', user_lname: 'Auditor' }] });
        const resource = url.pathname.replace('/api/arf/sop-safety/', '');
        if (req.method === 'GET' && /^files\/\d+\/\d+$/.test(resource)) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(imageBytes); }
        if (req.method === 'POST' && /^files\/\d+\/upload$/.test(resource)) {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type'] } }).formData();
            const file = form.get('file');
            const metadata = { kind: form.get('kind'), ...(form.has('gradeId') ? { gradeId: Number(form.get('gradeId')) } : {}), ...(form.has('correctiveActionId') ? { correctiveActionId: Number(form.get('correctiveActionId')) } : {}), fileName: file.name, mimeType: file.type, fileSize: file.size };
            mutations.push({ resource, method: req.method, body: metadata });
            files.push({ id: nextId++, directusFileId: '6e09eca0-37df-4e6e-a827-adac040c875a', ...metadata });
            return send({ success: true });
        }
        let text = ''; for await (const chunk of req) text += chunk;
        const body = text ? JSON.parse(text) : {};
        const auditId = Number(resource.split('/')[1]);
        const audit = audits.find(row => row.id === auditId);
        if (req.method !== 'GET') mutations.push({ resource, method: req.method, body });
        if (req.method === 'GET') {
            reads.push({ resource, query: Object.fromEntries(url.searchParams) });
            if (resource === 'access') return send({ roles: assignedRoles });
            if (resource === 'checklists') return send([checklist]);
            if (resource === 'checklists/1') return send({ checklist, items });
            if (resource === 'audits') return denyAudits ? send({ message: 'SOP permission denied' }, 403) : send(pageOf('audits', audits.filter(row => !url.searchParams.has('status') || row.status === url.searchParams.get('status'))));
            if (/^audits\/\d+$/.test(resource)) return send(details(audit));
            if (/^audits\/\d+\/corrective-actions$/.test(resource)) return send(actions.filter(row => row.auditId === auditId));
            if (/^audits\/\d+\/attachments$/.test(resource)) return send(files);
            if (resource === 'corrective-actions') return send(pageOf('actions', actions.filter(row => !url.searchParams.has('status') || row.status === url.searchParams.get('status'))));
            if (resource === 'schedules') return send(pageOf('schedules', schedules.filter(row => (!url.searchParams.has('outcome') || row.outcome === url.searchParams.get('outcome')) && (!url.searchParams.has('branchId') || row.branchId === Number(url.searchParams.get('branchId'))))));
            if (resource === 'schedule-rules') return send(rules);
            if (resource === 'kpi') {
                const submitted = audits.filter(row => row.status === 'Submitted');
                const sectionRows = items.map(item => {
                    const applicable = grades.filter(grade => submitted.some(audit => audit.id === grade.auditId) && grade.section === item.section && grade.grade !== null);
                    const earned = applicable.reduce((sum, grade) => sum + grade.grade * grade.weight, 0);
                    const possible = applicable.reduce((sum, grade) => sum + 5 * grade.weight, 0);
                    return { section: item.section, pointsEarned: earned, pointsPossible: possible, scorePercent: possible ? earned / possible * 100 : null };
                });
                const earned = submitted.reduce((sum, audit) => sum + audit.pointsEarned, 0), possible = submitted.reduce((sum, audit) => sum + audit.pointsPossible, 0);
                return send({ audits: submitted.length, pointsEarned: earned, pointsPossible: possible, scorePercent: possible ? earned / possible * 100 : null, sections: sectionRows });
            }
        }
        if (resource === 'audits' && req.method === 'POST') { const created = { id: nextId++, auditNo: `SOP-${nextId}`, ...body, checklistName: checklist.name, branchName: 'Alaminos - Bad Stock', area: body.area || null, remarks: body.remarks || null, checkedBy: 370, status: 'Draft', maxGrade: 5, pointsEarned: null, pointsPossible: null, scorePercent: null, submittedAt: null, cancelledAt: null, cancelledBy: null, cancelReason: null, createdAt: '2026-11-06T12:53:26' }; audits.push(created); return send(details(created), 201); }
        if (/^audits\/\d+\/grades$/.test(resource)) { for (const answer of body) { const existing = grades.find(grade => grade.auditId === auditId && grade.itemId === answer.itemId); if (existing) Object.assign(existing, answer); else { const item = items.find(row => row.id === answer.itemId); grades.push({ ...item, ...answer, id: nextId++, auditId, itemId: item.id }); } } return send(details(audit)); }
        if (resource.endsWith('/submit')) { if (details(audit).itemsToGrade.length) return send({ message: 'Ungraded items' }, 409); audit.status = 'Submitted'; const applicable = grades.filter(grade => grade.auditId === auditId && grade.grade !== null); audit.pointsEarned = applicable.reduce((sum, grade) => sum + grade.grade * grade.weight, 0); audit.pointsPossible = applicable.reduce((sum, grade) => sum + audit.maxGrade * grade.weight, 0); audit.scorePercent = audit.pointsPossible ? audit.pointsEarned / audit.pointsPossible * 100 : null; audit.submittedAt = '2026-11-06T13:00:00'; return send(details(audit)); }
        if (resource.endsWith('/cancel') && resource.startsWith('audits/')) { audit.status = 'Cancelled'; audit.cancelReason = body.reason; return send(details(audit)); }
        if (/^audits\/\d+\/corrective-actions$/.test(resource)) { actions.push({ id: nextId++, auditId, auditNo: audit.auditNo, branchName: audit.branchName, ...body, status: 'Open' }); return send(actions.at(-1), 201); }
        if (/^corrective-actions\/\d+\/(done|cancel)$/.test(resource)) { actions.find(row => row.id === auditId).status = resource.endsWith('/done') ? 'Done' : 'Cancelled'; return send({ success: true }); }
        if (/^audits\/\d+\/attachments$/.test(resource)) { files.push({ id: nextId++, ...body }); return send(files.at(-1), 201); }
        if (resource === 'schedule-rules') { rules.push({ id: nextId++, ...body, active: true }); return send(rules.at(-1), 201); }
        if (/^schedule-rules\/\d+$/.test(resource)) { Object.assign(rules.find(row => row.id === auditId), body); return send({ success: true }); }
        if (resource === 'schedules') { if (schedules.some(row => row.scheduledDate === body.scheduledDate)) return send({ message: 'Date clash' }, 409); schedules.push({ id: nextId++, ...body, branchName: 'Alaminos - Bad Stock', ruleId: null, originalDate: null, status: 'Scheduled', auditId: null, outcome: 'Upcoming' }); return send(schedules.at(-1), 201); }
        if (/^schedules\/\d+$/.test(resource) && req.method === 'PUT') { Object.assign(schedules.find(row => row.id === auditId), body); return send({ success: true }); }
        if (/^schedules\/\d+\/cancel$/.test(resource)) { Object.assign(schedules.find(row => row.id === auditId), { status: 'Cancelled', outcome: 'Cancelled', cancelReason: body.reason }); return send({ success: true }); }
        if (resource === 'checklists/1/items') { items.push({ id: nextId++, checklistId: 1, ...body }); return send(items.at(-1), 201); }
        if (resource === 'checklists/1') { Object.assign(checklist, body); return send(checklist); }
        if (/^items\/\d+$/.test(resource) && req.method === 'PUT') { Object.assign(items.find(item => item.id === auditId), body); return send({ success: true }); }
        return send({ message: `Unhandled fixture: ${req.method} ${resource}` }, 500);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const base = `http://127.0.0.1:${server.address().port}`;
        const select = async (name, option) => { await page.getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); };
        const confirm = () => page.getByRole('button', { name: 'Confirm', exact: true }).click();
        const rate = (description, value) => page.getByRole('group', { name: `Grade: ${description}`, exact: true }).getByRole('button', { name: value, exact: true }).click();
        const sectionResult = () => page.getByText('Chemical Storage', { exact: true }).waitFor();
        const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'No horizontal page overflow');
        await page.goto(`${base}/arf/sop-safety/planner/checklists`);
        await page.getByRole('button', { name: 'View Warehouse SOP and Safety' }).click();
        await page.getByText('Chemical Storage requirement', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'New audit' }).count(), 0, 'Planner workspace has no inspection controls');
        assert.equal(await page.getByRole('navigation', { name: 'SOP role workspaces' }).count(), 0, 'No cross-role view switcher');
        assert.equal(await page.getByRole('link', { name: 'Inspector', exact: true }).count(), 0);
        await page.goto(`${base}/arf/sop-safety/inspector`);
        await page.getByRole('button', { name: 'New audit' }).click();
        await select('Checklist *', 'Warehouse SOP and Safety');
        await select('Warehouse *', 'Alaminos - Bad Stock');
        await page.getByRole('button', { name: 'Create draft', exact: true }).click();
        await page.getByRole('link', { name: 'Open grading workspace' }).click();
        await page.getByRole('button', { name: 'Save draft', exact: true }).waitFor();
        await page.getByText('Not yet submitted', { exact: true }).waitFor();
        await page.goto(`${base}/arf/sop-safety/planner/audits/12`);
        await page.getByText('Read-only view. Inspector access is required to change audit records.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Cancel audit', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Add action', exact: true }).count(), 0);
        assert.equal(await page.locator('input[type=file]').count(), 0, 'Planner audit results stay read-only for a multi-role user');
        await page.goto(`${base}/arf/sop-safety/inspector/audits/12`);
        const ppe = page.getByRole('group', { name: 'Grade: PPE requirement', exact: true });
        await ppe.getByRole('button', { name: '0', exact: true }).focus(); await page.keyboard.press('Space');
        assert.equal(await ppe.getByRole('button', { name: '0', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByRole('progressbar', { name: 'Saved checklist completion' }).getAttribute('aria-valuenow'), '0', 'Unsaved choices do not advance official progress');
        assert.equal(await page.getByRole('combobox', { name: 'Grade: PPE requirement' }).count(), 0);
        await page.locator('section[aria-label="PPE criteria"]').getByRole('button', { name: 'Add remark', exact: true }).click();
        await page.getByLabel('Remark for PPE requirement').fill('Observed PPE issue');
        await page.locator('section[aria-label="PPE criteria"]').getByRole('button', { name: 'Hide remark', exact: true }).click();
        assert.equal(await page.getByLabel('Remark for PPE requirement').inputValue(), 'Observed PPE issue');
        await page.locator('section[aria-label="PPE criteria"]').getByRole('button', { name: 'Show remark', exact: true }).click();
        assert.equal(await page.getByLabel('Remark for PPE requirement').inputValue(), 'Observed PPE issue');
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await page.getByText('1 of 3 items addressed and saved', { exact: true }).waitFor();
        assert.equal(await ppe.getByRole('button', { name: '0', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByLabel('Remark for PPE requirement').inputValue(), 'Observed PPE issue', 'Saved remarks reopen automatically');
        await rate('Fire Safety requirement', 'Not Applicable');
        await rate('Chemical Storage requirement', '4');
        await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
        await page.screenshot({ path: '/tmp/opencode/sop-grading-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await page.getByText('3 of 3 items addressed and saved', { exact: true }).waitFor();
        const gradeWrite = mutations.filter(row => row.resource.endsWith('/grades')).at(-1);
        assert.equal(gradeWrite.body.find(row => row.itemId === 1).grade, 0);
        assert.equal(gradeWrite.body.find(row => row.itemId === 2).grade, null);
        assert.equal(gradeWrite.body.find(row => row.itemId === 1).remarks, 'Observed PPE issue');
        assert.equal(grades.length, 3, 'Saving an existing item replaces its mark');
        await page.getByRole('button', { name: 'Submit audit', exact: true }).click(); await confirm();
        await page.getByText('60.00%', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Add action', exact: true }).click();
        await page.getByLabel('Corrective action *').fill('Fix PPE compliance');
        await select('Assignee', 'Test Auditor'); await confirm();
        await page.getByText('Fix PPE compliance', { exact: true }).first().waitFor();
        await page.getByRole('button', { name: 'Done', exact: true }).click(); await confirm();
        await page.getByText('Done', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Link existing file', exact: true }).click();
        await page.getByLabel('File reference *').fill('6e09eca0-37df-4e6e-a827-adac040c875a');
        await page.getByLabel('Filename', { exact: true }).fill('proof.jpg'); await page.getByLabel('File type (MIME)', { exact: true }).fill('image/png'); await confirm();
        await page.getByText('proof.jpg', { exact: true }).waitFor();
        await page.getByRole('img', { name: 'proof.jpg', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Remove', exact: true }).count(), 0);
        const beforeInvalid = mutations.length;
        await page.getByLabel('Evidence image', { exact: true }).setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
        await page.getByText('Choose a JPEG, PNG or WebP up to 8 MB.', { exact: true }).waitFor();
        assert.equal(mutations.length, beforeInvalid, 'Invalid uploads do not reach the service');
        await select('Attachment kind', 'Signature');
        await page.getByLabel('Evidence image', { exact: true }).setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: imageBytes });
        await page.getByText('signature.png', { exact: true }).waitFor();
        assert.equal(mutations.find(row => row.resource.endsWith('/upload')).body.kind, 'Signature');
        await page.goto(`${base}/arf/sop-safety/inspector/overview`); await sectionResult();
        assert.equal(await page.getByRole('progressbar', { name: 'PPE compliance', exact: true }).getAttribute('aria-valuenow'), '0');
        assert.equal(await page.getByRole('progressbar', { name: 'Chemical Storage compliance', exact: true }).getAttribute('aria-valuenow'), '80');
        assert.equal(await page.getByRole('progressbar', { name: 'Fire Safety compliance', exact: true }).count(), 0, 'N/A-only sections are not presented as zero');
        await page.getByRole('button', { name: 'Reporting period', exact: true }).click();
        await page.getByLabel('Reporting from date', { exact: true }).fill('2026-10-01');
        await page.getByLabel('Reporting to date', { exact: true }).fill('2026-11-30'); await page.keyboard.press('Escape');
        await sectionResult();
        assert.equal(reads.filter(row => row.resource === 'kpi').at(-1).query.from, '2026-10-01');
        assert.equal(reads.filter(row => row.resource === 'audits').at(-1).query.to, '2026-11-30');
        await page.getByLabel('Reporting to date', { exact: true }).waitFor({ state: 'hidden' });
        await page.screenshot({ path: '/tmp/opencode/sop-overview-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
        await page.screenshot({ path: '/tmp/opencode/sop-overview-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}/arf/sop-safety/inspector/audits/12`);
        await page.getByRole('button', { name: 'Cancel audit', exact: true }).click();
        await page.getByLabel('Reason *').fill('Dummy verification'); await confirm();
        await page.getByText('Cancellation: Dummy verification', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Add action', exact: true }).count(), 0);
        await page.goto(`${base}/arf/sop-safety/planner/checklists`);
        await page.getByRole('button', { name: 'View Warehouse SOP and Safety' }).click();
        await page.getByRole('button', { name: 'Add item', exact: true }).click();
        await page.getByLabel('Section *', { exact: true }).fill('Emergency Readiness');
        await page.getByLabel('Requirement *').fill('Emergency numbers posted'); await confirm();
        await page.getByText('Emergency numbers posted', { exact: true }).last().waitFor();
        assert.equal(await page.getByText('Emergency numbers posted', { exact: true }).count(), 1, 'Only one item list is shown');
        await page.getByRole('button', { name: 'Edit Emergency numbers posted', exact: true }).click();
        await page.getByLabel('Weight *', { exact: true }).fill('2'); await confirm();
        await page.getByText('Emergency numbers posted', { exact: true }).waitFor();
        assert.equal(items.find(item => item.description === 'Emergency numbers posted').weight, 2);
        await page.setViewportSize({ width: 390, height: 844 });
        const modal = await page.getByRole('dialog').boundingBox();
        assert.ok(modal.height <= 844 && modal.y >= 0, 'Checklist dialog fits the mobile viewport');
        await page.screenshot({ path: '/tmp/opencode/sop-checklist-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(grades[0].description, 'PPE requirement', 'Checklist changes do not rewrite snapshots');
        await page.goto(`${base}/arf/sop-safety/inspector/schedules`);
        await page.getByRole('button', { name: 'Calendar', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Create recurring plan' }).count(), 0, 'Inspector cannot manage scheduling');
        await page.goto(`${base}/arf/sop-safety/planner/schedules`);
        await page.getByRole('button', { name: 'Create recurring plan' }).click();
        await select('Warehouse', 'Alaminos - Bad Stock'); await select('Weekday', 'Sunday'); await confirm();
        await page.getByText('Alaminos - Bad Stock · Weekly · Sunday', { exact: true }).waitFor();
        assert.equal(rules[0].weekday, 7);
        await page.getByRole('button', { name: 'Disable', exact: true }).click(); await confirm();
        await page.getByText('Disabled', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Create recurring plan' }).click();
        await select('Warehouse', 'Alaminos - Bad Stock'); await select('Frequency', 'Monthly');
        await page.getByLabel('Day of month (1–28) *').fill('28'); await confirm();
        await page.getByText('Alaminos - Bad Stock · Monthly · day 28', { exact: true }).waitFor();
        assert.equal(rules[1].dayOfMonth, 28); assert.equal(rules[1].weekday, null);
        await page.getByRole('button', { name: 'Add one-off date' }).click();
        await select('Warehouse', 'Alaminos - Bad Stock'); await page.getByLabel('Planned date (after today) *').fill('2030-12-10'); await confirm();
        await page.getByText('2030-12-10', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Add one-off date' }).click();
        await select('Warehouse', 'Alaminos - Bad Stock'); await page.getByLabel('Planned date (after today) *').fill('2030-12-10'); await confirm();
        await page.getByText('409: Date clash', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).last().click();
        const scheduledRow = page.getByRole('row').filter({ hasText: '2030-12-10' });
        await scheduledRow.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.getByLabel('Reason *').fill('Fixture cancellation'); await confirm();
        await scheduledRow.getByText('Cancelled', { exact: true }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Calendar', exact: true }).click();
        await noOverflow();
        await page.screenshot({ path: '/tmp/opencode/sop-mobile.png', fullPage: true });
        await page.goto(`${base}/arf/sop-safety`);
        await sectionResult();
        for (const label of ['Upcoming: 1', 'Due: 1', 'Done: 1', 'Done late: 0', 'Missed: 0', 'Cancelled: 2']) assert.equal(await page.getByRole('group', { name: label, exact: true }).count(), 1, `Schedule count ${label}`);
        const scheduleReads = reads.filter(row => row.resource === 'schedules' && row.query.outcome);
        assert.ok(scheduleReads.length >= 6);
        assert.ok(scheduleReads.every(row => !row.query.from && !row.query.to), 'Schedule summary ignores the compliance period');
        denyAudits = true;
        await page.goto(`${base}/arf/sop-safety/audits`);
        await page.getByText('403: SOP permission denied', { exact: true }).waitFor();
        denyAudits = false;
        assignedRoles = ['INSPECTOR'];
        await page.goto(`${base}/arf/sop-safety/inspector/checklists`);
        await page.getByRole('button', { name: 'View Warehouse SOP and Safety' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Create checklist', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'View Warehouse SOP and Safety' }).click();
        await page.getByText('Chemical Storage requirement', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Edit checklist', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Add item', exact: true }).count(), 0);
        await page.goto(`${base}/arf/sop-safety/planner`);
        await page.getByText('Planner access has not been granted.', { exact: true }).waitFor();
        await page.goto(`${base}/arf/sop-safety`);
        await sectionResult();
        assert.ok(page.url().endsWith('/inspector/overview'));
        assignedRoles = ['PLANNER'];
        await page.goto(`${base}/arf/sop-safety/planner/overview`);
        await sectionResult();
        assert.equal(await page.getByRole('button', { name: 'New audit' }).count(), 0);
        await page.getByRole('link', { name: 'Compliance audits', exact: true }).click();
        await page.getByRole('link', { name: 'View audit', exact: true }).click();
        assert.ok(page.url().endsWith('/planner/audits/12'));
        await page.getByText('60.00%', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Cancel audit', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Link existing file', exact: true }).count(), 0);
        await page.goto(`${base}/arf/sop-safety/inspector/audits/12`);
        await page.getByText('Inspector access has not been granted.', { exact: true }).waitFor();
        await page.goto(`${base}/arf/sop-safety`);
        await sectionResult();
        assert.ok(page.url().endsWith('/planner/overview'));
        const removedView = await page.goto(`${base}/arf/sop-safety/viewer`);
        assert.equal(removedView.status(), 404);
        assignedRoles = ['INSPECTOR'];
        audits[0].status = 'Draft';
        await page.route('**/api/arf/sop-safety/audits/12/grades', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Simulated save failure' }) }));
        await page.goto(`${base}/arf/sop-safety/inspector/audits/12`);
        await rate('PPE requirement', '1');
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await page.getByText('Reload the audit to confirm saved grades before continuing.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).isDisabled(), true);
        assert.equal(grades.find(grade => grade.itemId === 1).grade, 0, 'Failed save does not change persisted grades');
        assert.equal(errors.length, 0, errors.join('\n'));
        console.log('SOP browser verification passed: shared dashboards/history in Planner and Inspector, no standalone Viewer, read-only Planner audit detail, isolated mutation controls, shared-entry redirects, denied cross-role navigation, grading, frozen results, evidence, actions, scheduling and mobile calendar. Mocked backend only.');
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
