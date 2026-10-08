#!/usr/bin/env node
import process from 'node:process';
import {
  addModules,
  removeModules,
  readConfig,
  detectPlatform,
  SHIPPED_MODULES,
} from '../lib/index.js';

function usage() {
  return `Usage:
  native-kit add <module...>
  native-kit remove <module...>
  native-kit list

Shipped modules: ${SHIPPED_MODULES.join(', ')}
`;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const projectDir = process.cwd();

  if (!command || command === '-h' || command === '--help') {
    process.stdout.write(usage());
    process.exit(command ? 0 : 1);
  }

  if (command === 'list') {
    const platform = await detectPlatform(projectDir);
    const config = await readConfig(projectDir);
    console.log(`platform: ${platform ?? 'unknown'}`);
    console.log(`modules: ${config.modules.length ? config.modules.join(', ') : '(none)'}`);
    console.log(`shipped: ${SHIPPED_MODULES.join(', ')}`);
    return;
  }

  if (command === 'add') {
    if (rest.length === 0) {
      console.error('Specify at least one module, e.g. native-kit add permission');
      process.exit(1);
    }
    const result = await addModules({ projectDir, add: rest });
    console.log(`NativeKit modules: ${result.modules.join(', ') || '(none)'}`);
    console.log('Next: install deps, then pod install (iOS) and rebuild.');
    if (result.platform === 'rn') {
      console.log('  npm install');
      console.log('  cd ios && pod install && cd ..');
    } else {
      console.log('  flutter pub get');
      console.log('  cd ios && pod install && cd ..');
    }
    return;
  }

  if (command === 'remove') {
    if (rest.length === 0) {
      console.error('Specify at least one module, e.g. native-kit remove permission');
      process.exit(1);
    }
    const result = await removeModules({ projectDir, remove: rest });
    console.log(`NativeKit modules: ${result.modules.join(', ') || '(none)'}`);
    console.log('Next: reinstall deps and rebuild.');
    return;
  }

  console.error(usage());
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
