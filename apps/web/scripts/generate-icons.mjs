// Genera los íconos de la app a partir de una sola figura: el visor del dron (las cuatro esquinas del
// encuadre) con una detección en el centro (el anillo amarillo del modelo alrededor de un animal visto
// desde arriba). Es la misma marca de `src/presentation/ui/brand.tsx`.
//
// Uso: npm run icons -w @hatoscan/web
// Escribe en src/app: icon.svg (pestañas modernas), favicon.ico (16, 32 y 48 px) y apple-icon.png.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const APP_DIR = new URL('../src/app/', import.meta.url);

// Colores fijos: un ícono no puede leer los tokens CSS de la app (ver styles/tokens.css).
const TILE = '#0f1d16'; // --viewport, un punto más verde para que se distinga de una pestaña oscura
const INK = '#dfe8e1'; // --hud-ink
const MODEL = '#ffd400'; // --mark-model

/** Contenido sobre una cuadrícula de 32 × 32. */
const MARK = `
  <path d="M6.5 11.5V6.5h5M20.5 6.5h5v5M25.5 20.5v5h-5M11.5 25.5h-5v-5" fill="none" stroke="${INK}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="16" r="5.4" fill="none" stroke="${MODEL}" stroke-width="2.1"/>
  <ellipse cx="16" cy="16" rx="2.5" ry="1.45" transform="rotate(-30 16 16)" fill="${INK}"/>`;

/** Pestañas: esquinas redondeadas propias. */
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7.5" fill="${TILE}"/>${MARK}
</svg>
`;

/** iOS redondea el ícono por su cuenta: fondo a sangre y la marca un poco más adentro. */
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${TILE}"/>
  <g transform="translate(3.2 3.2) scale(0.8)">${MARK}</g>
</svg>`;

const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: (72 * size) / 8 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Contenedor ICO con imágenes PNG dentro (válido desde Windows Vista y en todos los navegadores). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const sizes = [16, 32, 48];
const icoImages = await Promise.all(
  sizes.map(async (size) => ({ size, png: await render(iconSvg, size) })),
);

await writeFile(new URL('icon.svg', APP_DIR), iconSvg);
await writeFile(new URL('favicon.ico', APP_DIR), ico(icoImages));
await writeFile(new URL('apple-icon.png', APP_DIR), await render(appleSvg, 180));
console.log('Íconos generados en src/app: icon.svg, favicon.ico, apple-icon.png');
