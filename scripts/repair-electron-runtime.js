const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');

async function main() {
  const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
  const distDir = path.join(electronDir, 'dist');
  const zipPath = await downloadArtifact({
    version: '42.3.0',
    artifactName: 'electron',
    platform: 'win32',
    arch: 'x64',
    checksums: require(path.join(electronDir, 'checksums.json'))
  });

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  await extract(zipPath, { dir: distDir });
  fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe');
  console.log('electron-runtime-ready');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
