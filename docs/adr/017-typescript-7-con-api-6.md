---
numero: 17
titulo: TypeScript 7 como compilador, API 6.0 para las herramientas que la importan
estado: aceptada
fecha: 2026-09-16
fuente: specs/005-auditoria-calidad/research.md
---

# ADR-017 — TypeScript 7 con API 6.0 side-by-side

## Contexto

TypeScript 7 es el compilador nativo (Go): `tsc` compila `src/` en segundos y el typecheck de
fuentes y pruebas pasa sin cambios. Pero 7.0 no publica API programática (la anuncia para
7.1), y varias herramientas del repo importan `typescript` como librería: typescript-eslint
(todo el lint con tipos, ADR-011), openapi-typescript (tipos del contrato), dependency-cruiser
(reglas de anillos, ADR-013) y el checker de Stryker. Con `typescript@7` solo, las cuatro
fallan. El repositorio estaba fijado en 5.9.3, dos versiones mayores atrás; el usuario decidió
que no se congela el compilador ni se degrada ninguna herramienta.

## Decisión

1. **`tsc` es TypeScript 7**: `@typescript/native` = `npm:typescript@^7`. `build`,
   `typecheck` (los tres proyectos) y el hook de pre-commit lo usan.
2. **La API que importan las herramientas es TypeScript 6.0**: `typescript` =
   `npm:@typescript/typescript6@^6.0`. Es el mecanismo que Microsoft documenta para esta
   transición ("Running side-by-side with TypeScript 6.0"); typescript-eslint lo indica en su
   propio mensaje de error.
3. **Los diagnósticos nuevos de 7 se corrigen en el código**, no relajando reglas: arrays
   literales en `.cjs` con tipo explícito, exports mixtos de CommonJS separados; las pruebas
   que afirman códigos de diagnóstico usan los vigentes (`TS2882` para side-effect imports
   inexistentes).
4. **Condición de retiro del alias**: cuando typescript-eslint (issue #10940) y
   dependency-cruiser admitan la API de TypeScript ≥ 7.1, `typescript` pasa a `^7` y
   `@typescript/native` se elimina. Hasta entonces, subir `@typescript/typescript6` sigue el
   rango `^6.0`.
5. **Ninguna dependencia queda por debajo de su última versión publicada** sin nota con
   motivo y condición de actualización.

## Consecuencias

- `package.json` lleva `overrides.openapi-typescript.typescript = "$typescript"`: openapi-typescript
  declara peer `typescript@^5` y sin el override `npm install` (no `npm ci`) falla con ERESOLVE
  contra el alias 6.0. Se retira junto con el alias.

- Compilación y typecheck más rápidos; el repo está en la versión mayor vigente del
  compilador desde ahora, no cuando el ecosistema termine de migrar.
- Hay dos copias de TypeScript en `node_modules` (una nativa, una JS) hasta el retiro del
  alias. `package.json` lo hace visible por los nombres de los paquetes.
- Las opciones eliminadas en 7 (`baseUrl`, `moduleResolution: node`, `target: es5`, módulos
  no ES) no pueden volver a entrar en ningún `tsconfig`.
