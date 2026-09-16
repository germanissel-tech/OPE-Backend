---
numero: 12
titulo: Compilador endurecido y tipos en los scripts JavaScript
estado: aceptada
fecha: 2026-09-16
fuente: specs/003-calidad-de-codigo/research.md
---

# ADR-012 — Compilador endurecido y tipos en los scripts JavaScript

## Contexto

Los scripts de verificación (`scripts/*.mjs`) y las funciones custom de Spectral
(`contracts/rules/functions/*.js`) suman más de mil líneas de JavaScript sin tipos que corren
en cada `contract:check`. El `tsconfig` era estricto pero no al máximo.

## Decisión

- `tsconfig.json` agrega `noPropertyAccessFromIndexSignature`,
  `noUncheckedSideEffectImports`, `verbatimModuleSyntax` y `erasableSyntaxOnly`. Sin `enum`
  ni parámetros de propiedad: uniones de literales y campos explícitos. El código queda listo
  para ejecutarse sin transpilar en Node moderno.
- `tsconfig.scripts.json` con `allowJs` + `checkJs` + `strict` verifica los scripts y las
  funciones del ruleset **sin cambiar cómo se ejecutan**: los tipos van en JSDoc, con
  `@typedef` compartidos (`SpectralFunction` en `_walk.js`, firmas en `governance-lib.mjs` y
  `lib.mjs`). `npm run typecheck` corre los dos proyectos.
- **No migrar los scripts a TypeScript**: cambiaría cómo arrancan en CI por la misma
  verificación.

## Consecuencias

- Un typo en una propiedad de un script se descubre en `typecheck`, no en runtime.
- Toda utilidad compartida de `scripts/` lleva su firma en JSDoc.
