#!/usr/bin/env node
// Local read-only log viewer. It never starts a verification or edits project data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '..');
const base = path.join(root, 'work/practical-verification');
const allowedLogs = ['run', 'image-ledger', 'question-structure', 'typecheck', 'web-build', 'pwa', 'browser-images'];

export function createLogViewer(directory = base) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!/^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host || '')) { res.writeHead(403).end(); return; }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await fs.promises.readFile(path.join(root, 'tools/practical-log-viewer.html')));
        return;
      }
      if (url.pathname !== '/api/log') { res.writeHead(404).end(); return; }
      const dirs = (await fs.promises.readdir(directory, { withFileTypes: true })).filter(d => d.isDirectory() && /^\d{4}-/.test(d.name)).map(d => d.name).sort().reverse();
      let status, run;
      for (const name of dirs) {
        try { status = JSON.parse(await fs.promises.readFile(path.join(directory, name, 'status.json'), 'utf8')); run = name; break; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      const requested = url.searchParams.get('step');
      if (requested && requested !== 'auto' && !allowedLogs.includes(requested)) { res.writeHead(400).end(); return; }
      const step = !requested || requested === 'auto' ? status?.steps?.at(-1)?.name || 'run' : requested;
      if (!allowedLogs.includes(step)) throw new Error('Unknown log step');
      let log = '', truncated = false;
      if (run) {
        let handle;
        try {
          handle = await fs.promises.open(path.join(directory, run, `${step}.log`), 'r');
          const { size } = await handle.stat();
          const offset = Math.max(0, size - 128 * 1024);
          const buffer = Buffer.alloc(size - offset);
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
          log = buffer.subarray(0, bytesRead).toString('utf8');
          truncated = offset > 0;
          if (truncated && log.includes('\n')) log = log.slice(log.indexOf('\n') + 1);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        finally { await handle?.close(); }
      }
      let processAlive = null;
      if (status && ['running', 'starting'].includes(status.state) && Number.isInteger(status.pid) && status.pid > 0) {
        try { process.kill(status.pid, 0); processAlive = true; } catch (error) { processAlive = error.code === 'EPERM' ? null : false; }
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ run, status, step, log, truncated, processAlive, checkedAt: new Date().toISOString() }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: '로그를 읽지 못했습니다. 잠시 후 다시 시도합니다.' }));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--background')) throw new Error('Only --background is supported');
  fs.mkdirSync(base, { recursive: true });
  if (args.includes('--background')) {
    const fd = fs.openSync(path.join(base, 'viewer.log'), 'a');
    const child = spawn(process.execPath, [self], { cwd: root, detached: true, stdio: ['ignore', fd, fd] });
    child.once('error', error => { console.error(error); process.exitCode = 1; });
    child.once('spawn', () => console.log(JSON.stringify({ pid: child.pid, url: 'http://127.0.0.1:4192/' })));
    child.unref();
    fs.closeSync(fd);
  } else {
    const server = createLogViewer();
    server.once('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(4192, '127.0.0.1', () => console.log('Live logs: http://127.0.0.1:4192/'));
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
  }
}
