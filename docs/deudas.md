# Registro de deudas técnicas

Lo que se sabe que falta, con su estado. **Vale por ser completo**: una deuda que existe y no está
acá vale menos que no tener registro, porque da la impresión de que no hay.

Vive en `docs/` y no dentro de la especificación de una feature **a propósito** (feature 026):
`specs/` es histórico y fechado —el registro de lo que una feature decidió— y esto es lo contrario,
recibe filas de features que todavía no existen. Mientras estuvo adentro de la spec de la 019, dos
features nombraron cuatro deudas y ninguna llegó acá: las escribieron donde estaban trabajando,
que es lo que hace alguien que no sabe dónde va.

## Cómo se agrega una fila

Cuando aparece algo que se sabe que falta y no se va a hacer ahora, **la fila se escribe acá en el
mismo momento**, no en el archivo donde uno está trabajando ni en el `research.md` de la feature.

- **Id**: `D-NN`, correlativo. Una deuda no cambia de número.
- **Título**: qué falta, en una línea, escrito como **el problema** y no como la solución.
- **Origen**: de dónde salió — una revisión, una feature, una evaluación con el dueño.
- **Estado**: `abierta` (registrada, sin decidir) · `evaluada` (se miró y se decidió esperar) ·
  `implementada` (cerrada) · `descartada` (no se va a hacer, con el motivo).
- **Fecha**: cuándo se registró.
- **Cierre**: dónde quedó cerrada. Vacío mientras esté abierta.

Una deuda que **no se puede cerrar** en la feature que la intentó se queda `abierta` con el motivo
escrito. Cerrarla por decreto es peor que dejarla anotada.

## Registro

| Id   | Título                                                                         | Origen                         | Estado         | Fecha      | Cierre    |
| ---- | ------------------------------------------------------------------------------ | ------------------------------ | -------------- | ---------- | --------- |
| D-01 | La skill de auditoría de arquitectura está acoplada a este repo                | Revisión del dueño tras la 018 | `implementada` | 2026-09-21 | `5571829` |
| D-02 | No hay skill de acondicionamiento: un proyecto no puede volverse auditable     | Evaluación con el dueño (D-01) | `implementada` | 2026-09-21 | `eec62b3` |
| D-03 | `engineering-baseline`: scaffold opinado con la cadena de calidad de este repo | Evaluación con el dueño (D-02) | `evaluada`     | 2026-09-21 | —         |
| D-04 | `config/` sin documentación ni esquema propio                                  | Revisión del dueño, 2026-09-21 | `implementada` | 2026-09-21 | `d37093b` |
| D-05 | `contracts/` sin README ni tabla de extensiones `x-*`                          | Revisión del dueño, 2026-09-21 | `implementada` | 2026-09-21 | `8ffe84e` |
| D-06 | Los directorios de primer nivel no se explican solos                           | Revisión del dueño, 2026-09-21 | `implementada` | 2026-09-21 | `cd292e0` |
| D-07 | `Convenciones` mezcla reglas que se obedecen con descripciones del sistema     | Feature 025                    | `abierta`      | 2026-09-24 | —         |
| D-08 | `Gates de calidad` mezcla la regla de mutación con los umbrales del linter     | Feature 025                    | `abierta`      | 2026-09-24 | —         |
| D-09 | `Anillos y módulos` mezcla la tabla de anillos con la lista de módulos         | Feature 025                    | `abierta`      | 2026-09-24 | —         |
| D-10 | El procedimiento del gate de mutación está escrito como una instrucción        | Feature 025                    | `abierta`      | 2026-09-24 | —         |
| D-11 | La regla `profiles-compose-modules` vigila un directorio que ya no existe      | Feature 026                    | `abierta`      | 2026-09-24 | —         |

Las filas D-01 a D-06 vienen de la feature 019, que creó este registro dentro de su propia
especificación; ahí queda su historia.

D-11 apareció **al separar**, no antes: ADR-033 reemplazó los perfiles por despliegues y la regla
de dependency-cruiser se quedó apuntando a `src/composition/profiles/`, que ya no existe, así que
hoy no puede dispararse. Arreglarla es cambiar un gate, no documentación; por eso se registra en
vez de arrastrarse dentro de la 026.

## Lo que **no** es deuda, y por eso no está acá

| Qué                                                                         | Dónde vive                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Las decisiones del MVP todavía sin cerrar (hosting, piloto, datos, muestra) | ADR-010: son decisiones pendientes, no algo mal hecho |
| Los hitos con operaciones planeadas                                         | el roadmap de `contracts/api-map.yaml`                |
| Un esquema de seguridad que espera su primera operación                     | ADR-020, marcado como propuesto                       |

La diferencia importa: una decisión pendiente no se «cierra» arreglando algo, y un hito planeado ya
tiene su lugar. Mezclarlos acá haría que el registro dejara de decir qué falta **arreglar**.
