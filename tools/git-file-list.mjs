import { spawn } from 'node:child_process';

// Stream NUL-separated paths: execFileSync's default 1 MiB buffer is too small
// for image-heavy checkouts. setEncoding also preserves split UTF-8 characters.
export async function readNulSeparated(command, args, { cwd } = {}) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const paths = new Set();
  let pending = '';
  let errorText = '';
  const output = (async () => {
    child.stdout.setEncoding('utf8');
    for await (const chunk of child.stdout) {
      pending += chunk;
      let delimiter;
      while ((delimiter = pending.indexOf('\0')) !== -1) {
        const file = pending.slice(0, delimiter);
        if (file) paths.add(file);
        pending = pending.slice(delimiter + 1);
      }
    }
  })();
  const errors = (async () => {
    child.stderr.setEncoding('utf8');
    for await (const chunk of child.stderr) {
      if (errorText.length < 16_384) errorText += chunk.slice(0, 16_384 - errorText.length);
    }
  })();
  const [, , result] = await Promise.all([output, errors, closed]);
  if (result.code !== 0) throw new Error(`Path listing failed (${result.signal || result.code}): ${errorText.trim()}`);
  if (pending) throw new Error('Path listing ended without a NUL terminator');
  return paths;
}

export function readGitFileList({ cwd, includeUntracked = false } = {}) {
  const args = ['ls-files', '--cached'];
  if (includeUntracked) args.push('--others', '--exclude-standard');
  args.push('-z');
  return readNulSeparated('git', args, { cwd });
}
