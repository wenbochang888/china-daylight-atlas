import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'dist'), output = path.join(root, 'dist-ios');
const app = JSON.parse(await readFile(path.join(root, 'ios-app.json'), 'utf8'));
// Copy only resources used by the province-only app. The complete national
// geometry is already inside assets; the website's public/maps stays intact.
await stat(path.join(source, 'index.html'));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'assets', 'favicon.png']) await cp(path.join(source, name), path.join(output, name), { recursive: true });

// Preserve shipped dependency notices in the offline package, including native plugins.
const notices = [];
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) notices.push(`\n===== ${name} =====\n${await readFile(path.join(root, name), 'utf8')}`);
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
for (const [name, entry] of Object.entries(lock.packages)) {
  if (!name || entry.dev) continue;
  const directory = path.join(root, name), metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  notices.push(`\n===== ${metadata.name} ${metadata.version} · ${metadata.license ?? '见上游说明'} =====`);
  const candidates = (await readdir(directory)).filter(file => /^(licen[sc]e|copying|copyright)(\.|$)/i.test(file));
  for (const file of candidates) if ((await stat(path.join(directory, file))).isFile()) notices.push(await readFile(path.join(directory, file), 'utf8'));
  if (!candidates.length) notices.push(`上游：${typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url ?? metadata.homepage ?? ''}\n${JSON.stringify(metadata.license ?? '')}`);
}
await writeFile(path.join(output, 'licenses.txt'), notices.join('\n') + '\n');

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await files(path.join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result.sort();
}
const resources = await files(output), known = new Set(resources);
for (const file of resources.filter(name => /\.(html|css|js)$/.test(name))) {
  const content = await readFile(path.join(output, file), 'utf8');
  if (file === 'index.html' && /(?:src|href)=["'](?:https?:)?\/\//.test(content)) throw new Error('App 入口不能加载远程资源。');
  // Vite emits imports and assets as quoted relative URLs in JS, CSS and HTML.
  const expressions = /["'(]((?:\.\.?\/|\/assets\/)[^"'()\s<>]+\.(?:js|css|mp3|png|svg|woff2?))(?:[?#][^"'()\s<>]*)?["')]/g;
  for (const match of content.matchAll(expressions)) {
    const reference = decodeURIComponent(match[1]);
    const target = reference.startsWith('/') ? reference.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(file), reference));
    if (!known.has(target)) throw new Error(`${file} 引用了缺失资源 ${reference}`);
  }
}
if (!resources.some(name => /national-map-.*\.js$/.test(name)) || !resources.some(name => name.endsWith('.mp3'))) throw new Error('内置地图或音乐资源缺失。');
const manifest = await Promise.all(resources.map(async name => {
  const data = await readFile(path.join(output, name));
  return { path: name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}));
await writeFile(path.join(output, 'app-resources.json'), JSON.stringify({ ...app, resources: manifest }, null, 2) + '\n');
console.log(`iOS 网页资源已准备：${resources.length} 个文件，${(manifest.reduce((sum, file) => sum + file.bytes, 0) / 1e6).toFixed(2)} MB，无 maps/ 副本。`);
