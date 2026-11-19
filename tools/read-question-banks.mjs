import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function* readQuestionBanks(root) {
  const dir = path.join(root, 'data');
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.js')).sort()) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!/^\s*window\.CBT_DATA_\w+\s*=/m.test(source)) continue;
    const context = {window:{}};
    vm.runInNewContext(source, context, {filename:file});
    for (const bank of Object.values(context.window).flat()) {
      if (Array.isArray(bank?.rounds)) yield bank;
    }
  }
}
