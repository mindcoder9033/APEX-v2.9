import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  const sizes = [16, 32, 48, 64, 128, 256, 512];
  const pngBuffers = [];

  // Read SVG files
  const standaloneSvg = fs.readFileSync(path.join(publicDir, 'apex-icon.svg'), 'utf8');
  const appSvg = fs.readFileSync(path.join(publicDir, 'apex-app-icon.svg'), 'utf8');

  // Helper to render SVG at specific resolution
  async function renderSvg(svgContent, size) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; }
          svg { width: 100%; height: 100%; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;
    win.setContentSize(size, size);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // Wait a brief moment for rendering/filters to settle
    await new Promise(r => setTimeout(r, 100));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    return image.toPNG();
  }

  console.log('Rendering App Icons (Framed)...');
  for (const size of sizes) {
    const pngBuf = await renderSvg(appSvg, size);
    fs.writeFileSync(path.join(publicDir, `apex-app-icon-${size}.png`), pngBuf);
    if ([16, 32, 48, 256].includes(size)) {
      pngBuffers.push({ size, buffer: pngBuf });
    }
    console.log(`Saved apex-app-icon-${size}.png`);
  }
  // Master 512 app icon
  const masterAppIcon = await renderSvg(appSvg, 512);
  fs.writeFileSync(path.join(publicDir, 'apex-app-icon.png'), masterAppIcon);

  console.log('Rendering Standalone Icons (Glyph)...');
  for (const size of sizes) {
    const pngBuf = await renderSvg(standaloneSvg, size);
    fs.writeFileSync(path.join(publicDir, `apex-icon-${size}.png`), pngBuf);
    console.log(`Saved apex-icon-${size}.png`);
  }
  const masterIcon = await renderSvg(standaloneSvg, 512);
  fs.writeFileSync(path.join(publicDir, 'apex-icon.png'), masterIcon);
  fs.writeFileSync(path.join(publicDir, 'apex-logo.png'), masterIcon);

  // Build multi-image ICO binary
  // ICO header: 2 bytes reserved (0), 2 bytes type (1 = icon), 2 bytes count
  function createIco(images) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);

    const dirEntrySize = 16;
    let dataOffset = 6 + images.length * dirEntrySize;
    const entries = [];
    const imageBuffers = [];

    for (const img of images) {
      const entry = Buffer.alloc(16);
      const width = img.size >= 256 ? 0 : img.size;
      const height = img.size >= 256 ? 0 : img.size;
      entry.writeUInt8(width, 0); // Width
      entry.writeUInt8(height, 1); // Height
      entry.writeUInt8(0, 2); // Color palette
      entry.writeUInt8(0, 3); // Reserved
      entry.writeUInt16LE(1, 4); // Color planes
      entry.writeUInt16LE(32, 6); // Bits per pixel
      entry.writeUInt32LE(img.buffer.length, 8); // Size of image data
      entry.writeUInt32LE(dataOffset, 12); // Offset to image data

      entries.push(entry);
      imageBuffers.push(img.buffer);
      dataOffset += img.buffer.length;
    }

    return Buffer.concat([header, ...entries, ...imageBuffers]);
  }

  const icoBuffer = createIco(pngBuffers);
  fs.writeFileSync(path.join(publicDir, 'apex-icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'apex icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'apex-logo.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Successfully created multi-res ICO files: apex-icon.ico, apex icon.ico, favicon.ico');

  app.quit();
});
