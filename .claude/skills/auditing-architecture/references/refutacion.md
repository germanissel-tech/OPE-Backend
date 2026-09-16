# Segunda pasada: refutar cada hallazgo

Todo hallazgo nace `proposed`. Antes de confirmarlo, intentar tirarlo abajo con estas
preguntas. Si alguna lo tira, pasa a `refuted` con la razón en `refutation`; queda en el anexo
del reporte, no en la lista principal. Un hallazgo que sobrevive a todas pasa a `confirmed`.

## Contenido

- Preguntas generales
- Por principio
- Señales de hallazgo débil

## Preguntas generales

1. **¿Ya lo reporta un gate?** Si `lint`, `arch`, `shape`, `check:duplication` o
   `check:dead-code` lo listan, el hallazgo cognitivo es ruido: citar el gate y refutar, salvo
   que el hallazgo aporte el caso que la regla no ve (decirlo en `evidence`).
2. **¿Hay un ADR que lo justifique?** Buscar en `docs/adr/` antes de afirmar que algo "está mal":
   el composition root grande (ADR-013), el `mapping` que se quita en runtime (ADR-014), el alias
   de TypeScript (ADR-017) son decisiones, no defectos.
3. **¿La prueba propuesta fallaría hoy?** Si `coveringTest` no puede fallar con el código actual,
   el hallazgo no describe un defecto observable.
4. **¿Cambia por el mismo motivo?** Dos bloques parecidos son DRY si evolucionan por razones
   distintas (dos invariantes, dos merchants, dos operaciones). Sólo es duplicación de
   conocimiento si una regla vive en dos lugares y podrían divergir.
5. **¿Es una preferencia?** "Yo lo escribiría distinto" no es un hallazgo. Sin fuente
   (`constitution#`, `ADR-`, `guide#`, `lint:`, `arch:`), como mucho es `clarity:<slug>`.

## Por principio

- **SRP**: ¿las dos "responsabilidades" que se ven cambian juntas siempre? Entonces son una.
- **OCP**: ¿el `switch` enumera un catálogo cerrado por diseño (`EventType`, `ProblemSlug`) con
  `switch-exhaustiveness-check`? Eso es OCP cumplido por el compilador, no violado.
- **LSP**: ¿la diferencia de comportamiento entre implementaciones está declarada en el puerto
  (`Promise<T> | T`)? Entonces no es una violación.
- **ISP**: ¿el puerto "grande" tiene un solo consumidor que usa todo? ISP no pide dividir por
  dividir.
- **DIP**: ¿el `new` está en `composition/`, `infrastructure/` o un gateway? Ahí es su lugar.
- **DRY**: ¿la "réplica" tiene prueba de réplica (`problem-types.yaml` ↔ `problem-details.ts`)?
  Entonces es la técnica elegida (ADR-002), no duplicación.
- **Claridad**: ¿el nombre corto es un término del glosario (`docs/dominio/`)? Entonces es el
  lenguaje ubicuo, no un nombre pobre.
- **Errores**: ¿el `catch` tiene un comentario que explica por qué se ignora, o el bloque `try`
  es una sola sentencia simple? `sonarjs/no-ignored-exceptions` lo admite; el hallazgo también.

## Señales de hallazgo débil

- `evidence` parafrasea en vez de citar.
- `proposal.after` es prosa ("extraer una función") en vez de código.
- `rule.source` es `clarity:` pero la severidad propuesta es `high`.
- El mismo hallazgo aparece en tres archivos con el mismo texto: probablemente es un patrón
  del repo (buscar el ADR) o un gate que falta, no tres defectos.
