import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.android-web');
const directories = ['data', 'modern', 'vendor'];
const remoteAssetRoot = 'https://tk6871.github.io/cbt/assets/';
const files = [
  'index.html',
  'jewelry.html',
  'next.html',
  'calculator.html',
  'calculator.css',
  'calculator.js',
  'cloud-config.js',
  'manifest.webmanifest',
  'jewelry.webmanifest',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await Promise.all(directories.map((directory) =>
  cp(resolve(root, directory), resolve(output, directory), { recursive: true })));
await mkdir(resolve(output, 'assets'), { recursive: true });
await cp(resolve(root, 'assets/icons'), resolve(output, 'assets/icons'), { recursive: true });
await cp(resolve(root, 'assets/hvac/formula-samples'), resolve(output, 'assets/hvac/formula-samples'), { recursive: true });

async function pointAssetsToPublishedSite(file) {
  const target = resolve(output, file);
  const source = await readFile(target, 'utf8');
  const localBuildAssets = [];
  const protectedSource = file === 'modern/cbt.js'
    ? source.replace(/assets\/[^/"'`\s]+\.(?:js|jpg|jpeg|png|webp)/g, (asset) => {
        const token = `__ANDROID_LOCAL_BUILD_ASSET_${localBuildAssets.length}__`;
        localBuildAssets.push(asset);
        return token;
      })
    : source;
  const rewritten = protectedSource
    .replace(/(^|[("'`=:\s])assets\//gm, `$1${remoteAssetRoot}`)
    .replace(/__ANDROID_LOCAL_BUILD_ASSET_(\d+)__/g, (_match, index) => localBuildAssets[Number(index)]);
  await writeFile(target, rewritten);
}

await Promise.all([
  ...['hvac.js', 'hvac-hansol.js', 'safety.js', 'energy.js', 'energy-engineer.js', 'maintenance.js', 'jewelry.js']
    .map((file) => pointAssetsToPublishedSite(`data/${file}`)),
  pointAssetsToPublishedSite('modern/cbt.js'),
]);

await Promise.all(files.map(async (file) => {
  const source = resolve(root, file);
  const target = resolve(output, file);
  if (!file.endsWith('.html')) {
    await cp(source, target);
    return;
  }

  const html = await readFile(source, 'utf8');
  const nativeHtml = html
    .replace(/\s*<link rel="manifest"[^>]*>/g, '')
    .replace('<head>', '<head>\n  <script>document.documentElement.dataset.nativeApp = "true";</script>');
  await writeFile(target, nativeHtml);
}));

console.log(`Android web bundle prepared: ${output}`);
console.log(`Large images load from: ${remoteAssetRoot}`);
