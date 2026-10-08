import path from 'node:path';
import fs from 'fs-extra';

const CONFIG_NAME = 'native-kit.config.json';

/**
 * @param {string} projectDir
 */
export function configPath(projectDir) {
  return path.join(projectDir, CONFIG_NAME);
}

/**
 * @param {string} projectDir
 * @returns {Promise<{ modules: string[] }>}
 */
export async function readConfig(projectDir) {
  const file = configPath(projectDir);
  if (!(await fs.pathExists(file))) {
    return { modules: [] };
  }
  const data = await fs.readJson(file);
  const modules = Array.isArray(data.modules)
    ? data.modules.filter((m) => typeof m === 'string')
    : [];
  return { modules: [...new Set(modules)].sort() };
}

/**
 * @param {string} projectDir
 * @param {{ modules: string[] }} config
 */
export async function writeConfig(projectDir, config) {
  const modules = [...new Set(config.modules)].sort();
  await fs.writeJson(configPath(projectDir), { modules }, { spaces: 2 });
  return { modules };
}
