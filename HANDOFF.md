# HANDOFF — feature 001: cadena de herramientas del contrato API

**Fecha**: 2026-09-16 · **De**: sesión de arquitectura (repo `ope/`) · **Para**: agente de backend
**Borrar este archivo** cuando la feature 001 esté implementada, verificada y commiteada.

## Cómo lanzar la sesión

Los documentos fuente del MVP están **fuera de este repo**, un nivel arriba. Lanzá Claude Code
desde la raíz de este repo con acceso a ese directorio:

```powershell
cd "C:\Users\Jose Luis\Documents\trabajos\German\ope\mvp\backend"
claude --add-dir "C:\Users\Jose Luis\Documents\trabajos\German\ope\mvp"
```

Sin `--add-dir`, los enlaces `../01-arquitectura-mvp.md` de la constitución no se pueden leer.

## Estado actual

| Qué | Estado |
|---|---|
| Repo inicializado, spec-kit instalado (`.specify/`, `.claude/skills/speckit-*`) | Hecho, commiteado |
| Constitución v1.0.0 (`.specify/memory/constitution.md`) | Hecho. D1 = Node LTS + TS estricto; D2 = PostgreSQL + Redis. |
| `CLAUDE.md` con reglas y flujo | Hecho |
| Feature 001: `specs/001-api-contract-toolchain/spec.md` + checklist | Hecho (`/speckit-specify` ya corrió). `.specify/feature.json` apunta a ella. |
| `/speckit-plan` | **Pendiente — es tu primer paso** |
| `/speckit-tasks` | Pendiente |
| `/speckit-implement` | Pendiente |

## Tu tarea, en orden

1. Leé `CLAUDE.md`, la constitución y `specs/001-api-contract-toolchain/spec.md`.
2. Corré `/speckit-plan`. El plan tiene que pasar el Constitution Check (sección "Flujo de
   desarrollo" de la constitución). En esta feature aplican los gates de contrato HTTP y de
   "no LLM"; no aplican los de persistencia ni camino crítico (no hay dominio todavía).
3. Corré `/speckit-tasks`. Las tareas de contrato y de pruebas preceden a las de código.
4. Corré `/speckit-implement`. Al terminar: `npm run contract:check`, compilación, pruebas y
   pruebas de contrato en verde. Commit por unidad de trabajo, conventional commits en español.
5. Borrá este archivo y commiteá.

## Herramientas propuestas (decisión final en el plan)

Estas son las elecciones que se discutieron y acordaron con el stakeholder técnico. El plan
puede cambiarlas si encuentra una razón concreta y la documenta en `research.md`.

| Rol | Herramienta | Notas |
|---|---|---|
| Lint de estilo + reglas propias | **Spectral** (`@stoplight/spectral-cli`) | Ruleset en `contracts/.spectral.yaml`, extiende `spectral:oas`. Las reglas de OPE (sin `merchantId` en request, sin PII, `additionalProperties: false`, Problem Details, tags cerrados, errores obligatorios, ejemplos) van como reglas custom con `severity: error`. |
| Lint estructural + bundle + preview | **Redocly CLI** (`@redocly/cli`) | `bundle` produce `contracts/dist/openapi.yaml` (o `.json`). |
| Breaking changes | **oasdiff** | Binario Go. Opciones: `npx`-wrapper si existe, descarga en `postinstall`, o Docker. Elegir la que corra en CI sin paso manual. Comparar contra el bundle de `main`. |
| Tipos generados | **openapi-typescript** | Salida en `src/generated/api.d.ts` con encabezado "generado, no editar". Chequeo de drift en `contract:check`. |
| Cliente tipado | **openapi-fetch** | Para SDK y portal; ~2 KB. Exportado desde un paquete/entrypoint del repo. |
| Mock | **Prism** (`@stoplight/prism-cli`) | `npm run contract:mock`. Valida requests igual que el servidor. |
| Docs | **Scalar** (o Redoc via `redocly build-docs`) | Artefacto estático autocontenido; el comando falla si el lint falla. |
| Validación runtime + routing por `operationId` | **openapi-backend** (o Fastify + `fastify-openapi-glue`) | Elegir uno y justificar. Debe validar request y response, `501` sin handler, `404`/`405` Problem Details, rehusarse a arrancar con contrato inválido. |
| Pruebas de contrato generadas | **Schemathesis** | Python; ya hay `uv` en la máquina → `uvx schemathesis run ...`. En CI, instalar con `uv`. |
| Pruebas unitarias/integración | **Vitest** (o node:test) | A elección; consistente en todo el repo. |
| CI | GitHub Actions | `contract:check` + build + test + contract tests. |

Comandos esperados en `package.json` (nombres a respetar; `CLAUDE.md` los referencia):
`contract:lint`, `contract:bundle`, `contract:diff`, `contract:types`, `contract:check`
(= lint + bundle + diff + drift de tipos), `contract:mock`, `contract:docs`, `test`,
`test:contract`, `build`, `dev`.

## Alcance — qué NO hacer

- **No agregar ninguna operación de dominio** (eventos, decisión, órdenes, portal). Sólo
  `GET /v1/health`. La feature 002 será ingesta de eventos + asignación experimental.
- **No generar el contrato desde código** (Zod → OpenAPI, decoradores, etc.). El YAML es la
  fuente; el código se valida contra él.
- **No agregar Redis, PostgreSQL ni autenticación.** No hay nada que persistir todavía.
- **No editar `.specify/templates/`** ni la constitución para "hacer pasar" un gate. Si un gate
  no se puede cumplir, se documenta como ABIERTO y se consulta.

## Decisiones ya tomadas que te van a aparecer

- Contrato multi-archivo: `contracts/openapi.yaml` raíz + `paths/`, `components/{schemas,
  responses,parameters,securitySchemes}/`, `webhooks/`, `examples/`.
- Errores: RFC 9457 Problem Details, `application/problem+json`, catálogo de `type` URIs bajo
  un namespace propio (por ejemplo `https://ope.dev/problems/<slug>`; el dominio concreto es
  PROPUESTO, elegir uno estable y documentarlo).
- Versionado: `info.version` semver; rutas con `/v1`. Breaking sin bump de major = falla.
- Tags cerrados: `system` ahora; `ingest`, `decision`, `outcomes`, `portal`, `admin` después.
- Lista de PII prohibida (única fuente, ampliable): `email`, `name`, `firstName`, `lastName`,
  `phone`, `address`, `document`, `dni`, `ip`, `ipAddress`, `card`, `cardNumber`, `password`
  (excepción futura: sólo en el esquema de login del portal).
- `.gitattributes` con `* text=auto eol=lf` para que los agentes no vean ruido de CRLF.

## Abierto (no bloquea la 001)

- D3 hosting (Render hoy, AWS previsto), D4 merchant piloto, D5 datos personales, D6 muestra.
- Nombre del artefacto de navegador ("SDK" vs "tag"): no afecta al backend.
