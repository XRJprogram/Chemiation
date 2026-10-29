/**
 * Chemiation - Production Frontend Asset Staging for Tauri Packaging
 * Isolates static web files (index.html, css, js, docs) into dist/
 * to prevent packaging src-tauri, node_modules, and server code into the desktop binary.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const assets = ['index.html', 'docs.html', 'docs_en.html', 'css', 'js', 'favicon.png'];
for (const item of assets) {
  const srcPath = path.join(rootDir, item);
  const destPath = path.join(distDir, item);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
  }
}

console.log('[Build] Successfully staged frontend assets to dist/');
