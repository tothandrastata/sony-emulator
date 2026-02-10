/**
 * Sony Emulator Build Script
 * Creates distribution package
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const version = packageJson.version;
const zipName = `sony-bravia-ssip-emulator-v${version}.zip`;
const distDir = path.join(__dirname, 'dist');
const stagingDir = path.join(distDir, 'staging');
const zipPath = path.join(__dirname, zipName);

async function build() {
    console.log('Sony Bravia SSIP Emulator - Production Build');
    console.log('============================================');
    console.log(`Version: ${version}\n`);

    // 1. Clean dist directory
    console.log('1. Cleaning dist directory...');
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    // 2. Prepare staging area
    console.log('2. Preparing staging area...');
    const filesToCopy = [
        'index.js',
        'bravia-emulator.js',
        'ssip-protocol.js',
        'TcpServer.js',
        'WebServer.js',
        'README.md',
        '.env.example'
    ];

    for (const file of filesToCopy) {
        const src = path.join(__dirname, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(stagingDir, file));
        } else {
            console.warn(`Warning: ${file} not found, skipping.`);
        }
    }

    // Copy web folder
    const webSrc = path.join(__dirname, 'standalonewebstatic');
    if (fs.existsSync(webSrc)) {
        // Need to copy to 'standalonewebstatic' in staging to match code expectation
        // Code expects: path.join(__dirname, 'standalonewebstatic')
        fs.mkdirSync(path.join(stagingDir, 'standalonewebstatic'), { recursive: true });
        fs.cpSync(webSrc, path.join(stagingDir, 'standalonewebstatic'), { recursive: true });
    }

    // 3. Create distribution package.json
    console.log('3. Creating distribution package.json...');
    const distPkg = {
        name: 'sony-bravia-ssip-emulator',
        version: version,
        description: 'Sony Bravia SSIP Emulator',
        main: 'index.js',
        type: "module",
        scripts: {
            start: 'node index.js'
        },
        dependencies: {
            fastify: '^4.29.1',
            '@fastify/static': '^6.12.0',
            '@fastify/cors': '^8.5.0'
        },
        engines: {
            node: '>=16.0.0'
        }
    };

    fs.writeFileSync(
        path.join(stagingDir, 'package.json'),
        JSON.stringify(distPkg, null, 2)
    );

    // 4. Install production dependencies
    console.log('4. Installing production dependencies...');
    try {
        execSync('npm install --omit=dev', { cwd: stagingDir, stdio: 'inherit' });
    } catch (error) {
        console.error('Failed to install dependencies:', error.message);
        process.exit(1);
    }

    // 5. Create ZIP archive
    console.log('5. Creating distribution archive...');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        console.log(`\n✓ Build complete!`);
        console.log(`✓ Archive: ${zipName} (${sizeMB} MB)`);
        console.log(`✓ Path: ${zipPath}`);
    });

    archive.on('error', (err) => { throw err; });
    archive.pipe(output);
    archive.directory(stagingDir, false);
    archive.finalize();
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
