import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = path.join(root, 'dist-ios'), nativeRoot = path.join(root, 'ios/App/App/public');
const manifestData = await readFile(path.join(packageRoot, 'app-resources.json'));
const manifest = JSON.parse(manifestData);
if (!manifestData.equals(await readFile(path.join(nativeRoot, 'app-resources.json')))) throw new Error('原生资源清单未同步，请运行 npm run ios:sync。');
for (const resource of manifest.resources) {
  for (const directory of [packageRoot, nativeRoot]) {
    const data = await readFile(path.join(directory, resource.path));
    if (data.length !== resource.bytes || createHash('sha256').update(data).digest('hex') !== resource.sha256)
      throw new Error(`${directory}/${resource.path} 与资源清单不一致，请重新构建并同步。`);
  }
  if (resource.path === 'index.html' || resource.path.startsWith('assets/')) {
    const data = await readFile(path.join(root, 'dist', resource.path));
    if (createHash('sha256').update(data).digest('hex') !== resource.sha256) throw new Error(`网站与 App 的 ${resource.path} 不一致。`);
  }
}
console.log(`网站、iOS 本地包和原生工程资源一致：${manifest.resources.length} 个文件 SHA-256 通过。`);
