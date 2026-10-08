import path from 'node:path';
import {
  MODULE_RECIPES,
  PRESETS,
  SHIPPED_MODULES,
} from '@bear1210/native-kit-protocol';
import { detectPlatform } from './detect.js';
import { readConfig, writeConfig } from './config.js';
import { applyAndroidPermissions, applyIosUsageDescriptions } from './platform-decls.js';
import { ensureFlutterDependency, ensureRnDependency } from './deps.js';
import { writeHelperSnippets } from './snippets.js';

/**
 * @param {string[]} raw
 * @returns {string[]}
 */
export function resolveModulesFromFlags(raw) {
  /** @type {Set<string>} */
  const set = new Set();
  for (const token of raw) {
    if (!token) continue;
    if (token.startsWith('preset:')) {
      const name = token.slice('preset:'.length);
      const preset = PRESETS[name];
      if (!preset) {
        throw new Error(`Unknown preset "${name}". Known: ${Object.keys(PRESETS).join(', ')}`);
      }
      for (const id of preset) set.add(id);
      continue;
    }
    for (const part of token.split(',')) {
      const id = part.trim();
      if (!id) continue;
      if (!MODULE_RECIPES[id] && !SHIPPED_MODULES.includes(id)) {
        throw new Error(
          `Unknown or unshipped NativeKit module "${id}". Shipped: ${SHIPPED_MODULES.join(', ')}`
        );
      }
      set.add(id);
    }
  }
  return [...set].sort();
}

/**
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string[]} opts.modules
 * @param {'rn' | 'flutter'} [opts.platform]
 * @param {string} [opts.displayName]
 * @param {(dest: string) => Promise<void>} [opts.installFlutterPackage]
 */
export async function applyModules(opts) {
  const projectDir = path.resolve(opts.projectDir);
  const platform = opts.platform ?? (await detectPlatform(projectDir));
  if (!platform) {
    throw new Error(
      `Could not detect RN or Flutter project at ${projectDir}. Pass platform explicitly.`
    );
  }

  const modules = [...new Set(opts.modules)].sort();
  for (const id of modules) {
    if (!SHIPPED_MODULES.includes(id)) {
      throw new Error(`Module "${id}" is not shipped yet.`);
    }
  }

  const displayName =
    opts.displayName ??
    path.basename(projectDir).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  await writeConfig(projectDir, { modules });

  // Package ships permission + device; enable when any shipped module is selected.
  const enableNativeKit = modules.some((id) => SHIPPED_MODULES.includes(id));
  if (platform === 'rn') {
    await ensureRnDependency(projectDir, enableNativeKit);
  } else {
    await ensureFlutterDependency(projectDir, enableNativeKit, {
      installFlutterPackage: opts.installFlutterPackage,
    });
  }

  if (modules.length > 0) {
    await applyIosUsageDescriptions(projectDir, modules, displayName);
    await applyAndroidPermissions(projectDir, modules);
  }

  await writeHelperSnippets(projectDir, platform, modules);

  return { projectDir, platform, modules };
}

/**
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string[]} opts.add
 * @param {'rn' | 'flutter'} [opts.platform]
 * @param {string} [opts.displayName]
 */
export async function addModules(opts) {
  const current = await readConfig(opts.projectDir);
  const next = resolveModulesFromFlags([...current.modules, ...opts.add]);
  return applyModules({
    projectDir: opts.projectDir,
    modules: next,
    platform: opts.platform,
    displayName: opts.displayName,
  });
}

/**
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string[]} opts.remove
 * @param {'rn' | 'flutter'} [opts.platform]
 * @param {string} [opts.displayName]
 */
export async function removeModules(opts) {
  const current = await readConfig(opts.projectDir);
  const removeSet = new Set(opts.remove);
  const next = current.modules.filter((id) => !removeSet.has(id));
  return applyModules({
    projectDir: opts.projectDir,
    modules: next,
    platform: opts.platform,
    displayName: opts.displayName,
  });
}

export { readConfig, detectPlatform, PRESETS, SHIPPED_MODULES };
