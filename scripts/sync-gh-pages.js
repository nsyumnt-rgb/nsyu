const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'web', 'dist');
const docsDir = path.join(rootDir, 'docs');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  console.log('--- Syncing web/dist to root and docs for GitHub Pages ---');
  if (!fs.existsSync(distDir)) {
    console.error('Error: web/dist does not exist. Please run npm run build in web/ first.');
    process.exit(1);
  }

  // 1. Copy web/dist/assets to ./assets and ./docs/assets
  const distAssets = path.join(distDir, 'assets');
  if (fs.existsSync(distAssets)) {
    copyDirRecursive(distAssets, path.join(rootDir, 'assets'));
    copyDirRecursive(distAssets, path.join(docsDir, 'assets'));
    console.log('✔ Copied assets/ to root and docs/');
  }

  // 2. Copy web/dist/downloads to ./downloads and ./docs/downloads
  const distDownloads = path.join(distDir, 'downloads');
  if (fs.existsSync(distDownloads)) {
    copyDirRecursive(distDownloads, path.join(rootDir, 'downloads'));
    copyDirRecursive(distDownloads, path.join(docsDir, 'downloads'));
    console.log('✔ Copied downloads/ to root and docs/');
  }

  // 3. Copy web/dist/mlt and PTL
  ['mlt', 'PTL'].forEach(folder => {
    const src = path.join(distDir, folder);
    if (fs.existsSync(src)) {
      copyDirRecursive(src, path.join(rootDir, folder));
      copyDirRecursive(src, path.join(docsDir, folder));
      console.log(`✔ Copied ${folder}/ to root and docs/`);
    }
  });

  // 4. Copy index.html and create 404.html
  const distIndex = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    fs.copyFileSync(distIndex, path.join(rootDir, 'index.html'));
    fs.copyFileSync(distIndex, path.join(rootDir, '404.html'));
    fs.copyFileSync(distIndex, path.join(docsDir, 'index.html'));
    fs.copyFileSync(distIndex, path.join(docsDir, '404.html'));
    console.log('✔ Copied index.html and 404.html to root and docs/');
  }

  // 5. Ensure .nojekyll in root and docs
  fs.writeFileSync(path.join(rootDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');
  console.log('✔ Created .nojekyll in root and docs/');

  // 6. Copy static icons/logos to docs
  ['favicon.png', 'favicon.svg', 'icons.svg', 'logo.png', 'nsyu_logo.png'].forEach(file => {
    const src = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(docsDir, file));
    }
  });

  console.log('✔ GitHub Pages sync completed successfully.');
}

main();

