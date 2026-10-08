import path from 'node:path';
import fs from 'fs-extra';
import { MODULE_RECIPES } from '@bear1210/native-kit-protocol';

/**
 * @param {string} projectDir
 * @param {string[]} modules
 * @param {string} displayName
 */
export async function applyIosUsageDescriptions(projectDir, modules, displayName) {
  const infoPlist = path.join(projectDir, 'ios', 'Runner', 'Info.plist');
  const altPlist = path.join(
    projectDir,
    'ios',
    path.basename(projectDir),
    'Info.plist'
  );
  const candidates = [infoPlist, altPlist];
  // RN apps often use ios/<AppName>/Info.plist
  const iosDir = path.join(projectDir, 'ios');
  if (await fs.pathExists(iosDir)) {
    const entries = await fs.readdir(iosDir);
    for (const entry of entries) {
      const candidate = path.join(iosDir, entry, 'Info.plist');
      if (await fs.pathExists(candidate)) candidates.push(candidate);
    }
  }

  const keys = [];
  for (const id of modules) {
    const recipe = MODULE_RECIPES[id];
    if (!recipe?.iosUsageDescriptions) continue;
    for (const item of recipe.iosUsageDescriptions) {
      keys.push({
        key: item.key,
        value: item.defaultValue.replaceAll('{displayName}', displayName),
      });
    }
  }
  if (keys.length === 0) return;

  const seen = new Set();
  for (const file of candidates) {
    if (seen.has(file) || !(await fs.pathExists(file))) continue;
    seen.add(file);
    let content = await fs.readFile(file, 'utf8');
    let changed = false;
    for (const { key, value } of keys) {
      if (content.includes(`<key>${key}</key>`)) continue;
      content = content.replace(
        '</dict>\n</plist>',
        `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>\n</plist>`
      );
      changed = true;
    }
    if (changed) await fs.writeFile(file, content, 'utf8');
  }
}

/**
 * @param {string} projectDir
 * @param {string[]} modules
 */
export async function applyAndroidPermissions(projectDir, modules) {
  const manifestPath = path.join(
    projectDir,
    'android',
    'app',
    'src',
    'main',
    'AndroidManifest.xml'
  );
  if (!(await fs.pathExists(manifestPath))) return;

  let content = await fs.readFile(manifestPath, 'utf8');
  const inserts = [];

  for (const id of modules) {
    const recipe = MODULE_RECIPES[id];
    if (!recipe) continue;
    for (const permission of recipe.androidPermissions ?? []) {
      if (!content.includes(permission)) {
        inserts.push(`    <uses-permission android:name="${permission}"/>`);
      }
    }
    for (const feature of recipe.androidFeatures ?? []) {
      if (!content.includes(feature.name)) {
        inserts.push(
          `    <uses-feature android:name="${feature.name}" android:required="${feature.required ? 'true' : 'false'}"/>`
        );
      }
    }
  }

  if (inserts.length === 0) return;
  content = content.replace(/(<manifest\b[^>]*>)/, `$1\n${inserts.join('\n')}`);
  await fs.writeFile(manifestPath, content, 'utf8');
}
