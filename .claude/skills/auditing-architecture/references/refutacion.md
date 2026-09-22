# Segunda pasada: refutar cada hallazgo

Todo hallazgo nace `proposed`. Antes de confirmarlo, intentar tirarlo abajo con estas
preguntas. Si alguna lo tira, pasa a `refuted` con la razón en `refutation`; queda en el anexo
del reporte, no en la lista principal. Un hallazgo que sobrevive a todas pasa a `confirmed`.

## Contenido

- Preguntas generales
- Por principio
- Señales de hallazgo débil

## Preguntas generales

1. **¿Ya lo reporta un gate?** Si un gate del perfil lo lista, el hallazgo cognitivo es ruido:
   citar el gate y refutar, salvo que el hallazgo aporte el caso que la regla no ve (decirlo en
   `evidence`).
2. **¿Hay una decisión registrada que lo justifique?** Buscar en las fuentes de verdad del
   proyecto (las clases `high` del perfil: ADR, constitución) antes de afirmar que algo "está
   mal": lo que un ADR decidió es una decisión, no un defecto. Una decisión justifica **lo que
   dice**, no lo que se le parece: leerla entera y citar la frase. El documento de criterios del
   proyecto trae los casos típicos en los que una decisión se invoca de más.
3. **¿La prueba propuesta fallaría hoy?** Si `coveringTest` no puede fallar con el código actual,
   el hallazgo no describe un defecto observable.
4. **¿Cambia por el mismo motivo?** Dos bloques parecidos son DRY si evolucionan por razones
   distintas (dos invariantes, dos merchants, dos operaciones). Sólo es duplicación de
   conocimiento si una regla vive en dos lugares y podrían divergir.
5. **¿Es una preferencia?** "Yo lo escribiría distinto" no es un hallazgo. Sin una fuente de
   las que el perfil declara, como mucho es de la clase de claridad (severidad baja).

## Por principio

- **SRP**: ¿las dos "responsabilidades" que se ven cambian juntas siempre? Entonces son una.
- **Composition root**: que sea el root justifica que conozca a todos los **módulos**; **no**
  justifica decidir sobre configuración, inferir un orden, resolver overrides, abrir un seam
  de pruebas ni mantener un mapa central de operaciones o casos de uso. "Es chico y está
  cableado a mano" y "hoy son tres" no refutan nada de eso: la lista crece con cada operación
  de cada módulo, no con cada módulo.
- **OCP**: ¿el `switch` enumera un catálogo cerrado por diseño y el compilador exige
  exhaustividad? Eso es OCP cumplido por el compilador, no violado.
- **LSP**: ¿la diferencia de comportamiento entre implementaciones está declarada en el puerto?
  Entonces no es una violación.
- **ISP**: ¿el puerto "grande" tiene un solo consumidor que usa todo? ISP no pide dividir por
  dividir.
- **DIP**: ¿la instanciación concreta está donde el proyecto la permite (composición,
  infraestructura, adaptadores)? Ahí es su lugar.
- **DRY**: ¿la "réplica" tiene una prueba de réplica que la mantiene igual a su fuente?
  Entonces es una técnica elegida, no duplicación.
- **Claridad**: ¿el nombre corto es un término del lenguaje ubicuo del proyecto? Entonces no es
  un nombre pobre. ¿El literal "mágico" está en una posición que el compilador verifica contra
  una unión de literales? Entonces el tipo es la constante y el literal se queda. "Todo el mundo
  lo conoce" **no** refuta la repetición hacia un `string` sin tipar.
- **Errores**: ¿el `catch` tiene un comentario que explica por qué se ignora, o el bloque `try`
  es una sola sentencia simple? La regla de lint lo admite; el hallazgo también.

Los casos típicos de cada proyecto (qué decisión se invoca de más, qué réplicas tienen prueba,
qué catálogos son cerrados) están en su documento de criterios (`profile.criteria`).

## Señales de hallazgo débil

- `evidence` parafrasea en vez de citar.
- `proposal.after` es prosa ("extraer una función") en vez de código.
- `rule.source` es `clarity:` pero la severidad propuesta es `high`.
- El mismo hallazgo aparece en tres archivos con el mismo texto: probablemente es un patrón
  del proyecto (buscar la decisión) o un gate que falta, no tres defectos.
