# OPE-Backend

Backend del MVP de OPE (Zona B de la arquitectura). Se construye de cero; la POC es referencia de dominio, no base de código.

## Documentación fuente

La arquitectura, la integración con el ecommerce y el alcance viven en el directorio `mvp/` del
repositorio de trabajo (`../01-arquitectura-mvp.md`, `../02-integracion-ecommerce.md`,
`../03-alcance-mvp.md`). Este repo los deriva en `.specify/memory/constitution.md`.

## Método

- **Spec-driven** con [spec-kit](https://github.com/github/spec-kit): `/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Los comandos están en `.claude/skills/`.
- **API-first**: `contracts/openapi.yaml` es la fuente de verdad de toda superficie HTTP; los
  tipos y validadores se generan desde el contrato. El cambio de contrato precede al código.

## Stack

Node.js LTS · TypeScript estricto · PostgreSQL (durable) · Redis (sesión caliente).

## Empezar

Requisitos: Node.js 22 (`.nvmrc`), npm 10+, [`uv`](https://docs.astral.sh/uv/) para las
pruebas de contrato con Schemathesis.

```bash
npm ci
npm run contract:check   # lint + bundle + compatibilidad + drift de tipos + gobernanza
npm run format:check && npm run lint   # Prettier y ESLint estricto con tipos
npm run build && npm run typecheck && npm test
npm run test:contract    # Schemathesis contra el servidor levantado
npm run dev              # servidor real en memoria en http://127.0.0.1:3000 con el merchant de config/dev-merchants.json
npm run contract:docs    # docs/api/index.html, autocontenido
npm run contract:insomnia # docs/api/insomnia.json: colección de Insomnia con las operaciones, credenciales de dev e instantes vivos
```

No hay servidor mock (ADR-018): el servidor real con el perfil en memoria arranca sin
infraestructura, valida y autentica igual que en producción y responde con comportamiento real.
`dev` carga el merchant de desarrollo de `config/dev-merchants.json` (clave `ope_dev_ingest_key`);
en cualquier otro entorno los merchants vienen de `OPE_MERCHANTS`, un JSON
`[{ "merchantId", "ingestKeys": [..], "platformKeys": [..], "platformSecrets": [..], "origins": [..], "experiments": [..] }]`, o de
`OPE_MERCHANTS_FILE`, y sin ninguno el servidor no autentica a nadie. Un experimento activo
(`{ "experimentId", "treatmentPercent", "seed", "status": "active", "startedAt" }`) asigna cada
visitante a CONTROL o TREATMENT de forma determinista (ADR-022); sin experimento, ningún
visitante se asigna y toda decisión es `NO_OP` con motivo `no-active-experiment`. El merchant
de desarrollo asigna el 100 % a TREATMENT para que el plano de decisión se pueda probar a mano.
Tres datos opcionales por merchant: `decisionPolicy` (reglas de barrera, umbral, prioridad,
evidencia por barrera; forma en `specs/011-plano-de-decision-i/contracts/decision-policy.config.md`,
ADR-026), `commercialPolicy` (techo y escalones del incentivo, margen, riesgo de devolución,
alta intención, abandono, presupuestos por sesión y visitante, cooldown) y `evidenceProfile`
(política de devoluciones, dato de calce, atributos autorizados), estos dos con forma en
`specs/012-plano-de-decision-ii/contracts/commercial-policy.config.md` (ADR-027). Sin ellos,
`default-1`, `commercial-default-1` (sin margen ⇒ sin incentivos) y perfil vacío; uno inválido
impide el arranque nombrando el campo. Con `platformSecrets` (uno o dos, ADR-029) la plataforma
del merchant debe firmar cada request de su credencial (`PUT /v1/catalog`, `POST /v1/orders`,
`POST /v1/returns`) con `X-OPE-Timestamp` y `X-OPE-Signature`; `node scripts/sign-platform-request.mjs
<secreto> <archivo.json>` imprime los dos headers para curl o Insomnia (forma exacta en
`specs/013-outcomes-ordenes-y-devoluciones/contracts/platform-signature.md`). El merchant de
desarrollo lleva `ope_dev_platform_secret`.

```bash
npm run dev
curl -s -X POST http://127.0.0.1:3000/v1/events   -H "content-type: application/json" -H "X-OPE-Ingest-Key: ope_dev_ingest_key"   -d '{"events":[{"type":"product_viewed","eventId":"evt_00000001","sessionId":"ses_00000001","visitorId":"vis_00000001","occurredAt":"2026-09-16T12:00:00Z","page":{"pageType":"product","productId":"SKU-1"},"device":"mobile"}]}'
```

- Contrato: `contracts/` (raíz `openapi.yaml`, `paths/`, `components/`, `examples/`,
  catálogos `problem-types.yaml` y `no-op-reasons.yaml`).
- Carga informativa: `npm run build && npm run test:load` (autocannon; `OPE_LOAD_DURATION`,
  `OPE_LOAD_CONNECTIONS`, `OPE_LOAD_VISITORS`). Cifras de referencia en
  `specs/007-asignacion-experimental/quickstart.md`.
- Mapa del contrato: `contracts/api-map.yaml` — toda la superficie HTTP del MVP, construida y
  planeada, con consumidor, esquema de seguridad, feature y fuente (ADR-019, ADR-020);
  `npm run check:api-map` la mantiene coherente con el contrato. La documentación generada
  (`npm run contract:docs`) muestra la superficie planeada.
- Tipos generados: `src/interface-adapters/http/generated/api.d.ts` (commiteado, nunca editado a mano).
- Cliente tipado para SDK y portal: `import { createOpeClient } from "ope-backend/client"`.
- Reglas del contrato y cómo ampliarlas: `contracts/.spectral.yaml`, `tests/contract-rules/README.md`.
- Decisiones de arquitectura: `docs/adr/` (citar `ADR-NNN`). Glosario del lenguaje ubicuo:
  `docs/dominio/`. Anillos, módulos y mapa de contextos (ADR-013): `.dependency-cruiser.cjs`,
  `npm run arch`.
- Puerta antes de publicar: `npm run release-check`.
- Flujo de trabajo para agentes: `CLAUDE.md`.
