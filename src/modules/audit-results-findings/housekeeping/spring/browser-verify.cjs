/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Windows browser verification harness. */
// Isolated mocked backend only. Never reads .env or modifies Dummy/Live data.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const toolRoot = process.env.HOUSEKEEPING_TEST_TOOLS || path.join(process.env.TEMP || '/tmp/opencode', 'opencode-evaluation-tools/node_modules');
const { build } = require(path.join(toolRoot, 'esbuild'));
const { chromium } = require(path.join(toolRoot, 'playwright-core'));
const root = process.cwd();
let nextId = 1;
const audits = [], schedules = [], rules = [], actions = [], attachments = [];
let grades = [];
const checklist = { id: 1, name: 'Warehouse 5S', description: 'Weekly 5S check', branchId: null, frequency: 'Weekly', maxGrade: 5, active: true, createdAt: '2026-11-04T10:19:59' };
const sections = ['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain'];
const items = sections.flatMap((section, s) => Array.from({ length: 3 }, (_, i) => ({ id: s * 3 + i + 1, checklistId: 1, section, description: `${section} criterion ${i + 1}`, weight: 1, sortOrder: (s * 3 + i + 1) * 10, active: true })));
const mutations = [];
const kpi = () => { const done = audits.filter(a => a.status === 'Submitted'); const earned = done.reduce((s, a) => s + a.pointsEarned, 0), possible = done.reduce((s, a) => s + a.pointsPossible, 0); return { branchIds: [190], from: '2026-11-01', to: '2026-11-30', audits: done.length, pointsEarned: earned, pointsPossible: possible, scorePercent: possible ? earned / possible * 100 : null, sections: sections.map(section => ({ section, pointsEarned: 0, pointsPossible: 0, scorePercent: null })), weeks: [], schedule: { scheduled: schedules.length, done: 0, doneLate: 0, missed: 0, due: 0, upcoming: schedules.length, cancelled: 0, counted: 0, donePercent: null } }; };
async function main() {
    const css = await require('postcss')([require('@tailwindcss/postcss')({ base: root })]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
    const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {HousekeepingWorkspace} from './src/modules/audit-results-findings/housekeeping/spring/HousekeepingWorkspace'; createRoot(document.getElementById('root')).render(<HousekeepingWorkspace mode={location.pathname.includes('scheduler') ? 'scheduler' : 'auditor'} />);`, resolveDir: root, sourcefile: 'housekeeping-browser-test.tsx', loader: 'tsx' }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, tsconfig: path.join(root, 'tsconfig.json') });
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://test');
        const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (url.pathname === '/bundle.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(bundle.outputFiles[0].contents); return; }
        if (url.pathname === '/style.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); res.end(css.css); return; }
        if (!url.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root" style="padding:24px"></div><script>globalThis.process={env:{}}</script><script src="/bundle.js"></script></body></html>'); return; }
        const p = url.pathname.replace('/api/arf/housekeeping/spring/', '');
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks);
        if (url.pathname === '/api/arf/housekeeping/files/1/upload') {
            const form = await new Request('http://upload.test', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData();
            attachments.push({ id: nextId++, kind: form.get('kind') || 'Evidence', directusFileId: '70f90cfa-02d1-4b73-8765-33175bb29eab', fileName: form.get('file').name, mimeType: 'image/png', fileSize: 1234 });
            return send({ success: true });
        }
        if (/\/files\/1\/\d+$/.test(url.pathname)) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fnkAAAAASUVORK5CYII=', 'base64')); return; }
        const body = raw.length ? JSON.parse(raw.toString()) : {};
        if (req.method !== 'GET') mutations.push({ p, method: req.method, body });
        if (req.method === 'GET') {
            if (p === 'checklists') return send([checklist]);
            if (p === 'checklists/1') return send({ checklist, items });
            if (p === 'kpi') return send(kpi());
            if (p === 'audits') return send({ audits: audits.filter(a => !url.searchParams.get('status') || a.status === url.searchParams.get('status')), total: audits.length, page: 1, pageSize: 25 });
            if (/^audits\/\d+$/.test(p)) { const a = audits.find(a => a.id === Number(p.split('/')[1])); return send({ audit: a, grades, itemsToGrade: items.filter(i => !grades.some(g => g.itemId === i.id)) }); }
            if (p.endsWith('/corrective-actions')) return send(actions);
            if (p.endsWith('/attachments')) return send(attachments);
            if (p === 'schedules') return send({ schedules, total: schedules.length, page: 1, pageSize: 25 });
            if (p === 'schedule-rules') return send(rules);
        }
        if (p === 'audits' && req.method === 'POST') { const a = { id: nextId++, auditNo: '5S-000001', ...body, status: 'Draft', maxGrade: 5, checkedBy: 186, pointsEarned: null, pointsPossible: null, scorePercent: null }; audits.push(a); return send(a, 201); }
        if (p === 'audits/1' && req.method === 'PUT') { Object.assign(audits[0], body); return send(audits[0]); }
        if (p.endsWith('/grades')) { grades = body.map((g, i) => ({ id: i + 100, ...items.find(item => item.id === g.itemId), ...g, itemId: g.itemId })); return send({ saved: true }); }
        if (p.endsWith('/submit')) { const a = audits[0]; if (grades.length !== 15) return send({ message: 'Missing ratings' }, 409); a.status = 'Submitted'; a.pointsEarned = grades.reduce((s, g) => s + (g.grade ?? 0) * g.weight, 0); a.pointsPossible = grades.reduce((s, g) => s + (g.grade === null ? 0 : a.maxGrade * g.weight), 0); a.scorePercent = a.pointsPossible ? a.pointsEarned / a.pointsPossible * 100 : null; return send(a); }
        if (p === 'audits/1/cancel') { audits[0].status = 'Cancelled'; return send(audits[0]); }
        if (p.endsWith('/corrective-actions') && req.method === 'POST') { actions.push({ id: nextId++, ...body, status: 'Open' }); return send(actions.at(-1), 201); }
        if (p.endsWith('/attachments') && req.method === 'POST') { attachments.push({ id: nextId++, ...body }); return send(attachments.at(-1), 201); }
        if (/^attachments\/\d+$/.test(p) && req.method === 'DELETE') { attachments.splice(attachments.findIndex(f => f.id === Number(p.split('/')[1])), 1); return send({ success: true }); }
        if (/^corrective-actions\/\d+\/done$/.test(p)) { actions[0].status = 'Done'; return send(actions[0]); }
        if (p === 'schedule-rules' && req.method === 'POST') { rules.push({ id: nextId++, ...body, active: true }); return send(rules.at(-1), 201); }
        if (/^schedule-rules\/\d+$/.test(p) && req.method === 'PUT') { Object.assign(rules.find(r => r.id === Number(p.split('/')[1])), body); return send(rules[0]); }
        if (p === 'schedules' && req.method === 'POST') { if (schedules.some(s => s.scheduledDate === body.scheduledDate && s.status !== 'Cancelled')) return send({ message: 'Date clash' }, 409); schedules.push({ id: nextId++, ...body, branchName: 'WAREHOUSE - DRY22', ruleId: null, originalDate: null, status: 'Scheduled', auditId: null, auditNo: null, auditDate: null, nextDate: null, outcome: 'Upcoming', cancelReason: null }); return send(schedules.at(-1), 201); }
        if (/^schedules\/\d+\/cancel$/.test(p)) { Object.assign(schedules.find(s => s.id === Number(p.split('/')[1])), { status: 'Cancelled', outcome: 'Cancelled', cancelReason: body.reason }); return send({ success: true }); }
        if (/^schedules\/\d+$/.test(p) && req.method === 'PUT') { const row = schedules.find(s => s.id === Number(p.split('/')[1])); row.originalDate ??= row.scheduledDate; row.scheduledDate = body.scheduledDate; return send(row); }
        if (/^schedules\/\d+$/.test(p) && req.method === 'DELETE') { schedules.splice(schedules.findIndex(s => s.id === Number(p.split('/')[1])), 1); return send({ success: true }); }
        if (p === 'checklists/1/items' && req.method === 'POST') { items.push({ id: 1000, checklistId: 1, ...body }); return send(items.at(-1), 201); }
        if (p === 'checklists/1' && req.method === 'PUT') { Object.assign(checklist, body); return send(checklist); }
        if (/^items\/\d+$/.test(p) && req.method === 'PUT') { Object.assign(items.find(i => i.id === Number(p.split('/')[1])), body); return send({ success: true }); }
        return send({ message: `Unhandled fixture ${req.method} ${p}` }, 500);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        const executablePath = process.env.HOUSEKEEPING_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(p => fs.existsSync(p));
        browser = await chromium.launch({ executablePath, headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('Browser runtime:', e.message); });
        const base = `http://127.0.0.1:${server.address().port}`;
        await page.goto(`${base}/arf/evaluation-and-weekly-performance/auditor`);
        await page.getByRole('button', { name: 'Start audit', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('dialog').filter({ hasText: 'Housekeeping Audit 5S-000001' }).waitFor();
        await page.getByRole('button', { name: 'Submit final audit' }).click(); await page.getByText('Answer every criterion with a score or N/A before submitting.', { exact: true }).waitFor();
        const criterion = name => page.getByRole('group', { name, exact: true });
        await criterion('Sort criterion 1').getByRole('button', { name: '0 out of 5', exact: true }).click();
        await criterion('Sort criterion 2').getByRole('button', { name: 'Not applicable (N/A)', exact: true }).click();
        for (const item of items.slice(2)) await criterion(item.description).getByRole('button', { name: '5 out of 5', exact: true }).click();
        await page.locator('#criterion-row-1 summary').click(); await page.getByLabel('Remarks for Sort criterion 1', { exact: true }).fill('Preserve this remark');
        await page.locator('#criterion-row-1 summary').click();
        await page.getByRole('button', { name: 'Submit final audit' }).click(); await page.getByText('Save your draft before final submission.', { exact: true }).waitFor();
        fs.mkdirSync(path.join(root, '.agent'), { recursive: true }); await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(root, '.agent/housekeeping-audit-mobile.png'), fullPage: true });
        const footerBounds = await page.getByRole('button', { name: 'Submit final audit' }).boundingBox(); assert.ok(footerBounds.y + footerBounds.height <= 844);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await page.getByRole('button', { name: 'Edit details', exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('button', { name: 'View details', exact: true }).click();
        await criterion('Sort criterion 1').getByRole('button', { name: '0 out of 5', exact: true }).waitFor();
        assert.equal(await criterion('Sort criterion 1').getByRole('button', { name: '0 out of 5', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await criterion('Sort criterion 2').getByRole('button', { name: 'Not applicable (N/A)', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByLabel('Remarks for Sort criterion 1', { exact: true }).inputValue(), 'Preserve this remark');
        await page.screenshot({ path: path.join(root, '.agent/housekeeping-audit-desktop.png'), fullPage: true });
        await page.getByRole('button', { name: 'Edit details', exact: true }).click();
        await page.getByLabel('Area / zone', { exact: true }).fill('Aisle A');
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('dialog').getByText('Aisle A', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Link existing file / signature' }).count(), 0);
        await page.getByLabel('Choose evidence photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('fixture photo') });
        await page.getByText('fixture.png', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Remove', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('No saved attachments.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Submit final audit' }).click();
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Final persisted score', { exact: true }).waitFor();
        assert.equal(await criterion('Sort criterion 1').getByRole('button', { name: '0 out of 5', exact: true }).isDisabled(), true);
        assert.equal(audits[0].pointsEarned, 65); assert.equal(audits[0].pointsPossible, 70);
        assert.equal(grades[0].grade, 0); assert.equal(grades[1].grade, null);
        await page.getByRole('button', { name: 'Add corrective action' }).click();
        await page.getByLabel('Corrective action *', { exact: true }).fill('Fix aisle markings');
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Fix aisle markings', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Mark done', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('button', { name: 'Cancel audit (reason required)' }).click(); await page.getByLabel('Cancellation reason *').fill('Dummy workflow test'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('dialog').filter({ hasText: 'Housekeeping Audit 5S-000001' }).getByText('Cancelled', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.goto(`${base}/arf/evaluation-and-weekly-performance/scheduler`);
        await page.getByRole('button', { name: 'Create plan', exact: true }).click();
        assert.equal(await page.getByLabel('Monthly day (1–28) *', { exact: true }).count(), 0);
        await page.getByLabel('Weekday *', { exact: true }).click();
        assert.equal(await page.getByRole('option').count(), 5);
        assert.equal(await page.getByRole('option', { name: 'Saturday', exact: true }).count(), 0);
        await page.getByRole('option', { name: 'Thursday', exact: true }).click();
        await page.getByLabel('Frequency *', { exact: true }).click(); await page.getByRole('option', { name: 'Monthly', exact: true }).click();
        assert.equal(await page.getByLabel('Weekday *', { exact: true }).count(), 0);
        await page.getByLabel('Monthly day (1–28) *', { exact: true }).fill('6');
        await page.getByLabel('Frequency *', { exact: true }).click(); await page.getByRole('option', { name: 'Weekly', exact: true }).click();
        assert.equal(await page.getByLabel('Monthly day (1–28) *', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Weekly · Thursday · Active', { exact: true }).waitFor();
        assert.equal(rules[0].weekday, 4); assert.equal(rules[0].dayOfMonth, null);
        await page.getByRole('button', { name: 'Disable', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('button', { name: 'Enable', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Create plan', exact: true }).click();
        await page.getByLabel('Frequency *', { exact: true }).click(); await page.getByRole('option', { name: 'Monthly', exact: true }).click();
        assert.equal(await page.getByLabel('Weekday *', { exact: true }).count(), 0);
        await page.getByLabel('Monthly day (1–28) *', { exact: true }).fill('15'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Monthly · day 15 · Active', { exact: true }).waitFor();
        assert.equal(rules[1].weekday, null); assert.equal(rules[1].dayOfMonth, 15);
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        assert.equal(await page.getByLabel('Monthly day (1–28) *', { exact: true }).count(), 0);
        await page.getByLabel('Weekday *', { exact: true }).click(); await page.getByRole('option', { name: 'Friday', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Weekly · Friday · Disabled', { exact: true }).waitFor();
        assert.equal(rules[0].weekday, 5); assert.equal(rules[0].dayOfMonth, null);
        await page.getByRole('button', { name: 'Add date', exact: true }).click();
        const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
        await page.getByLabel('Scheduled date *', { exact: true }).fill(future); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('button', { name: 'Add date', exact: true }).click(); await page.getByLabel('Scheduled date *', { exact: true }).fill(future); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Date clash', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('button', { name: 'Move', exact: true }).click();
        const movedDate = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
        await page.getByLabel('New date *', { exact: true }).fill(movedDate); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText(`Originally ${future}`, { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByLabel('Reason *', { exact: true }).fill('Dummy holiday'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Dummy holiday', { exact: true }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
        fs.mkdirSync(path.join(root, '.agent'), { recursive: true });
        await page.screenshot({ path: path.join(root, '.agent/housekeeping-spring-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}/arf/evaluation-and-weekly-performance/auditor`); await page.getByRole('button', { name: 'Manage checklists' }).click();
        await page.getByRole('combobox', { name: 'Checklist to manage' }).click(); await page.getByRole('option', { name: 'Warehouse 5S · Active', exact: true }).click();
        await page.getByRole('button', { name: 'Add item', exact: true }).click(); await page.getByLabel('Criterion *', { exact: true }).fill('Fixture criterion'); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Sort · Fixture criterion', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.route('**/api/arf/housekeeping/spring/audits?*', route => route.fulfill({ status: 403, json: { message: 'Fixture access denied' } }));
        await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByText('Fixture access denied', { exact: false }).waitFor();
        assert.equal(await page.getByText('No audits match these filters.', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Historical records', exact: true }).count(), 0);
        await page.unroute('**/api/arf/housekeeping/spring/audits?*');
        audits[0].status = 'Draft'; audits[0].maxGrade = 10;
        await page.goto(`${base}/arf/evaluation-and-weekly-performance/auditor`); await page.getByRole('button', { name: 'View details', exact: true }).click();
        const ten = criterion('Sort criterion 1').getByRole('button', { name: '10 out of 10', exact: true });
        await ten.focus(); await page.keyboard.press('Space'); assert.equal(await ten.getAttribute('aria-pressed'), 'true');
        await page.getByText('Scoring reference · 0–10 scale', { exact: true }).click();
        await page.getByText('No approved grade-by-grade descriptions are available for this scale.', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await page.getByRole('button', { name: 'Edit details', exact: true }).waitFor(); assert.equal(grades[0].grade, 10);
        assert.equal(errors.length, 0, errors.join('\n'));
        assert.ok(mutations.some(m => m.p.endsWith('/grades'))); assert.ok(mutations.some(m => m.p === 'schedule-rules'));
        console.log('PASS browser: button grading, unanswered validation, keyboard/dynamic 0-10 scale, draft save/reopen, preserved remarks, frozen scores, photo upload/remove, corrective actions, cancellation, scheduling, checklist configuration, mobile modal/calendar, no historical navigation, access-denied error. Mock backend only.');
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
