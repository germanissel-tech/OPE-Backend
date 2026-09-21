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
npm run contract:insomnia # docs/api/insomnia.json: colección de Insomnia con las operaciones, credenciales y token de dev e instantes vivos
```

No hay servidor mock (ADR-018): el servidor real con el perfil en memoria arranca sin
infraestructura, valida y autentica igual que en producción y responde con comportamiento real.
Los merchants se **operan** por la API de administración (ADR-031): un operador con su token
(`Authorization: Bearer ope_at_…`) los crea, rota sus credenciales, los apaga con el interruptor,
publica su configuración, abre y cierra sus experimentos y los da de baja, sin reiniciar nada.
Los operadores vienen de `OPE_ADMIN_OPERATORS` (JSON `[{ "operatorId", "tokenFingerprints": [..],
"scope": "*" | ["mrc_…"] }]`) o de `OPE_ADMIN_OPERATORS_FILE`; `node scripts/mint-admin-token.mjs
<operatorId> [alcance]` imprime un token nuevo (una sola vez) y su entrada con la huella.
`dev` arranca con `config/dev-operators.json` (token `ope_dev_admin_token`, alcance `*`) y con
la **semilla** de `config/dev-merchants.json` (clave `ope_dev_ingest_key`); en cualquier otro
entorno la semilla viene de `OPE_MERCHANTS`, un JSON
`[{ "merchantId", "ingestKeys": [..], "platformKeys": [..], "platformSecrets": [..], "origins": [..], "experiments": [..], … }]`,
o de `OPE_MERCHANTS_FILE`. La semilla entra sólo con el store vacío (con merchants ya
registrados no pisa nada) y sin ninguna, el servidor no autentica a nadie hasta que un operador
cree un merchant. Un experimento de la semilla
(`{ "experimentId", "treatmentPercent", "seed", "targetSample", "cuts"?, "status": "calibrating" | "active" | "closed", "openedAt" }`)
asigna cada visitante a CONTROL o TREATMENT de forma determinista (ADR-022); sin experimento
abierto, ningún visitante se asigna y toda decisión es `NO_OP` con motivo
`no-active-experiment`. Por la API un experimento nace en calibración (se asigna y se decide,
nada cuenta), se activa (la configuración queda congelada; sólo entra una versión correctiva con
motivo, que reinicia la ventana) y se cierra (03 §4.10, D-G). El merchant de desarrollo asigna el
100 % a TREATMENT para que el plano de decisión se pueda probar a mano.

**Ninguna política vive en el código** (constitución XI): el comportamiento se configura en tres
niveles. `config/platform.json` (ventanas, tolerancias, topes; `OPE_PLATFORM_CONFIG` nombra
otro archivo) y `config/treatment-defaults.json` (frescura, nivel de sincronización, holdout,
políticas `default-1` y `commercial-default-1`, perfil de evidencia, superficies, barreras,
estrategia de sincronización, idiomas; `OPE_TREATMENT_DEFAULTS`) son los dos niveles del release;
el tercero es la versión de configuración de cada merchant, publicada por
`POST /v1/admin/merchants/{merchantId}/configuration` y estampada en cada decisión (las tres
versiones). Lo que la semilla declara junto a los campos del merchant (`decisionPolicy`,
`commercialPolicy`, `evidenceProfile`, `holdoutPercent`, `freshness`, `anchors`, `locales`, …)
es la versión 1 del merchant; un valor inválido impide el arranque nombrando el campo. El SDK lee
lo suyo en `GET /v1/sdk/config` (interruptor, versiones, superficies, idiomas, mapa de anclajes;
nunca una política) y reporta en `POST /v1/sdk/diagnostics` los anclajes que dejaron de
resolver. Con `platformSecrets` (uno o dos, ADR-029) la plataforma
del merchant debe firmar cada request de su credencial (`PUT /v1/catalog`, `POST /v1/orders`,
`POST /v1/returns`) con `X-OPE-Timestamp` y `X-OPE-Signature`; `node scripts/sign-platform-request.mjs
<secreto> <archivo.json>` imprime los dos headers para curl o Insomnia (forma exacta en
`specs/013-outcomes-ordenes-y-devoluciones/contracts/platform-signature.md`). El merchant de
desarrollo lleva `ope_dev_platform_secret`.

```bash
npm run dev
curl -s -X POST http://127.0.0.1:3000/v1/events   -H "content-type: application/json" -H "X-OPE-Ingest-Key: ope_dev_ingest_key"   -d '{"events":[{"type":"product_viewed","eventId":"evt_00000001","sessionId":"ses_00000001","visitorId":"vis_00000001","occurredAt":"2026-09-16T12:00:00Z","page":{"pageType":"product","productId":"SKU-1"},"device":"mobile"}]}'
```

- Cada directorio de primer nivel se explica solo: `config/README.md`, `contracts/README.md`,
  `generated/README.md`, `patches/README.md`, `scripts/README.md`, `docs/README.md`,
  `tests/README.md`, `client/README.md`, `specs/README.md` (inventario verificado por
  `npm run test:tools`, ADR-032).
- Contrato: `contracts/` (fuente única de la superficie HTTP); lo que el código deriva de él
  vive en `generated/` (`npm run contract:types`, verificado por drift) y el cliente tipado para
  consumidores en `client/` (export `./client`).
- Carga informativa: `npm run build && npm run test:load` (autocannon; `OPE_LOAD_DURATION`,
  `OPE_LOAD_CONNECTIONS`, `OPE_LOAD_VISITORS`). Cifras de referencia en
  `specs/007-asignacion-experimental/quickstart.md`.
- Mapa del contrato: `contracts/api-map.yaml` — toda la superficie HTTP del MVP, construida y
  planeada, con consumidor, esquema de seguridad, feature y fuente (ADR-019, ADR-020);
  `npm run check:api-map` la mantiene coherente con el contrato. La documentación generada
  (`npm run contract:docs`) muestra la superficie planeada.
- Cliente tipado para SDK y portal: `import { createOpeClient } from "ope-backend/client"`.
- Reglas del contrato y cómo ampliarlas: `contracts/.spectral.yaml`, `tests/contract-rules/README.md`.
- Decisiones de arquitectura: `docs/adr/` (citar `ADR-NNN`). Glosario del lenguaje ubicuo:
  `docs/dominio/`. Anillos, módulos y mapa de contextos (ADR-013): `.dependency-cruiser.cjs`,
  `npm run arch`.
- Puerta antes de publicar: `npm run release-check`.
- Flujo de trabajo para agentes: `CLAUDE.md`.
