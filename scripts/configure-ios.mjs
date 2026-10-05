import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const app = JSON.parse(await readFile(new URL('ios-app.json', root), 'utf8'));
if (!/^[a-zA-Z][\w]*(\.[\w]+){2,}$/.test(app.appId) || !/^\d+\.\d+\.\d+$/.test(app.version) || !Number.isSafeInteger(app.buildNumber) || app.buildNumber < 1) {
  throw new Error('ios-app.json 中的 Bundle ID、版本或 build number 无效');
}
const project = new URL('ios/App/App.xcodeproj/project.pbxproj', root);
let pbx = await readFile(project, 'utf8');
for (const [key, value] of Object.entries({ IPHONEOS_DEPLOYMENT_TARGET: '17.0', TARGETED_DEVICE_FAMILY: '1', MARKETING_VERSION: app.version, CURRENT_PROJECT_VERSION: app.buildNumber, PRODUCT_BUNDLE_IDENTIFIER: app.appId })) {
  const pattern = new RegExp(`(${key} = )[^;]+;`, 'g');
  if (!pattern.test(pbx)) throw new Error(`Xcode 工程缺少 ${key}`);
  pbx = pbx.replace(pattern, `$1${value};`);
}
// CLI sync rewrites the Swift package, so apply the deployment target afterwards.
const swift = new URL('ios/App/CapApp-SPM/Package.swift', root);
await writeFile(swift, (await readFile(swift, 'utf8')).replace(/\.iOS\(\.v\d+\)/, '.iOS(.v17)'));
if (!pbx.includes('PrivacyInfo.xcprivacy')) {
  pbx = pbx.replace('/* Begin PBXBuildFile section */', '/* Begin PBXBuildFile section */\n\t\tA10500000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = A10500000000000000000002 /* PrivacyInfo.xcprivacy */; };');
  pbx = pbx.replace('/* Begin PBXFileReference section */', '/* Begin PBXFileReference section */\n\t\tA10500000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };');
  pbx = pbx.replace('504EC3131FED79650016851F /* Info.plist */,', '504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tA10500000000000000000002 /* PrivacyInfo.xcprivacy */,');
  pbx = pbx.replace('504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,', '504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,\n\t\t\t\tA10500000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,');
}
await writeFile(project, pbx);
console.log(`iPhone / iOS 17+ · ${app.appId} · ${app.version} (${app.buildNumber})`);
