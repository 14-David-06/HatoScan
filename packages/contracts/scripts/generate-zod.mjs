// Genera validadores Zod a partir de /schemas. Los JSON Schema son la fuente de verdad:
// no edites src/generated a mano, ejecuta `npm run contracts:generate`.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import { jsonSchemaToZod } from 'json-schema-to-zod';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schemasDir = path.join(root, 'schemas');
const outDir = path.join(root, 'src', 'generated');

const files = (await readdir(schemasDir)).filter((f) => f.endsWith('.schema.json')).sort();
await mkdir(outDir, { recursive: true });

const indexLines = [];
for (const file of files) {
  const raw = JSON.parse(await readFile(path.join(schemasDir, file), 'utf8'));
  const schema = await $RefParser.dereference(path.join(schemasDir, file), raw);
  const name = `${schema.title}Schema`;
  const moduleName = file.replace('.schema.json', '');
  // z.any() filtraría `any` a los tipos inferidos; el proyecto exige `unknown`.
  const code = jsonSchemaToZod(schema, { name, module: 'esm', type: schema.title }).replaceAll(
    'z.any()',
    'z.unknown()',
  );
  const header = `// AUTO-GENERADO desde schemas/${file}. No editar.\n`;
  await writeFile(path.join(outDir, `${moduleName}.ts`), header + code);
  indexLines.push(`export * from './${moduleName}';`);
}
await writeFile(
  path.join(outDir, 'index.ts'),
  `// AUTO-GENERADO. No editar.\n${indexLines.join('\n')}\n`,
);
console.log(`Generados ${files.length} validadores en src/generated`);
