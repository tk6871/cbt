import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { readGitFileList } from './git-file-list.mjs';

const root = resolve(import.meta.dirname, '..');
const trackedFiles = await readGitFileList({ cwd: root });
// Ignore untracked macOS/cloud conflict copies, not legitimate tracked assets.
// A placeholder conflict copy can block Gradle's input hashing indefinitely.
const bundleFilter = (source) => {
  const name = basename(source);
  if (name === '.DS_Store') return false;
  return !/ \d+\.[^/]+$/.test(name) || trackedFiles.has(relative(root, source));
};
const bundled = process.argv[2] === '--bundled-preview';
const output = bundled ? resolve(process.argv[3]) : resolve(root, '.android-web');
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

if (!bundled) await rm(output, { recursive: true, force: true });
await mkdir(output);
await mkdir(resolve(output,'output/pdf'),{recursive:true});
await cp(resolve(root,'output/pdf/sports-leadership-final.pdf'),resolve(output,'output/pdf/sports-leadership-final.pdf'));
await cp(resolve(root,'output/pdf/metal-curves-final.pdf'),resolve(output,'output/pdf/metal-curves-final.pdf'));

await Promise.all(directories.map((directory) =>
  cp(resolve(root, directory), resolve(output, directory), { recursive: true, filter: bundleFilter })));
if (bundled) {
  await cp(resolve(root,'assets'), resolve(output,'assets'), {recursive:true,filter:bundleFilter});
} else {
  await mkdir(resolve(output, 'assets'), { recursive: true });
  await mkdir(resolve(output,'assets/study'),{recursive:true});
  for(const name of ['metal-heat-paths.svg','metal-fe-c.webp','metal-ttt.webp'])
    await cp(resolve(root,'assets/study',name),resolve(output,'assets/study',name));
  await cp(resolve(root, 'assets/icons'), resolve(output, 'assets/icons'), { recursive: true, filter: bundleFilter });
  await cp(resolve(root, 'assets/lounge'), resolve(output, 'assets/lounge'), { recursive: true, filter: bundleFilter });
  const imageReplacements=JSON.parse(await readFile(resolve(root,'data/problem-images-webp90.json'),'utf8')).mappings;
  await mkdir(resolve(output,'assets/problem-webp90'),{recursive:true});
  for(const [original,replacement] of Object.entries(imageReplacements))if(original.startsWith('assets/hvac/formula-samples/'))await cp(resolve(root,replacement),resolve(output,replacement));

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
    ...['hvac.js', 'hvac-hansol.js', 'hvac-hansol-book.js', 'safety.js', 'energy.js', 'energy-restored.js', 'energy-book-earlier.js', 'energy-midterm.js', 'energy-textbook.js', 'maintenance.js',
      'electric-craftsman.js', 'gas-craftsman.js', 'hazardous-craftsman.js', 'information-engineer.js',
      'forklift-craftsman.js', 'maintenance-engineer.js', 'safety-engineer.js', 'jewelry.js']
      .map((file) => pointAssetsToPublishedSite(`data/${file}`)),
    pointAssetsToPublishedSite('modern/cbt.js'),
  ]);
}

await Promise.all(files.map(async (file) => {
  const source = resolve(root, file);
  const target = resolve(output, file);
  if (bundled && file==='cloud-config.js') {
    await writeFile(target, 'window.CBT_CLOUD_CONFIG = {enabled:false};\n');
    return;
  }
  if (!file.endsWith('.html')) {
    await cp(source, target);
    return;
  }

  const html = await readFile(source, 'utf8');
  const nativeHtml = html
    .replace(/\s*<link rel="manifest"[^>]*>/g, '')
    .replace('<head>', '<head>\n  <script>document.documentElement.dataset.nativeApp = "true";'+(bundled?'document.documentElement.dataset.bundledAssets="true";':'')+'</script>');
  await writeFile(target, nativeHtml);
}));

console.log(`Android web bundle prepared: ${output}`);
console.log(bundled ? 'Question images and 3D models are bundled.' : `Large images load from: ${remoteAssetRoot}`);
