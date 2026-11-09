/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = name => fs.readFileSync(path.resolve(__dirname, name), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source('permissions.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject });
const grant = basePath => ({ userId: 7, subsystemSlug: 'arf', status: 'active', basePath });
for (const [route, expected] of [['checker', 'checker'], ['auditor', 'auditor'], ['inspector', 'auditor'], ['scheduler', 'scheduler']]) {
    const roles = exportsObject.housekeepingRoles([grant(`/arf/housekeeping/${route}`)], 7);
    assert.deepEqual(Array.from(roles), [expected]);
}
assert.equal(exportsObject.housekeepingRoles([grant('/arf/housekeeping/checker')], 8).length, 0);
const proxy = source('../../../../app/api/arf/housekeeping/spring/[...path]/route.ts');
assert.match(proxy, /else access.requireRole\('auditor'\)/);
assert.doesNotMatch(proxy, /requireRole\('checker'/);
const files = source('../../../../app/api/arf/housekeeping/files/[auditId]/[fileId]/route.ts');
assert.match(files, /req.method === 'POST'\) roleAccess.requireRole\('auditor'\)/);
assert.match(files, /role === 'auditor' \|\| role === 'scheduler'/);
const entry = source('../HousekeepingEntry.tsx');
assert.match(entry, /mode === 'checker' \? <HousekeepingCheckerModule/);
const details = source('components/CorrectiveActionDetails.tsx');
assert.doesNotMatch(details, /writeSpringHousekeeping|<Input|<textarea|assignedTo:/);
assert.match(details, /completeCheckerAction/);
console.log('PASS role isolation and source regression guards for Checker entry, definition mutation denial and upload restrictions. Not an HTTP integration test.');
