# Data model — Las instrucciones tienen criterio de admisión y gate (024)

No hay entidades de dominio: esta feature no toca `src/`. Lo que sí hay es un **vocabulario** que la
política declara y el gate verifica. Está acá para que la historia 1 y la 2 usen las mismas palabras.

## La política de las instrucciones

Un archivo declarado, como `scripts/readme-inventory-policy.json` lo es para los README (ADR-032).
Cuatro cosas, y nada más:

| Qué declara           | Para qué                                                |
| --------------------- | ------------------------------------------------------- |
| **Secciones**         | cada encabezado del documento, con su clase (ver abajo) |
| **Raíces implícitas** | las seis con las que el documento abrevia una ruta      |
| **Formas no-ruta**    | qué se escribe con barras y no apunta a un lugar        |
| **Excepciones**       | lo que a propósito no resuelve, cada una con su motivo  |

Se verifica **en los dos sentidos**, que es la parte que obliga a decidir: una sección del documento
sin entrada en la política es un problema, y una entrada para una sección que no existe también.

## La clase de una sección

| Clase           | Qué significa                                          | Dónde vive el contenido                                                          |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **normativa**   | dice **qué hacer**: un agente la obedece               | acá, no tiene otro hogar                                                         |
| **descriptiva** | dice **cómo es el sistema hoy**: un agente la consulta | en su ADR, contrato o README; acá queda el puntero                               |
| **mixta**       | tiene párrafos de las dos                              | se separa cuando se la toca; declararla mixta es admitir la deuda, no esconderla |

`mixta` no es un escape: es una tercera clase que apareció al aplicar el criterio a las catorce
secciones de hoy (research R-05) y que **nombra una deuda concreta** en tres secciones. Una sección
nueva declarada `mixta` sin motivo es lo mismo que no declararla.

## Las tres formas de una referencia

Cada cosa que el documento nombra entre comillas de código cae en una, y cada una se verifica contra
una fuente distinta. Esto es lo que evita los 75 falsos positivos medidos.

| Forma             | Ejemplo                  | Se verifica contra                               | Quién lo hace                  |
| ----------------- | ------------------------ | ------------------------------------------------ | ------------------------------ |
| **Identificador** | `AssignmentService`      | contrato, catálogos, `src/`, tooling             | `check:identifiers`, extendido |
| **Ruta**          | `src/domain/experiment/` | el disco, con las raíces declaradas              | la verificación nueva          |
| **Comando**       | `npm run quality`        | los scripts del repositorio, en los dos sentidos | la verificación nueva          |

## Lo que se escribe con barras y no es una ruta

Tres formas, reconocidas **por su forma y no por una lista de nombres** — una lista de diecinueve
nombres es una lista que envejece:

| Forma                      | Ejemplos                                          | Por qué no es una ruta                                                                  |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Nombre de forma**        | `errors.ts`, `services/`, `ports/`, `index.ts`    | dice «un archivo así **en cada** módulo»; no apunta a uno                               |
| **Identificador de regla** | `ope/no-magic-strings`, `ope/use-case-shape`      | la barra es del plugin, no del sistema de archivos; ya las verifica `check:identifiers` |
| **Referencia externa**     | `origin/main`, `merchantId/orderId`, `HANDOFF.md` | no es del árbol de archivos, o existe sólo a veces                                      |

## La excepción declarada

Una referencia que a propósito no resuelve. **Con motivo escrito, o falla** — el mismo trato que
`scripts/identifiers-allowlist.json` le da hoy a `TS2882`, `OPE_MOCK` o `treatmentPercent`, y que
las excepciones de lint reciben en línea.

Previsibles al empezar: `multipleOf` (palabra de JSON Schema, no un identificador del sistema),
`prepare` y `postinstall` (ganchos de npm, no comandos que un agente invoque).

## Lo que el gate **no** verifica, y queda escrito

Que la prosa diga la verdad. Sólo verifica que **lo nombrado exista**. Un gate en verde no significa
que el documento sea correcto; significa que no cita nada que no esté. La diferencia se escribe
junto al criterio para que nadie la confunda.
