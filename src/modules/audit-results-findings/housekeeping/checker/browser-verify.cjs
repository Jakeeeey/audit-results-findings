/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Checker browser regression harness. */
// Real components/styles; mock HTTP only. No .env or remote writes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const toolRoot = process.env.HOUSEKEEPING_TEST_TOOLS || path.join(process.env.TEMP || '/tmp/opencode', 'opencode-evaluation-tools/node_modules');
const { build } = require(path.join(toolRoot, 'esbuild')), { chromium } = require(path.join(toolRoot, 'playwright-core'));
const root = process.cwd(), requests = [];
let canComplete = false, denyDone = false, pendingDone, holdDone = false;
let resolvePending; const pendingReady = new Promise(resolve => { resolvePending = resolve; });
const warehouseNames = { 501: 'Warehouse Alpha', 777: 'Warehouse Beta' };
const auditFor = branchId => ({ id: branchId === 501 ? 10 : 20, auditNo: branchId === 501 ? '5S-ALPHA' : '5S-BETA', branchId, branchName: warehouseNames[branchId], checklistId: 1, auditDate: '2026-11-09', checkedBy: 12, checkedByName: 'Audit Inspector', status: 'Submitted', maxGrade: 5, pointsEarned: 0, pointsPossible: 5, scorePercent: branchId === 501 ? 88.5 : 66.66, remarks: null });
const actions = Array.from({ length: 26 }, (_, index) => ({ id: 30 + index, auditId: 10, auditNo: '5S-ALPHA', branchId: 501, branchName: warehouseNames[501], description: index === 0 ? 'Clear walkway Alpha' : `Alpha finding ${index}`, gradeId: 1, assignedTo: 7, assignedToName: 'Warehouse Admin', dueDate: '2026-01-01', status: 'Open' }));
actions.push({ id: 90, auditId: 20, auditNo: '5S-BETA', branchId: 777, branchName: warehouseNames[777], description: 'Resolve Beta finding', status: 'Open', gradeId: 1, dueDate: null });
const pageOf = (key, rows, q) => { const page = Number(q.get('page') || 1), pageSize = Number(q.get('pageSize') || 25); return { [key]: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize }; };
async function main() {
    const css = await require('postcss')([require('@tailwindcss/postcss')({ base: root })]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
    const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Checker from './src/modules/audit-results-findings/housekeeping/checker/HousekeepingCheckerModule'; createRoot(document.getElementById('root')).render(<Checker />);`, resolveDir: root, sourcefile: 'checker-test.tsx', loader: 'tsx' }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, tsconfig: path.join(root, 'tsconfig.json') });
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://fixture'); const q = url.searchParams;
        const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (url.pathname === '/bundle.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(bundle.outputFiles[0].contents); }
        if (url.pathname === '/style.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(css.css); }
        if (!url.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root" style="padding:16px"></div><script src="/bundle.js"></script></body></html>'); }
        const resource = url.pathname.replace('/api/arf/housekeeping/spring/checker/', '');
        requests.push({ resource, method: req.method, branchId: q.get('branchId'), page: q.get('page') });
        let raw = ''; for await (const chunk of req) raw += chunk;
        if (resource === 'access') return send({ userId: 7, warehouses: Object.entries(warehouseNames).map(([id, name]) => ({ id: Number(id), name, code: name.split(' ')[1] })), canComplete, commentsSupported: false, resolutionEvidenceSupported: false });
        const branchId = Number(q.get('branchId')), audit = auditFor(branchId), branchActions = actions.filter(a => a.branchId === branchId);
        if (resource === 'summary') {
            const open = branchActions.filter(a => a.status === 'Open');
            return send({ kpi: { branchIds: [branchId], from: q.get('from'), to: q.get('to'), audits: 1, pointsEarned: 0, pointsPossible: 5, scorePercent: audit.scorePercent, sections: [], weeks: [], schedule: { scheduled: 1, done: 1, doneLate: 0, missed: 0, due: 0, upcoming: 0, cancelled: 0, counted: 1, donePercent: 100 } }, openActions: open.length, completedActions: branchActions.length - open.length, overdueActions: branchId === 501 ? open.length : 0, attention: open.slice(0, 5), recentAudits: [audit], actionScope: 'all-dates', attentionComplete: true, asOfDate: '2026-11-09' });
        }
        if (resource === 'audits') return send(pageOf('audits', [audit], q));
        if (resource === 'actions') return send(pageOf('actions', branchActions.filter(a => (!q.get('status') || a.status === q.get('status')) && (!q.get('assignedTo') || a.assignedTo === Number(q.get('assignedTo')))), q));
        if (/^audits\/\d+$/.test(resource)) return send({ audit, grades: [{ id: 1, itemId: 1, section: 'Sort', description: 'Stored immutable criterion', weight: 1, grade: 0, remarks: 'Original finding' }, { id: 2, itemId: 2, section: 'Shine', description: 'Stored N/A criterion', weight: 1, grade: null }], itemsToGrade: [] });
        if (resource.endsWith('/actions')) return send(branchActions);
        if (resource.endsWith('/attachments')) return send([]);
        if (/^actions\/\d+\/done$/.test(resource)) {
            const body = JSON.parse(raw); const action = actions.find(a => a.id === Number(resource.split('/')[1]));
            assert.equal(body.auditId, action.auditId); assert.equal(body.branchId, action.branchId);
            const finish = () => { if (denyDone) return send({ message: 'Fixture backend denied completion' }, 403); action.status = 'Done'; send({ action }); };
            if (holdDone) { pendingDone = finish; resolvePending(); return; } return finish();
        }
        return send({ message: 'Unexpected Checker test request' }, 500);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        const executablePath = process.env.HOUSEKEEPING_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(p => fs.existsSync(p));
        browser = await chromium.launch({ executablePath, headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/arf/housekeeping/checker`);
        await page.getByText('88.50%', { exact: true }).first().waitFor();
        assert.ok(requests.some(r => r.branchId === '501')); assert.equal(requests.some(r => r.branchId === '190'), false);
        assert.equal(await page.getByRole('button', { name: 'Start audit', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Manage checklists' }).count(), 0);
        await page.getByRole('tab', { name: 'Audit Results', exact: true }).click(); await page.getByRole('button', { name: 'View details', exact: true }).click();
        await page.getByText('Stored immutable criterion', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Submit final audit', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: '5 out of 5' }).count(), 0);
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('tab', { name: 'Corrective Actions', exact: true }).click();
        await page.getByLabel('Assigned user ID', { exact: true }).fill('invalid'); await page.getByRole('button', { name: 'Apply', exact: true }).click();
        await page.getByText('Assigned user ID must be a positive integer, or leave it blank for all users.', { exact: true }).waitFor();
        await page.getByLabel('Assigned user ID', { exact: true }).fill(''); await page.getByRole('button', { name: 'Apply', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText('Alpha finding 25', { exact: true }).waitFor(); assert.ok(requests.some(r => r.resource === 'actions' && r.page === '2'));
        await page.getByRole('button', { name: 'View action', exact: true }).click(); await page.getByText('Stored immutable criterion', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Mark Done', exact: true }).count(), 0); assert.equal(await page.getByRole('dialog').getByRole('textbox').count(), 0);
        await page.getByText('Pending backend support for persistent comments', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('group', { name: 'Warehouse selector' }).getByRole('combobox').click(); await page.getByPlaceholder('Search select warehouse...').fill('Beta'); await page.getByRole('option', { name: 'Warehouse Beta · Beta', exact: true }).click();
        await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByText('66.66%', { exact: true }).first().waitFor();
        assert.equal(await page.getByText('Clear walkway Alpha', { exact: true }).count(), 0); assert.equal(await page.getByText('88.50%', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'View action', exact: true }).click(); await page.getByText('Resolve Beta finding', { exact: true }).last().waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        canComplete = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByText('66.66%', { exact: true }).first().waitFor();
        await page.getByRole('button', { name: 'View action', exact: true }).click(); await page.getByRole('button', { name: 'Mark Done', exact: true }).click();
        denyDone = true; await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await page.getByText('Fixture backend denied completion', { exact: true }).waitFor(); assert.equal(actions.find(a => a.id === 90).status, 'Open');
        denyDone = false; holdDone = true; await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor(); assert.equal(actions.find(a => a.id === 90).status, 'Open');
        await pendingReady;
        if (!pendingDone) throw new Error('Expected pending completion fixture'); pendingDone(); holdDone = false;
        await page.getByRole('dialog').getByText('Done', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).first().click(); await page.getByText('66.66%', { exact: true }).first().waitFor();
        await page.setViewportSize({ width: 390, height: 844 }); fs.mkdirSync(path.join(root, '.agent'), { recursive: true }); await page.screenshot({ path: path.join(root, '.agent/housekeeping-checker-mobile.png'), fullPage: true });
        let heldAlpha, markHeld; const alphaHeld = new Promise(resolve => { markHeld = resolve; });
        await page.route('**/api/arf/housekeeping/spring/checker/summary?*', route => {
            if (new URL(route.request().url()).searchParams.get('branchId') === '501') { heldAlpha = route; markHeld(); return; }
            return route.continue();
        });
        await page.getByRole('group', { name: 'Warehouse selector' }).getByRole('combobox').click(); await page.getByRole('option', { name: 'Warehouse Alpha · Alpha', exact: true }).click(); await alphaHeld;
        await page.getByRole('group', { name: 'Warehouse selector' }).getByRole('combobox').click(); await page.getByRole('option', { name: 'Warehouse Beta · Beta', exact: true }).click();
        await page.getByText('66.66%', { exact: true }).first().waitFor(); await heldAlpha.continue().catch(() => {});
        assert.equal(await page.getByText('88.50%', { exact: true }).count(), 0); assert.equal(await page.getByText('Clear walkway Alpha', { exact: true }).count(), 0);
        assert.equal(requests.some(r => /comments|history/.test(r.resource)), false);
        assert.equal(requests.some(r => r.method !== 'GET' && !/^actions\/90\/done$/.test(r.resource)), false);
        assert.equal(errors.length, 0, errors.join('\n'));
        console.log('PASS Checker browser: backend warehouse default/search/switch and stale-request cancellation, real-score display, read-only grades/results, paginated actions/filter recovery, disabled comments and unapproved writes, backend errors, non-optimistic approved Done, unchanged quality score, mobile layout. Mock HTTP only.');
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
