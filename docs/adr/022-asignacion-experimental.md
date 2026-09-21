---
numero: 22
titulo: Asignación experimental — función, clave, registro y motivo visible
estado: aceptada
fecha: 2026-09-17
fuente: specs/007-asignacion-experimental/research.md
---

# ADR-022 — Asignación experimental: función, clave, registro y motivo visible

## Contexto

La constitución III exige una asignación CONTROL/TREATMENT determinista y estable por
`visitorId`, sin estado compartido, registrada al asignar (no al exponer), y que CONTROL
atraviese el mismo pipeline resolviendo siempre `NO_OP`. 01-arquitectura-mvp.md §14.2 fija que
la asignación no es una bandera: nadie la cambia. Hay que elegir la función, la clave, dónde
vive el experimento y qué ve el SDK.

## Decisión

1. **Función**: `arm = fnv1a32(clave) % 100 < treatmentPercent ? TREATMENT : CONTROL`, con
   `clave = merchantId ␟ experimentId ␟ seed ␟ visitorId` (U+001F como separador). FNV-1a de
   32 bits en TypeScript puro dentro del dominio: sin `node:crypto`, sin puerto, mismo resultado
   en cualquier instancia. Verificado sobre 100 000 visitantes (aleatorios y secuenciales):
   desviación < 0,3 pp del reparto, independencia entre merchants ≈ 50 %.
2. **Experimento por configuración** (esta feature): `experiments` dentro de la configuración
   del merchant (`experimentId`, `treatmentPercent` 0..100 con 50 por defecto, `seed`,
   `status`, `openedAt`); como máximo uno abierto por merchant, validado
   fail-closed al arrancar. Desde la feature 017 (ADR-031) el experimento lo abre, activa y
   cierra la administración (`calibrating → active → closed`) y la semilla es sólo el arranque
   de un store vacío. **Semilla y reparto son inmutables**: cambiarlos es un experimento
   nuevo con otro identificador. Si el brazo calculado difiere del registrado, gana el
   registrado y se loguea `assignment-drift` como error operativo. La **política de decisión**
   del merchant es parte del experimento con la misma regla (ADR-026): cambiarla con un
   experimento activo es un experimento nuevo; cada decisión estampa `policyVersion`.
3. **Registro `ASSIGNED`**: en el ledger de asignaciones con el primer lote aceptado del
   visitante en el experimento (clave merchant + experimento + visitante; idempotente). Un lote
   rechazado no asigna. Sin experimento activo no se asigna y la decisión es `NO_OP`
   `no-active-experiment`.
4. **CONTROL** recorre el pipeline entero y la decisión es `NO_OP` con motivo `control-arm`;
   la decisión registra brazo y experimento. **El brazo y el experimento no viajan como
   campos** en ninguna respuesta ni request; el motivo sí (un solo catálogo, visible al SDK:
   decisión del usuario, 2026-09-17), porque la respuesta dice lo mismo que el ledger
   (constitución II) y saberlo no altera la asignación.

## Consecuencias

- El módulo `experiment` entra al mapa de contextos (`experiment: [shared-kernel]`;
  `ingestion` depende de él).
- El plano de decisión (011+) recibe el brazo desde la decisión y no vuelve a calcularlo.
- Las lecturas del portal y el análisis ITT (feature "ITT analysis and merchant portal") parten del ledger de asignaciones, no de
  las exposiciones.
- Holdout (DECIDIDO, ADR-026): todo merchant conserva un grupo de control mínimo,
  `holdoutPercent` con 5 % por defecto; `treatmentPercent ≤ 100 − holdout`. El tope se aplica
  con la configuración por API (feature "Configuration, flags, kill switch and administration").
- Precisión (feature 017, 2026-09-20; ADR-031): el experimento tiene tres estados —
  `calibrating` (se asigna y se decide; las decisiones se marcan y no cuentan), `active` (la
  ventana de acumulación empieza al activarlo y la configuración queda congelada) y `closed`
  (terminal)—; lo abre, activa y cierra un operador por la API de administración; como máximo
  uno abierto por merchant. El holdout se aplica al abrir un experimento por API.
