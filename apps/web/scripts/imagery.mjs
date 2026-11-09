// Imágenes de la interfaz (portada, ingreso, estado vacío): las genera un modelo de imagen de OpenAI
// y Claude marca los animales que se ven en ellas, para animar las detecciones encima de la foto.
// Son ilustraciones generadas, no fotos de un vuelo real: la interfaz las presenta como «Ejemplo».
//
// Uso (desde la raíz del repo; lee las llaves de apps/web/.env.local):
//   npm run imagery -w @hatoscan/web -- generate <nombre>          una variante en .imagery/ para elegir
//   npm run imagery -w @hatoscan/web -- publish <nombre> <png>     la elegida → src/presentation/assets
//
// `publish` escribe <nombre>.webp y, si la imagen lleva animales, <nombre>.marks.ts con sus cajas en
// píxeles de la imagen (origen arriba a la izquierda) y una vista previa de las marcas en .imagery/
// para revisarlas antes de subirlas. Cada corrida cuesta: no va en CI.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import sharp from 'sharp';
import * as z from 'zod/v4';

const ROOT = new URL('../', import.meta.url);
const DRAFTS = new URL('.imagery/', ROOT);
const ASSETS = new URL('src/presentation/assets/', ROOT);
const path = (url) => fileURLToPath(url);

const IMAGE_MODEL = 'gpt-image-2.6-sunburst';
const VISION_MODEL = 'claude-opus-5-5';

const NADIR =
  'Straight-down nadir aerial photograph (camera pointing 90 degrees down) taken by a survey drone';
const CLEAN =
  'Realistic documentary drone photography, sharp natural detail. No people, no text, no watermark, no vignette, no tilt-shift, no perspective.';

/** Cada imagen de la interfaz: dónde se usa, cómo se pide y si hay animales que marcar. */
const IMAGES = {
  'hero-herd': {
    use: 'Portada: el visor con la revisión animada',
    size: '2048x1360',
    marks: true,
    prompt: `${NADIR} at about 60 m altitude over a cattle pasture in the Llanos Orientales of Colombia. A herd of about 40 water buffalo with dark charcoal-grey to black hides, seen exactly from above as compact oval bodies with short horns, grazing and resting in loose groups across the frame; four of them stand in a shallow muddy pond in the lower right. Tropical brachiaria grass in varied greens with darker trampled paths and lighter dry patches, a reddish dirt cattle track crossing diagonally, two isolated trees in the upper left whose canopies are seen from above with crisp shadows. Early morning sun from the left gives each animal a short soft shadow. Natural color, even exposure. ${CLEAN}`,
  },
  'login-herd': {
    use: 'Ingreso: el potrero a la izquierda del formulario',
    size: '2048x1536',
    marks: true,
    prompt: `${NADIR} at golden hour over the Llanos Orientales of Colombia: a winding stream lined with moriche palms (palm crowns seen from above as star shapes) cuts through a wide pasture of tall green and golden grass. A small herd of about 14 water buffalo with dark charcoal hides, seen exactly from above, walk in a loose line along a muddy trail toward the water, casting long thin shadows to the right. Fine texture of grass, cattle paths and mud. Calm and cinematic but realistic, natural color with warm low sun, deep greens. ${CLEAN}`,
  },
  'empty-pasture': {
    use: 'Lista de conteos vacía: un potrero esperando su primer conteo',
    size: '1024x1024',
    marks: false,
    // Se muestra pequeña: basta con 800 px.
    width: 800,
    prompt: `${NADIR} at about 80 m altitude over an empty pasture in the Llanos Orientales of Colombia, with no animals at all: soft green brachiaria grass with subtle mowing texture, a reddish dirt cattle track curving gently through the frame, a single moriche palm crown seen from above near one corner with its shadow, a few darker clumps of grass. Soft overcast morning light, muted natural greens, calm and minimal composition with plenty of open grass. ${CLEAN}`,
  },
};

const MarksSchema = z.object({
  animals: z.array(
    z.object({
      x: z.number().describe('Centro del animal, píxeles horizontales de la imagen'),
      y: z.number().describe('Centro del animal, píxeles verticales de la imagen'),
      w: z.number().describe('Ancho de la caja que encierra el cuerpo, en píxeles'),
      h: z.number().describe('Alto de la caja que encierra el cuerpo, en píxeles'),
    }),
  ),
});

const MARKS_PROMPT = `Recibes una foto aérea cenital de un potrero tomada con dron. Marca cada animal \
(búfala o bovino) con la caja que encierra su cuerpo, en píxeles de la imagen que recibes (origen \
arriba a la izquierda): centro x, y y tamaño w, h. Un animal por caja, también los echados, los que \
están en el agua y los pegados a otros. No marques sombras, árboles, arbustos, palmas ni charcos.`;

function loadEnv() {
  const file = new URL('.env.local', ROOT);
  if (existsSync(file)) process.loadEnvFile(file);
}

function spec(name) {
  const image = IMAGES[name];
  if (!image) {
    throw new Error(`Imagen desconocida "${name}". Opciones: ${Object.keys(IMAGES).join(', ')}`);
  }
  return image;
}

async function generate(name) {
  const { size, prompt } = spec(name);
  if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY en .env.local');
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size,
      quality: 'high',
      output_format: 'png',
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${body.error?.message}`);
  await mkdir(DRAFTS, { recursive: true });
  const file = new URL(`${name}-${Date.now()}.png`, DRAFTS);
  await writeFile(file, Buffer.from(body.data[0].b64_json, 'base64'));
  console.log(`Variante lista: ${path(file)}`);
}

async function locate(png) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en .env.local');
  const { width, height } = await sharp(png).metadata();
  // JPEG casi sin pérdida: el PNG de 2048 px pasa del límite de 10 MB por imagen de la API.
  const jpeg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.beta.messages.parse({
    model: VISION_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: betaZodOutputFormat(MarksSchema) },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') },
          },
          { type: 'text', text: `${MARKS_PROMPT}\nLa imagen mide ${width}x${height} px.` },
        ],
      },
    ],
  });
  if (!response.parsed_output)
    throw new Error(`Claude no devolvió marcas (${response.stop_reason})`);
  return response.parsed_output.animals
    .map(({ x, y, w, h }) => ({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Vista previa para que una persona revise las cajas antes de publicarlas. */
async function preview(name, png, marks) {
  const { width, height } = await sharp(png).metadata();
  const boxes = marks
    .map(
      (m) =>
        `<rect x="${m.x - m.w / 2}" y="${m.y - m.h / 2}" width="${m.w}" height="${m.h}" fill="none" stroke="#ffd400" stroke-width="3"/>`,
    )
    .join('');
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${boxes}</svg>`,
  );
  const file = new URL(`${name}-marks.png`, DRAFTS);
  await sharp(png)
    .composite([{ input: overlay }])
    .png()
    .toFile(path(file));
  console.log(`Revisa las marcas: ${path(file)}`);
}

async function publish(name, source) {
  const image = spec(name);
  const png = await readFile(source);
  await mkdir(ASSETS, { recursive: true });
  // Las que llevan marcas conservan su tamaño: las cajas están en píxeles de la imagen generada.
  const out = sharp(png);
  if (image.width && !image.marks) out.resize(image.width);
  const { width, height } = await out
    .webp({ quality: 78, effort: 6 })
    .toFile(path(new URL(`${name}.webp`, ASSETS)));
  console.log(`Publicada: src/presentation/assets/${name}.webp (${width}x${height})`);
  if (!image.marks) return;

  const marks = await locate(png);
  await mkdir(DRAFTS, { recursive: true });
  await preview(name, png, marks);
  const constName = name.replace(/-/g, '_').toUpperCase();
  const marksModule = `// Generado por scripts/imagery.mjs (${VISION_MODEL}) y revisado a ojo. Puede corregirse a mano.
// Cajas de los animales de ${name}.webp, en píxeles de la imagen, origen arriba a la izquierda.
import type { ImageMarks } from './marks';

export const ${constName}_MARKS: ImageMarks = {
  width: ${width},
  height: ${height},
  animals: [
${marks.map((m) => `    { x: ${m.x}, y: ${m.y}, w: ${m.w}, h: ${m.h} },`).join('\n')}
  ],
};
`;
  await writeFile(new URL(`${name}.marks.ts`, ASSETS), marksModule);
  console.log(`Marcas: src/presentation/assets/${name}.marks.ts (${marks.length} animales)`);
}

loadEnv();
const [command, name, file] = process.argv.slice(2);
if (command === 'generate' && name) await generate(name);
else if (command === 'publish' && name && file) await publish(name, file);
else {
  console.log('Uso: imagery generate <nombre> | imagery publish <nombre> <png>');
  for (const [key, { use }] of Object.entries(IMAGES)) console.log(`  ${key}: ${use}`);
  process.exitCode = 1;
}
