#!/usr/bin/env node
// Fixed local verification queue. No AI calls, downloads, image replacement or Git writes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '..');
const base = path.join(root, 'work/practical-verification');
const args = process.argv.slice(2);
const withBuild = args.includes('--build');
const worker = args.indexOf('--worker');
const supported = new Set(['--background', '--build', '--plan', '--worker']);
for (let i = 0; i < args.length; i++) {
  if (!supported.has(args[i])) throw new Error(`Unknown option: ${args[i]}`);
  if (args[i] === '--worker') i++;
}
const node = process.execPath;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['image-ledger', node, ['tools/check-practical-image-review.mjs']],
  ['question-structure', node, ['tools/audit-hvac-practical.mjs']],
  ['typecheck', npm, ['run', 'typecheck']],
  ...(withBuild ? [['web-build', npm, ['run', 'build:android:web']]] : []),
  ['pwa', npm, ['run', 'test:pwa']],
  ['browser-images', node, ['node_modules/@playwright/test/cli.js', 'test', 'tools/practical-full-image-review.spec.ts', '--project=desktop', '--workers=1']],
];
if (args.includes('--plan')) {
  console.log(steps.map(([name, cmd, argv]) => `${name}: ${cmd} ${argv.join(' ')}`).join('\n'));
  process.exit(0);
}
fs.mkdirSync(base, { recursive: true });
const runDir = worker >= 0 ? path.resolve(args[worker + 1] || '') : fs.mkdtempSync(path.join(base, `${new Date().toISOString().replace(/[:.]/g, '-')}-`));
if (path.dirname(runDir) !== base || !fs.statSync(runDir).isDirectory()) throw new Error('Invalid run directory');
const statusFile = path.join(runDir, 'status.json');
if (args.includes('--background') && worker < 0) {
  const fd = fs.openSync(path.join(runDir, 'run.log'), 'a');
  const child = spawn(node, [self, '--worker', runDir, ...(withBuild ? ['--build'] : [])], {
    cwd: root, detached: true, stdio: ['ignore', fd, fd],
  });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('spawn', () => console.log(JSON.stringify({ pid: child.pid, runDir, statusFile, log: path.join(runDir, 'run.log') }, null, 2)));
  child.unref();
  fs.closeSync(fd);
} else {
  const status = { pid: process.pid, startedAt: new Date().toISOString(), state: 'starting', withBuild, steps: [],
    scope: 'Structure, hashes, build and browser rendering only; not original-source/answer correctness or manual image approval.' };
  const save = () => {
    fs.writeFileSync(`${statusFile}.tmp`, JSON.stringify(status, null, 2) + '\n');
    fs.renameSync(`${statusFile}.tmp`, statusFile);
  };
  const lock = path.join(base, 'active.lock');
  let locked = false;
  let server;
  let active;
  let stopping = false;
  const stop = () => { stopping = true; active?.kill('SIGTERM'); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  save();
  try {
    // Never remove an existing lock automatically: interrupted jobs need human inspection.
    const fd = fs.openSync(lock, 'wx');
    locked = true;
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, runDir }) + '\n');
    fs.closeSync(fd);
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
    server = http.createServer(async (req, res) => {
      try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const parts = pathname.split('/');
        if (parts.some(p => p.startsWith('.'))) { res.writeHead(403).end(); return; }
        const file = await fs.promises.realpath(path.join(root, pathname === '/' ? 'index.html' : pathname));
        if (!file.startsWith(root + path.sep) || !(await fs.promises.stat(file)).isFile()) { res.writeHead(403).end(); return; }
        const content = await fs.promises.readFile(file);
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    status.url = `http://127.0.0.1:${server.address().port}`;
    status.state = 'running';
    save();
    for (const [name, command, originalArgs] of steps) {
      if (stopping) throw new Error('Stopped by signal');
      const argv = [...originalArgs];
      if (name === 'browser-images') argv.push('--output', path.join(runDir, 'browser-results'));
      const step = { name, startedAt: new Date().toISOString(), state: 'running' };
      status.steps.push(step);
      save();
      console.log(`\n[${step.startedAt}] START ${name}`);
      const log = fs.openSync(path.join(runDir, `${name}.log`), 'a');
      let result;
      try {
        result = await new Promise((resolve, reject) => {
          active = spawn(command, argv, { cwd: root, env: { ...process.env, CBT_TEST_URL: status.url, NO_COLOR: '1' }, stdio: ['ignore', log, log] });
          active.once('error', reject);
          active.once('exit', (code, signal) => resolve({ code, signal }));
        });
      } catch (error) {
        step.state = 'failed'; step.error = error.message; throw error;
      } finally { fs.closeSync(log); active = undefined; }
      Object.assign(step, result, { finishedAt: new Date().toISOString(), state: result.code === 0 && !stopping ? 'passed' : 'failed' });
      save();
      console.log(`${step.state.toUpperCase()} ${name}`);
      if (step.state !== 'passed') throw new Error(`${name} failed; remaining steps were not run`);
    }
    status.state = 'passed';
  } catch (error) {
    status.state = stopping ? 'stopped' : 'failed';
    status.error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    status.finishedAt = new Date().toISOString();
    save();
    server?.close();
    if (locked) fs.unlinkSync(lock);
    console.log(`Status: ${statusFile}`);
  }
}
