---
numero: 21
titulo: Semántica de escritura del ledger — diferida, acotada y fail-closed
estado: aceptada
fecha: 2026-09-17
fuente: specs/007-asignacion-experimental/research.md
---

# ADR-021 — Semántica de escritura del ledger: diferida, acotada y fail-closed

## Contexto

El camino crítico no admite escrituras bloqueantes ni llamadas de red (01-arquitectura-mvp.md
§4.6) y, si el ledger no está disponible, la intervención se suprime antes que contaminar la
medición (§4.7; constitución II). Hasta la 006 los puertos del ledger (`DecisionLedger`,
`ExposureLedger`) devolvían `void` o un estado sin contemplar la indisponibilidad, porque la
única implementación era en memoria. La persistencia real (008) va a poner una base de datos
detrás; si la semántica se decide entonces, el código de la 007 nace asumiendo escrituras
síncronas e infalibles.

## Decisión

1. **Toda escritura al ledger devuelve un resultado explícito.** `RecordOutcome = "accepted" |
"unavailable"` (tipo del `shared-kernel` de aplicación). `DecisionLedger.record` y
   `AssignmentLedger.record` lo devuelven; `ExposureLedger.record` devuelve `"recorded" |
"already-recorded" | "unavailable"`. Ningún puerto lanza por indisponibilidad.
2. **"Aceptado" significa aceptado en el buffer de escritura**, no durable todavía: la
   implementación real escribe diferido y por lotes, con un buffer acotado y una cola muerta
   observable (01 §11). El camino crítico no espera la durabilidad. En memoria la aceptación
   es inmediata.
3. **"No disponible" significa buffer lleno o almacén caído**, y el orquestador falla cerrado:
   - ingesta → decisión `NO_OP` con motivo `ledger-unavailable`, `202`, sin registrar la
     decisión (la intervención queda suprimida; un lote aceptado no se reintenta);
   - confirmación de exposición → `503` con `Retry-After` y tipo `ledger-unavailable`: el SDK
     tiene que saber que no quedó registrada, porque una exposición sin registro contamina
     el experimento.
4. **Orden de la ingesta**: invariantes → asignación → deduplicación → decisión → registro. Si
   el registro de la decisión falla después de reclamar la deduplicación, el lote ya
   respondió `202` y el hecho queda en el log operativo; no se revierte la asignación (asignar
   es registrar la intención de tratar, no la decisión).
5. **Compatibilidad**: declarar la `503` en una operación existente es compatible — una
   respuesta 5xx nueva es una condición del servidor, no una forma nueva de rechazar a un
   cliente válido — y precisa ADR-003: sólo una 4xx nueva sube la versión mayor.
6. **El camino de degradación se prueba siempre**, con ledgers falsos que reportan
   `unavailable`, aunque la implementación vigente nunca lo haga.

## Consecuencias

- La 008 implementa el buffer, los lotes, la cola muerta y el circuit breaker detrás de estos
  puertos sin tocar dominio ni aplicación.
- `ledger-unavailable` entra al catálogo de motivos de `NO_OP` y al de tipos de problema
  (`503`); `confirmExposure` declara la `503`.
- Un ledger que "acepta" y pierde la escritura después es una violación de este ADR que la
  observabilidad (cola muerta) tiene que hacer visible; no se disfraza de éxito.
