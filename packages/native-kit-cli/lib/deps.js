import path from 'node:path';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(here, '../../..');
const monorepoNativeKitRn = path.resolve(here, '../../native_kit_rn');
const monorepoNativeKitFlutter = path.resolve(here, '../../native_kit_flutter');

/**
 * @param {string} projectDir
 */
function isInsideMonorepo(projectDir) {
  const resolved = path.resolve(projectDir);
  return resolved === monorepoRoot || resolved.startsWith(`${monorepoRoot}${path.sep}`);
}

/**
 * @param {string} projectDir
 * @param {boolean} enable
 */
export async function ensureRnDependency(projectDir, enable) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) return;
  const pkg = await fs.readJson(packageJsonPath);
  pkg.dependencies = pkg.dependencies ?? {};

  if (enable) {
    if (
      isInsideMonorepo(projectDir) &&
      (await fs.pathExists(path.join(monorepoNativeKitRn, 'package.json')))
    ) {
      const rel = path.relative(projectDir, monorepoNativeKitRn).split(path.sep).join('/');
      pkg.dependencies['@bear1210/native-kit-rn'] = `file:${rel}`;
    } else {
      pkg.dependencies['@bear1210/native-kit-rn'] = '^0.0.1';
    }
  } else {
    delete pkg.dependencies['@bear1210/native-kit-rn'];
  }

  await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
}

/**
 * @param {string} projectDir
 * @param {boolean} enable
 * @param {{ installFlutterPackage?: (dest: string) => Promise<void> }} [opts]
 */
export async function ensureFlutterDependency(projectDir, enable, opts = {}) {
  const pubspecPath = path.join(projectDir, 'pubspec.yaml');
  if (!(await fs.pathExists(pubspecPath))) return;
  let text = await fs.readFile(pubspecPath, 'utf8');

  const depBlock =
    /  native_kit_flutter:\n(?:    path: packages\/native_kit_flutter\n)?/;

  if (enable) {
    if (!text.includes('native_kit_flutter:')) {
      if (!/dependencies:\n/.test(text)) {
        throw new Error('pubspec.yaml missing dependencies: section');
      }
      text = text.replace(
        /dependencies:\n/,
        `dependencies:\n  native_kit_flutter:\n    path: packages/native_kit_flutter\n`
      );
      await fs.writeFile(pubspecPath, text, 'utf8');
    }
    if (opts.installFlutterPackage) {
      await opts.installFlutterPackage(path.join(projectDir, 'packages', 'native_kit_flutter'));
    } else if (await fs.pathExists(path.join(monorepoNativeKitFlutter, 'pubspec.yaml'))) {
      const dest = path.join(projectDir, 'packages', 'native_kit_flutter');
      await fs.ensureDir(path.join(projectDir, 'packages'));
      await fs.remove(dest);
      await fs.copy(monorepoNativeKitFlutter, dest, {
        filter: (src) => {
          const rel = path.relative(monorepoNativeKitFlutter, src).split(path.sep).join('/');
          if (!rel) return true;
          return ![
            '.dart_tool',
            'build',
            'example',
            'dist',
            'scripts',
            '.idea',
            'pubspec.lock',
          ].some((entry) => rel === entry || rel.startsWith(`${entry}/`));
        },
      });
    }
  } else {
    if (depBlock.test(text)) {
      text = text.replace(depBlock, '');
      await fs.writeFile(pubspecPath, text, 'utf8');
    }
    await fs.remove(path.join(projectDir, 'packages', 'native_kit_flutter'));
  }
}
