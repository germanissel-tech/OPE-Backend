# HANDOFF — feature 038, historia 1 a medias (2026-10-04)

Rama `038-textos-por-api`. La fase 1 (el mecanismo) está commiteada y en verde. De la historia 1 están
hechas T029 a T035: contrato de `publishText` (path, esquemas `TextInput`, `TextVersion`, `MessageFamily`,
respuesta `TextUnprocessable`, `Voice.yaml` retirado, `info.version` 1.11.0, tipos regenerados), el
servicio `ReachedByText`, el caso de uso `PublishTextUseCase`, el controller, el presenter y el cableado
en `composition/modules/messages.ts`, con sus unitarias en verde (`tests/unit/application/messages/`).

**Lo que falta de la historia 1** (T036 a T038):

- `tests/integration/messages/base-text.test.ts`: los siete escenarios de la spec. **Tiene que llevar las
  etiquetas** `[invariant:text-key-unknown]`, `[invariant:corpus-text-empty]`,
  `[invariant:corpus-text-too-long]` y `[invariant:corpus-text-has-placeholder]` en nombres de casos:
  `contract:check` falla hoy por esas cuatro ausencias (es lo único que lo deja en rojo).
- `tests/integration/isolation.test.ts`: la operación entra a la suite de aislamiento.
- `npm run test:mutation` acotado al diff.
- `docs/dominio/voz.md` ya se borró; `capa-de-texto.md` sigue con `uso: pendiente` hasta que el contrato
  use `layer` (ya lo usa en `TextVersion`: cambiar a `disponible` y correr `check:glossary`).

**Decisiones tomadas en la implementación que el plan no traía**: `ConfigurationFrozen`,
`ConfigurationReasonRequired` y `LOCALE_PATTERN` se mudaron al kernel (`messages` no puede depender de
`configuration`; los códigos son únicos por clase); `windowRestarted` recibe la causa como objeto
(`RestartSource`) por el tope de cuatro parámetros; el paginado por versión se extrajo a
`pagedByVersion` (D-34: el tercero llegó); la completitud de la semilla se juzga sobre la semilla y no
leyendo el almacén, porque la importación corre dentro de la unidad de trabajo de la auditoría y el índice
durable se actualiza al commit; el resultado auditado de `publishText` sólo lleva `windowRestarted`,
porque `AuditResult` es cerrado en el contrato.

Después: fases 3 a 7 según `specs/038-textos-por-api/tasks.md`.
