# OPE-Backend — instrucciones para agentes

Backend del MVP de OPE (Zona B). Se construye de cero; la POC no es base de código.
Idioma de documentación, specs y commits: **español**. Código e identificadores: inglés.

## Fuentes de verdad, en este orden

1. `.specify/memory/constitution.md` — principios y gates. Prevalece sobre todo lo demás.
2. Documentos del MVP (fuera del repo, en `../`): `01-arquitectura-mvp.md`,
   `02-integracion-ecommerce.md`, `03-alcance-mvp.md`. Si no podés leerlos, la sesión se lanzó
   sin `--add-dir ..`; pedilo antes de asumir.
3. `specs/NNN-*/` — spec, plan y tareas de cada feature.
4. `contracts/openapi.yaml` — única fuente de verdad de toda superficie HTTP.

## Flujo de trabajo (inamovible)

`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
Nada se implementa sin spec ni plan. El plan debe pasar el Constitution Check.

Dentro de una feature que toca HTTP, el orden es:

1. Cambiar el contrato en `contracts/` (multi-archivo, `$ref`). La raíz `openapi.yaml` no
   declara `components`: cada archivo de `components/` se referencia por ruta relativa desde
   donde se usa y el bundle lo promueve a `#/components/<tipo>/<NombreDeArchivo>`.
2. `npm run contract:check` en verde (lint, bundle, compatibilidad contra `main`, drift de
   tipos). Si agrega una regla nueva al ruleset, agregar su fixture en
   `tests/contract-rules/fixtures/` (la prueba falla si falta).
3. Regenerar tipos (`npm run contract:types`). **Nunca editar lo generado a mano.**
4. Escribir el handler en `src/handlers/<operacion>.ts` tipado con
   `OperationHandler<"<operationId>">` y registrarlo en `src/main.ts` (único composition root).
   El servidor rutea por `operationId`; no hay otro mecanismo de rutas.
5. `npm run typecheck && npm test && npm run test:contract` en verde.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run contract:lint` | Redocly (estructura) + Spectral (`contracts/.spectral.yaml`, reglas `ope-*`) |
| `npm run contract:bundle` | Bundle en `contracts/dist/openapi.yaml` (derivado, no se commitea) |
| `npm run contract:diff` | Cambios incompatibles contra `origin/main` (oasdiff); `CONTRACT_BASE_REF` para otra base |
| `npm run contract:types` / `contract:types:check` | Regenera `src/generated/api.d.ts` / falla si está desactualizado |
| `npm run contract:check` | lint → bundle → diff → drift de tipos. Corre antes de cualquier commit |
| `npm run contract:mock` | El mismo servidor en modo mock (`OPE_MOCK=1`): responde los ejemplos del contrato |
| `npm run contract:docs` | `docs/api/index.html` autocontenido; se rehúsa si `contract:check` falla |
| `npm run build` / `dev` / `typecheck` | `tsc` a `dist/` / `tsx watch` / `tsc --noEmit` incluyendo `tests/types/*.test-d.ts` |
| `npm test` | Vitest: unitarias, integración (`fastify.inject`), reglas del contrato, compatibilidad |
| `npm run test:contract` | Schemathesis (`uvx`) contra el servidor levantado |

### Notas operativas del contrato

- Ruleset de Spectral en estilo bloque (no `{ a: b }`), `"off"` entre comillas.
  `oas3-schema` está apagada por un bug con path items `$ref` en 3.1; la estructura la
  valida Redocly. Detalle en `specs/001-api-contract-toolchain/research.md` (R-02).
- Lista de datos personales prohibidos: **sólo** `contracts/rules/pii-denylist.json`.
- Catálogo de tipos de error: `contracts/problem-types.yaml` (`urn:ope:problem:<slug>`),
  replicado en `src/server/problem-details.ts` y verificado por prueba.
- Cambio incompatible ⇒ `info.version` a la mayor siguiente **y** prefijo `/v<N>/`.

## Reglas que fallan el build (no son sugerencias)

- `merchantId` nunca en path, query ni body: se deriva de la credencial.
- Ningún campo de dato personal en ningún esquema (lista en el ruleset de lint).
- Todo request body con `additionalProperties: false`.
- Todo error es RFC 9457 Problem Details.
- Cambio incompatible del contrato ⇒ nueva versión mayor, o falla.
- Cero llamadas a modelos de lenguaje en runtime.
- Sin I/O de red ni escritura bloqueante en el camino crítico de decisión.
- Toda feature que toca persistencia o API incluye pruebas de aislamiento entre merchants.

## Convenciones

- TypeScript `strict`. Sin `any`. Un módulo por autoridad. Composition root único en `src/main.ts`.
- Porcentajes 0–100 sólo en el borde (DTO); adentro, tasas 0–1.
- `NO_OP` es un resultado válido con motivo, nunca una excepción.
- Marcar afirmaciones como **DECIDIDO / PROPUESTO / ABIERTO** y estado del sistema como
  **BUILT / CONNECTED / ACTIVE / TESTED**. No afirmar que algo funciona sin prueba ejecutable.
- Commits: conventional commits, en español, un cambio por commit. No commitear sin que las
  pruebas pasen. No hacer push sin que el usuario lo pida.

## Si existe `HANDOFF.md` en la raíz

Leerlo primero: contiene el estado de la tarea en curso. Borrarlo cuando la tarea que describe
esté terminada y commiteada.
