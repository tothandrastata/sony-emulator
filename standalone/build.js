/**
 * Production Build Script
 * Creates distribution package with all files and dependencies
 * Generates both standalone and LARA-ISC module formats
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, 'dist');
const distStandalone = path.join(distDir, 'standalone');
const distLaraISC = path.join(distDir, 'lara-isc-module');
const version = require('./package.json').version;

console.log('Sony SSIP Emulator - Production Build');
console.log('=====================================');
console.log('');

// 1. Clean dist directory
console.log('1. Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distStandalone, { recursive: true });
fs.mkdirSync(distLaraISC, { recursive: true });

// 2. Build Standalone Version
console.log('2. Building standalone version...');
const standaloneFiles = [
  'main.js',
  'SsipServer.js',
  'WebServer.js',
  'SonyEmulator.js',
  'ssip-protocol.js'
];

standaloneFiles.forEach(file => {
  fs.copyFileSync(file, path.join(distStandalone, file));
});

fs.cpSync('web', path.join(distStandalone, 'web'), { recursive: true });
fs.copyFileSync('.env.example', path.join(distStandalone, '.env.example'));
if (fs.existsSync('.env')) {
  fs.copyFileSync('.env', path.join(distStandalone, '.env'));
} else {
  fs.copyFileSync('.env.example', path.join(distStandalone, '.env'));
}
fs.copyFileSync('start.sh', path.join(distStandalone, 'start.sh'));
fs.copyFileSync('README.md', path.join(distStandalone, 'README.md'));

const standalonePkg = {
  name: 'sony-ssip-emulator-standalone',
  version: version,
  description: 'Sony Bravia SSIP Protocol Emulator with Web Interface - Standalone',
  main: 'main.js',
  scripts: {
    start: 'node main.js'
  },
  dependencies: {
    fastify: '^4.29.1',
    '@fastify/static': '^6.12.0',
    '@fastify/cors': '^8.5.0',
    dotenv: '^17.2.3'
  },
  engines: {
    node: '>=16.0.0'
  }
};

fs.writeFileSync(
  path.join(distStandalone, 'package.json'),
  JSON.stringify(standalonePkg, null, 2)
);

// 3. Build LARA-ISC Module Version
console.log('3. Building LARA-ISC module version...');

// Check if LARA driver exists
const laraDriverSource = path.join(__dirname, '..', 'lara-driver', 'LARA_SonyEmulator');

if (fs.existsSync(laraDriverSource)) {
  console.log('   Found LARA driver source, copying files...');

  // Copy LARA driver files
  const laraFiles = ['app.js', 'bravia-emulator.js', 'ssip-protocol.js',
                     'moduledescriptor.json', 'parameters.json', 'event-templates.json'];

  laraFiles.forEach(file => {
    const srcPath = path.join(laraDriverSource, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(distLaraISC, file));
    }
  });

  // Copy package.json from LARA driver if exists
  const laraPkgPath = path.join(laraDriverSource, 'package.json');
  if (fs.existsSync(laraPkgPath)) {
    fs.copyFileSync(laraPkgPath, path.join(distLaraISC, 'package.json'));
  }

  console.log('   LARA-ISC module created successfully');
} else {
  console.log('   LARA driver source not found, skipping LARA-ISC module');
}

// 4. Install standalone dependencies
console.log('4. Installing standalone dependencies...');
try {
  execSync('npm install --omit=dev', { cwd: distStandalone, stdio: 'inherit' });
} catch (error) {
  console.error('Failed to install dependencies:', error.message);
  process.exit(1);
}

// 5. Create ZIP archives
console.log('5. Creating distribution archives...');
const archiver = require('archiver');

// Standalone ZIP
const standaloneOutput = fs.createWriteStream(`sony-ssip-emulator-standalone-v${version}.zip`);
const standaloneArchive = archiver('zip', { zlib: { level: 9 } });

standaloneArchive.on('error', (err) => {
  throw err;
});

standaloneOutput.on('close', () => {
  const sizeMB = (standaloneArchive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`   ✓ Standalone: sony-ssip-emulator-standalone-v${version}.zip (${sizeMB} MB)`);
});

standaloneArchive.pipe(standaloneOutput);
standaloneArchive.directory(distStandalone, false);
standaloneArchive.finalize();

// LARA-ISC Module ZIP (if exists)
if (fs.existsSync(laraDriverSource) && fs.existsSync(distLaraISC)) {
  const laraOutput = fs.createWriteStream(`sony-ssip-emulator-lara-isc-v${version}.zip`);
  const laraArchive = archiver('zip', { zlib: { level: 9 } });

  laraArchive.on('error', (err) => {
    throw err;
  });

  laraOutput.on('close', () => {
    const sizeMB = (laraArchive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`   ✓ LARA-ISC: sony-ssip-emulator-lara-isc-v${version}.zip (${sizeMB} MB)`);
    console.log('');
    console.log('✓ Build complete!');
    console.log('');
  });

  laraArchive.pipe(laraOutput);
  laraArchive.directory(distLaraISC, false);
  laraArchive.finalize();
} else {
  setTimeout(() => {
    console.log('');
    console.log('✓ Build complete!');
    console.log('');
  }, 100);
}
