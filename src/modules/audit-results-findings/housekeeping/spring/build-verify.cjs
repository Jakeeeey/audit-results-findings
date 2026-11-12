/* eslint-disable @typescript-eslint/no-require-imports -- Isolated production build; never overwrites an active .next directory. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawnSync } = require('node:child_process');
const root = process.cwd();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-housekeeping-build-'));
for (const name of ['src', 'node_modules', 'public']) fs.symlinkSync(path.join(root, name), path.join(directory, name), process.platform === 'win32' ? 'junction' : 'dir');
for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs']) {
    if (fs.existsSync(path.join(root, name))) fs.copyFileSync(path.join(root, name), path.join(directory, name));
}
fs.writeFileSync(path.join(directory, 'next.config.js'), `const config = require(${JSON.stringify(path.join(root, 'next.config.js'))}); module.exports = { ...config, output: 'standalone', outputFileTracingRoot: ${JSON.stringify(root)} };`);
const envFile = path.join(root, '.env');
const env = { ...process.env, ...(fs.existsSync(envFile) ? require('dotenv').parse(fs.readFileSync(envFile)) : {}), NODE_OPTIONS: '--max-old-space-size=8192', NEXT_TELEMETRY_DISABLED: '1' };
console.log('Isolated production build directory:', directory);
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', directory, '--webpack'], { cwd: directory, env, stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
