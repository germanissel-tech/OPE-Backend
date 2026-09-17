# Research — Feature 007: asignación experimental y ledger

**Fecha**: 2026-09-17 · **Estado**: completo. Decisiones transversales → ADR-021 (semántica de
escritura del ledger) y ADR-022 (asignación experimental) durante la implementación.

## R-01 Función de asignación (verificado)

- **Decisión (DECIDIDO → ADR-022)**: brazo = `fnv1a32(clave) % 100 < treatmentPercent ? TREATMENT :
CONTROL`, con `clave = merchantId ␟ experimentId ␟ seed ␟ visitorId` (separador de unidad
  U+001F para que ningún campo pueda imitar a otro). FNV-1a de 32 bits es una función pura de
  ocho líneas: vive en el dominio (`domain/experiment/assignment.ts`) sin importar `node:crypto`
  (el dominio no importa Node, ADR-013) y da el mismo resultado en cualquier instancia y
  runtime.
- **Verificado** (`node_modules/.cache/probe-007/hash.mjs`, 100 000 visitantes, objetivos 50 %,
  20 %, 100 %, 0 %): FNV-1a → 49,97 % / 20,22 % / 100 % / 0 % con ids aleatorios y 50,12 % /
  19,96 % con ids **secuenciales** (`vis_00000001`…, el caso adversario); acuerdo entre dos
  merchants con el mismo visitante 49,95 % (independencia); 200 000 hashes en 32 ms.
  murmur3 (puro) da lo mismo con el doble de código; SHA-256 (vía `node:crypto`) igual de
  bueno y 8× más lento, y obligaría a un puerto de hashing. Tolerancia de las pruebas: ±1 pp
  sobre 100 000 visitantes (SC-001), holgada frente a lo medido.
- **Alternativas rechazadas**: sorteo con registro (no es determinista sin estado compartido,
  01 §4.1); `visitorId` solo como clave (dos merchants o dos experimentos compartirían
  brazo).

## R-02 Módulo `experiment` y mapa de contextos

- `domain/experiment/`: `Experiment` (id, merchant, `treatmentPercent` 0..100, `seed`,
  `status` active|closed, `startedAt`), `Arm` (`CONTROL` | `TREATMENT`), `Assignment`
  (merchant, experiment, visitor, arm, `assignedAt`), `assignArm(experiment, visitorId)`.
- `application/experiment/`: puertos `ExperimentDirectory` (`activeFor(merchantId)`, desde
  configuración) y `AssignmentLedger` (`record`, `find`); caso de uso `assignVisitor`.
- Mapa de contextos: `experiment: [shared-kernel]`; `ingestion: [shared-kernel, merchant,
ledger, experiment]` (la ingesta resuelve la asignación antes de decidir). El ledger de
  asignaciones es un puerto del módulo `experiment` (su entidad), igual que el de decisiones
  lo es del módulo `ledger`; el módulo `ledger` no depende de `experiment`.
- La `Decision` gana `experiment?: { experimentId, arm }` (ausente sin experimento activo).

## R-03 Semántica de escritura del ledger (→ ADR-021)

- **Decisión**: todo `record()` de un ledger devuelve un resultado explícito. Tipo común en
  `application/shared-kernel`: `RecordOutcome = "accepted" | "unavailable"`.
  `DecisionLedger.record` y `AssignmentLedger.record` → `RecordOutcome`;
  `ExposureLedger.record` → `"recorded" | "already-recorded" | "unavailable"`. "Aceptado"
  significa aceptado en el buffer de escritura (durable después, asíncrono, 01 §4.6); en
  memoria, inmediato. "No disponible" significa buffer lleno o almacén caído: el orquestador
  falla cerrado.
- **Degradación**: ingesta → `NO_OP` con motivo `ledger-unavailable` y `202` (constitución II,
  01 §4.7: se suprime la intervención, nunca 5xx); no se registra decisión. Exposición → el
  SDK necesita saber que no quedó registrada para reintentar: `503` con tipo
  `ledger-unavailable` y `Retry-After`. Es un cambio compatible del contrato (respuesta nueva
  en `confirmExposure`) y un tipo nuevo en el catálogo; no toca el mapa (la operación ya es
  `built`).
- **Orden en la ingesta**: invariantes → asignación (ledger) → dedup → decisión → registro.
  Si el ledger de decisiones falla después de reclamar la dedup, el lote igual respondió `202`
  y no se espera reintento; el hecho queda en el log operativo. Documentado en el ADR.
- **Prueba del camino**: gateways falsos `unavailableLedger()` inyectados por override de
  puertos (`startTestApp({ ports: { decisions: … } })`), en ingesta y exposición.

## R-04 Experimentos por configuración

- `MerchantConfig.experiments?: ExperimentConfig[]` dentro de `OPE_MERCHANTS` /
  `OPE_MERCHANTS_FILE` (un solo origen de configuración, como los merchants): `experimentId`
  (patrón de ids), `treatmentPercent` (entero 0..100, por defecto 50), `seed` (no vacío),
  `status` (`active` | `closed`), `startedAt` (RFC 3339). Validación fail-closed al arrancar
  (`ConfigError`): más de un `active` por merchant, campos inválidos. Sin experimentos ⇒ el
  merchant ingiere y decide `NO_OP` `no-active-experiment` sin asignar (US1.6).
- Cambiar `seed` o `treatmentPercent` de un experimento existente no se detecta por
  configuración (no hay historia); la regla es de proceso y de ADR: es un experimento nuevo con
  otro id. Las asignaciones registradas conservan su brazo; si el brazo calculado difiriera del
  registrado, gana el registrado y se loguea `assignment-drift` como error (spec, Assumptions).

## R-05 Prueba de carga informativa (autocannon)

- **Decisión**: `autocannon@^8` como devDependency; `scripts/load-test.mjs` (`npm run
test:load`) levanta el servidor construido (`dist/`) igual que `test-contract.mjs` — la
  lógica de arranque y espera de salud se extrae a `scripts/server-lib.mjs` para no
  duplicarla — con un merchant y un experimento de prueba, y dispara lotes de 20 eventos con
  ids únicos por request (`setupRequest` de autocannon) durante `OPE_LOAD_DURATION` s
  (30) con `OPE_LOAD_CONNECTIONS` (20) conexiones. Imprime lotes/s, p50/p95/p99 (ms), errores
  y respuestas no 2xx, en una línea estable; termina con 0 salvo que el servidor no arranque.
  Fuera de `npm test` y de CI (informativa; SC-006).
- Alternativas: `k6` (binario externo), `wrk` (no Windows). autocannon es Node puro y ya
  corre donde corre el repo.

## R-06 Latencia por brazo (US3.4)

- La prueba de latencia existente (`ingest-latency.test.ts`) gana dos visitantes fijos (uno
  por brazo, elegidos con `assignArm` en la prueba) y reporta p95 por brazo; la aserción es
  laxa (la relación entre p95 no supera 3×) porque en memoria ambos caminos son idénticos y la
  diferencia real es ruido; el umbral absoluto de 50 ms se mantiene (SC-005).

## R-07 Glosario

Notas nuevas (`uso: disponible`: el contrato no gana sustantivos): `experimento` → `experiment`,
`asignación` → `assignment`, `brazo` → `arm`, `grupo de control` → `control`, `grupo de
tratamiento` → `treatment`, `intención de tratar` → `intention-to-treat`. Fuente: 01 §0.1,
§4.1, §5.1, §14.2.
