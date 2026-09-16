---
numero: 11
titulo: Lint con tipos, formato único y hook de pre-commit
estado: aceptada
fecha: 2026-09-16
fuente: specs/003-calidad-de-codigo/research.md
---

# ADR-011 — Lint con tipos, formato único y hook de pre-commit

## Contexto

`CLAUDE.md` exige "TypeScript `strict`. Sin `any`" y el compilador sólo prohíbe el `any`
implícito: un `as any`, una promesa sin manejar o un `!` pasaban `typecheck` y CI. No había
formateador y el estilo divergía entre sesiones de agentes distintos.

## Decisión

- **ESLint 10 + typescript-eslint 8** en `strictTypeChecked` + `stylisticTypeChecked`
  (`eslint.config.mjs`), con tipos sobre `src/` y `tests/` (`tsconfig.typecheck.json`) y sin
  tipos sobre JavaScript. Reglas fijadas: `no-explicit-any`, `no-unsafe-*`,
  `no-floating-promises`, `no-misused-promises`, `no-non-null-assertion`,
  `switch-exhaustiveness-check`, `consistent-type-imports`, `ban-ts-comment` con descripción.
  De `import-x` sólo `order`, `no-duplicates` y `first`: la resolución la garantiza `tsc`, y
  las reglas de resolución dieron 173 falsos positivos en el sondeo.
- **`require-await` apagada**: los manejadores devuelven `Promise` por contrato; `async` sin
  `await` es conformidad de interfaz. La seguridad la dan `no-floating-promises` y
  `no-misused-promises`.
- **Excepciones sólo inline y con motivo** (`eslint-comments/require-description`,
  `reportUnusedDisableDirectives: "error"`); `scripts/check-lint-exceptions.mjs` las cuenta.
- **Prettier 3** es el único formateador (`.prettierrc.json`, `.prettierignore` como lista
  única de exclusiones; `eslint-config-prettier` apaga lo estilístico en ESLint).
  `.specify/` y `.claude/` quedan fuera: son de Spec Kit.
- **lefthook 2** instala el hook con `npm install`; `pre-commit` corre formato y lint sobre lo
  staged y `typecheck`. No corre `contract:check` ni pruebas: eso es de CI.
- **No Biome**: sin reglas _type-aware_, no puede hacer cumplir el tipado.

## Consecuencias

- `npm run lint`, `npm run format:check` y `npm run typecheck` en CI y en el orden de trabajo.
- Un `any` explícito, una promesa flotante o un archivo mal formateado fallan el build.
- Objetivo permanente: `Excepciones de lint: 0`; una excepción se justifica en la línea.
