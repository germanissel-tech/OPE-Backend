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
   que el composition root conozca a todos (ADR-013), el `mapping` que se quita en runtime
   (ADR-014), el alias de TypeScript (ADR-017) son decisiones, no defectos. Un ADR justifica **lo
   que dice**, no lo que se le parece: ADR-013 no dice que el root pueda elegir el perfil con un
   `if`, inferir el orden de cierre, cargar módulos desde el entorno ni enumerar las
   operaciones de todos los módulos (dice lo contrario: cada módulo se cablea solo). ADR-018
   dice que no hay modos: "es sólo un flag para el mock" no justifica un `mode` en tres capas.
3. **¿La prueba propuesta fallaría hoy?** Si `coveringTest` no puede fallar con el código actual,
   el hallazgo no describe un defecto observable.
4. **¿Cambia por el mismo motivo?** Dos bloques parecidos son DRY si evolucionan por razones
   distintas (dos invariantes, dos merchants, dos operaciones). Sólo es duplicación de
   conocimiento si una regla vive en dos lugares y podrían divergir.
5. **¿Es una preferencia?** "Yo lo escribiría distinto" no es un hallazgo. Sin fuente
   (`constitution#`, `ADR-`, `guide#`, `lint:`, `arch:`), como mucho es `clarity:<slug>`.

## Por principio

- **SRP**: ¿las dos "responsabilidades" que se ven cambian juntas siempre? Entonces son una.
- **Composition root**: que sea el root justifica que conozca a todos los **módulos**; **no**
  justifica un `if` sobre configuración, un orden de cierre inferido, overrides resueltos ahí,
  un seam de pruebas ni un mapa central de operaciones o casos de uso. "Es chico y está
  cableado a mano" y "hoy son tres" no refutan nada de eso: la lista crece con cada operación
  de cada módulo, no con cada módulo.
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
  lenguaje ubicuo, no un nombre pobre. ¿El literal "mágico" está en una posición que el
  compilador verifica contra una unión de literales (`ProblemSlug`, `NodeJS.Signals`, una
  clave declarada)? Entonces el tipo es la constante y el literal se queda. "Es el nombre de la
  señal, todo el mundo lo conoce" **no** refuta la repetición hacia un `string` sin tipar.
- **Errores**: ¿el `catch` tiene un comentario que explica por qué se ignora, o el bloque `try`
  es una sola sentencia simple? `sonarjs/no-ignored-exceptions` lo admite; el hallazgo también.

## Señales de hallazgo débil

- `evidence` parafrasea en vez de citar.
- `proposal.after` es prosa ("extraer una función") en vez de código.
- `rule.source` es `clarity:` pero la severidad propuesta es `high`.
- El mismo hallazgo aparece en tres archivos con el mismo texto: probablemente es un patrón
  del repo (buscar el ADR) o un gate que falta, no tres defectos.
