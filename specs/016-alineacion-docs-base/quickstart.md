# Quickstart — Alineación con los documentos base del MVP (016)

## Prerrequisitos

- `npm ci`; `uvx` para `test:contract`; `origin/main` con el contrato 1.2.0 (base del diff).
- El contrato está marcado `info.x-stability: building` (sin consumidores): `contract:diff` acepta el cambio incompatible y `release-check` lo avisa. La marca se quita antes del primer piloto.
- Historia 3: la sesión autoriza la carpeta `../` (los documentos base), o se relanza con `--add-dir ..`.

## Verificar cada historia

### US1 — Gobernanza del repo

```bash
npm run contract:check       # check:adrs, check:glossary, check:api-map, check:markers en verde
git diff main -- .specify/memory/constitution.md docs/adr contracts/api-map.yaml docs/dominio
```

Esperado: constitución 1.4.2 (1.4.0 con XI, 1.4.1 con las operaciones del puerto en inglés, 1.4.2 con la marca `building` en el gate del plan) y `fit`/`price`/`returns`; ADR-025 con los tres modos; ADR nuevo con las cinco decisiones; ADR-010 remitiendo a `01 §13`; `features:` 016–022 en el orden de R-03; las notas nuevas del glosario con fuente.

### US2 — Contrato con la cadena de evidencia, `locale`, `check:identifiers`

```bash
npm run contract:check       # "Incompatible change accepted: the contract is building"; tipos regenerados; check:identifiers en verde
npm test                     # órdenes, corroboraciones y devoluciones con status + correlation; ingesta con locale
npm run test:contract        # Schemathesis contra /v1/
npm run check:identifiers    # Identifiers: N cited, 0 unknown
node scripts/check-identifiers.mjs --docs tests/governance/fixtures/identifiers/unknown   # exit 1, nombra el identificador
```

### US3 — Base al día

Releer la evaluación §5.1 contra `../README.md`, `../01`, `../02`, `../03`, `../04`; `npm run check:glossary` sigue resolviendo las fuentes `mvp:`; compilar los diagramas si `archify` está disponible (`npx archify …`), o anotar aquí que queda pendiente.

## Cierre

```bash
npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check
```

Un commit por historia; PR a `main` sin merge.

## Cambios respecto del plan

- 2026-09-20 T001: línea base en `c9a333d`; `contract:check` y `npm test` en verde; `check:identifiers` inexistente.
- 2026-09-20 US1: la nota del glosario `estrategia-de-sincronizacion` usa `contexto: plataforma` y `uso: pendiente` (el glosario no admite `integracion` ni `planificado`). ADR-030 cita "feature 016" por número porque su spec existe; las reservadas sólo por nombre.
- 2026-09-20 US2: el gate `check:identifiers` admite como fuente el tooling del repo (`--tooling`; los ADR citan reglas de lint, opciones de `tsconfig` y scripts) y `--catalogs`; una nota del glosario puede citar su propio `en`. La primera corrida sobre el repo encontró los nombres en español de las cuatro operaciones del puerto de plataforma en la constitución X (`obtenerCatalogo`, …): pasan a `fetchCatalog`, `fetchStockAndPrice`, `onOrderConfirmed`, `onReturnRegistered` (constitución 1.4.1, PATCH; el mapa los nombra en la feature 019; 02 §6.1 se alinea en US3). Trece entradas en la allowlist, todas con motivo (marcadores, nombres de versiones reemplazadas, código de diagnóstico del compilador). El esquema `Correlation` exigió la nota `docs/dominio/correlacion.md`; `tests/integration/fixtures/two-ops.yaml` es el contrato del servidor real de prueba (cambia con el prefijo, no es un fixture de reglas).
- 2026-09-20 US2, decisión del dueño al ver `/v2/`: en construcción no se salta de versión mayor. Se revierte a `/v1/`, `info.version: 1.3.0`, y el contrato declara `info.x-stability: building`; `contract:diff` acepta el cambio incompatible con la marca y `release-check` avisa; ADR-003 lleva la precisión y la constitución pasa a 1.4.2 (PATCH). La evaluación (decisión 7) decía "versión mayor": queda registrado aquí y en R-04.
- 2026-09-20 US3 (carpeta `../` autorizada por el dueño en la sesión; los archivos no entran al commit del repo). Editados: `README.md` (estado al 2026-09-20, V1–V6, "Lo próximo", fila `backend/`); `01-arquitectura-mvp.md` → 0.2 (§3.1.1 `PageContext` con `locale`; §3.2 y §9 estado en memoria hasta la feature de persistencia; §4.4 mensajes por idioma y `message-unavailable`; §10.3 siete campos; §14.1 nivel 3 con `subscribe`, nivel por flujo; §14.2 banderas "Idiomas del merchant" y "Estrategia de sincronización"); `02-integracion-ecommerce.md` → 0.2 (§4 cómo llega por la estrategia, tabla con fila genérica; §6 estrategia por merchant y por flujo con las dos tablas de la evaluación §2.1; §6.1 operaciones `fetchCatalog`, `fetchStockAndPrice`, `onOrderConfirmed`, `onReturnRegistered` en inglés como la constitución X; §6.2 `push` como el genérico construido; §6.3 sin cambio); `03-alcance-mvp.md` → 0.5 (§4.2 D-B confirmada; §4.13 estrategia, adaptador de prueba y verificación documental de Magento 2 y VTEX "tarea previa"; §6 "Decisiones de producto confirmadas" el 2026-09-20); `04-hoja-de-decisiones.md` (fecha, las cinco casillas "☒ Confirmo (2026-09-20)", nota técnica con los tres modos). Diagramas: fuentes `.architecture.json` / `.sequence.json` editados (tres modos, "clave de ingesta" y "clave de plataforma + firma" en vez de "token", persistencia como feature pendiente, `locale` en el contexto); **los `.html` no se regeneraron**: `archify` de `tt-a1i` no está instalado y el paquete npm `archify` es otra herramienta — queda pendiente compilar los tres con `node bin/archify.mjs deliver …` desde un clon de ese repo. Sin renumerar secciones: `check:glossary` sigue resolviendo las fuentes `mvp:`. En el repo: ADR-028 y el Sync Impact de la constitución cierran la nota transitoria de VII (01 §10.3 ya lista siete campos). Copia de seguridad previa de los seis archivos y los diagramas en el directorio temporal de la sesión.
- 2026-09-20 cierre (SC-002): relectura de la evaluación §2 contra los dos lados. Las doce decisiones tienen su texto en la base y en el repo sin contradicción; dos matices propios de la implementación, ambos del dueño: la 7 sin versión mayor (marca `building`, 1.3.0, `/v1/`) y la 12 con las cuatro operaciones del puerto renombradas en inglés (constitución 1.4.1; 02 §6.1 las cita igual). Lo que la evaluación deja a otras features (5: aceptación del registro desacoplada; 6: configuración en tres niveles; 9: catálogo por idioma) no se implementó aquí, como estaba previsto. SC-006 parcial: el `README` de la base tiene fecha del cierre; los diagramas tienen su fuente al día pero los `.html` no se compilaron (herramienta ausente, ver US3).
