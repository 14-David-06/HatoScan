import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

/** Capas que una capa NO puede importar. Regla: presentation -> application -> domain <- infrastructure */
const layer = (files, forbidden, extra = []) => ({
  files,
  // Los tests pueden usar fakes, vitest y cualquier capa.
  ignores: ['**/*.test.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...forbidden.map((name) => ({
            group: [`@/${name}/*`, `**/${name}/**`],
            message: `Esta capa no puede depender de "${name}" (ver CLAUDE.md §4).`,
          })),
          ...extra,
        ],
      },
    ],
  },
});

export default tseslint.config(
  { ignores: ['.next/**', 'next-env.d.ts', 'coverage/**'] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  layer(
    ['src/domain/**'],
    ['application', 'infrastructure', 'presentation', 'app'],
    [
      {
        regex: '^(?!\\.|@/domain/)',
        message: 'El dominio no tiene dependencias externas.',
      },
    ],
  ),
  layer(
    ['src/application/**'],
    ['infrastructure', 'presentation', 'app'],
    [
      {
        group: ['@hatoscan/*', 'zod', 'next', 'next/*'],
        message: 'Application depende solo de domain.',
      },
    ],
  ),
  layer(['src/infrastructure/**'], ['application', 'presentation', 'app']),
  layer(['src/presentation/**'], ['infrastructure', 'app']),
);
