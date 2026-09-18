---
numero: 24
titulo: Dominio rico — invariantes por construcción y reglas con su dueño
estado: aceptada
fecha: 2026-09-18
fuente: specs/009-dominio-rico/research.md
---

# ADR-024 — Dominio rico: invariantes por construcción y reglas con su dueño

## Contexto

Hasta la 008 el dominio era un modelo anémico: tipos de datos y, aparte, funciones que los
validaban (`checkBatch`, `assignArm`, `originAllowed`). Nada impedía construir un lote que
mezcla sesiones o una decisión `INTERVENE` sin intervención; el reparto del experimento se
validaba en la configuración y el gateway construía entidades sin regla alguna; una política
publicada en el contrato (la ventana de deduplicación) vivía en un gateway; el dominio guardaba
un porcentaje contra la convención de tasas; y los puertos admitían respuestas síncronas.

## Decisión

1. **Clase si hay reglas, tipo si no.** Un concepto con invariantes o comportamiento
   (`EventBatch`, `Decision`, `Experiment`, `Merchant`, `Origin`) es una clase con constructor
   privado, `static of(...)` que devuelve `Result<T, E>` con los errores de su módulo y
   `static rehydrate(...)` que reconstruye desde datos ya registrados sin reevaluar las reglas de
   creación. Si tenés la instancia, es válida. Un valor sin reglas (`Exposure`, `Assignment`,
   identificadores, `Arm`, `ServiceHealth`) sigue siendo un tipo.
2. **Las reglas viven con su dueño y se invocan por su nombre.** `experiment.assign(visitorId)`,
   `merchant.allowsOrigin(origin)`, `decision.isIntervention()`. `src/domain/` no exporta
   funciones sueltas (regla `ope/domain-no-loose-functions` con fixture); excepción: las
   primitivas del `shared-kernel` (constructores de identificadores, `ok`/`fail`, tiempo).
3. **Estados ilegales irrepresentables.** `Decision` es la unión `NoOpDecision | InterveneDecision`
   discriminada por `outcome`; `NO_OP` lleva un motivo del catálogo tipado (`NoOpReason`, que
   pasa al `shared-kernel` del dominio por ser vocabulario compartido) y `INTERVENE` lleva su
   intervención obligatoria.
4. **Las invariantes se validan en su dueño; nadie las esquiva.** La configuración construye por
   fábrica y traduce un fallo a `ConfigError` fail-closed que nombra el campo; los gateways
   reciben entidades, no registros. Los errores de configuración son `DomainError` y figuran en
   el catálogo de problemas aunque ningún endpoint los emita.
5. **Convención de tasas**: `Experiment.treatmentShare` es 0–1; el porcentaje 0–100 existe sólo
   en `OPE_MERCHANTS`. El reparto resuelve a buckets enteros: el umbral es
   `Math.round(share × 100)`, porque `n / 100 × 100` no es exacto en punto flotante (7 → 7,000…01)
   y la comparación directa cambiaría el brazo de algunos visitantes. La asignación es idéntica
   a ADR-022 para los 101 porcentajes (verificada con un fingerprint de 100 000 visitantes).
6. **Las políticas publicadas en el contrato viven en dominio o aplicación.** La ventana de
   deduplicación se declara en `application/ingestion` y el gateway la recibe.
7. **Todo puerto devuelve `Promise`.** La persistencia real no cambiará ninguna firma.

## Consecuencias

- Un consumidor de `EventBatch`, `Experiment`, `Merchant` o `Decision` no valida nada: el tipo
  lo garantiza. Un caso de uso nuevo no reimplementa reglas; las pide al dueño.
- Una entidad nueva es una clase en su módulo con sus errores en `errors.ts` y sus entradas en
  el catálogo; la guía de agentes describe la forma.
- La rehidratación confía en los datos registrados: un endurecimiento posterior de una regla
  no invalida hechos pasados.
- PROPUESTO (feature 011, plano de decisión I): `EventBatch.noOpReason()` es el stub del plano
  de decisión (`page-context-incomplete` / `decision-plane-unavailable`) y **se muda al módulo
  `decision`** cuando exista; hasta entonces es comportamiento del lote. Este marcador se cierra
  en la spec de la 011.
