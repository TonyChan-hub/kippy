import path from 'node:path';
import fs from 'fs-extra';

/**
 * @param {string} projectDir
 * @returns {Promise<'rn' | 'flutter' | null>}
 */
export async function detectPlatform(projectDir) {
  const pubspec = path.join(projectDir, 'pubspec.yaml');
  const packageJson = path.join(projectDir, 'package.json');
  if (await fs.pathExists(pubspec)) {
    const text = await fs.readFile(pubspec, 'utf8');
    if (text.includes('flutter:')) return 'flutter';
  }
  if (await fs.pathExists(packageJson)) {
    const pkg = await fs.readJson(packageJson);
    if (pkg.dependencies?.['react-native'] || pkg.devDependencies?.['react-native']) {
      return 'rn';
    }
  }
  return null;
}
