# Data model — Las cuatro deudas de las instrucciones (026)

No hay entidades de dominio: la feature no toca `src/`. Lo que hay es **el vocabulario del registro**
y **el reparto de cada sección**, que es lo que las tareas ejecutan.

## La deuda

| Campo      | Qué es                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| **Id**     | `D-NN`, correlativo y estable; una deuda no cambia de número            |
| **Título** | qué falta, en una línea, escrito como el problema y no como la solución |
| **Origen** | de dónde salió: una revisión, una feature, una evaluación con el dueño  |
| **Estado** | `abierta` · `evaluada` · `implementada` · `descartada`                  |
| **Fecha**  | cuándo se registró                                                      |
| **Cierre** | dónde quedó cerrada. Vacío mientras esté abierta                        |

**Un registro vale por ser completo.** Una deuda que existe y no está registrada vale menos que no
tener registro: da la impresión de que no hay.

## Dónde vive, y por qué se muda

|                         |                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hoy**                 | dentro de `specs/019-deudas-tecnicas/spec.md`, el documento de una feature cerrada                                                                                |
| **Pasa a**              | `docs/deudas.md`, con su fila en el inventario de `docs/`                                                                                                         |
| **Por qué**             | la convención del repositorio dice que lo de `specs/` es **histórico y fechado**; un registro de deuda **vive** y recibe filas de features que todavía no existen |
| **Qué queda en la 019** | su tabla, como historia de esa feature, apuntando al registro                                                                                                     |

## Las cuatro filas que entran

| Id       | Título                                                                     | Origen      | Estado al abrir |
| -------- | -------------------------------------------------------------------------- | ----------- | --------------- |
| **D-07** | `Convenciones` mezcla reglas que se obedecen con descripciones del sistema | Feature 025 | `abierta`       |
| **D-08** | `Gates de calidad` mezcla la regla de mutación con los umbrales del linter | Feature 025 | `abierta`       |
| **D-09** | `Anillos y módulos` mezcla la tabla de anillos con la lista de módulos     | Feature 025 | `abierta`       |
| **D-10** | El procedimiento del gate de mutación está escrito como instrucción        | Feature 025 | `abierta`       |

## El reparto, sección por sección

Decidido **viñeta por viñeta**, no por el título (research R-02 a R-04).

### D-07 · `Convenciones` — 44 líneas, en el núcleo

| Se va                                                                                                                                       | Se queda                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| El cuerpo de «ninguna política vive en el código»: qué contiene cada nivel, quién resuelve, qué puertos entregan (~13 líneas) → **ADR-031** | La regla: **un valor de comportamiento nuevo es una entrada en un nivel, nunca una constante**                                  |
|                                                                                                                                             | Las otras siete viñetas: tipado, tasas, literales, `NO_OP`, qué explica un comentario, cómo se marcan las afirmaciones, commits |

**Efecto**: 44 → ~31; el núcleo, 195 → ~182.

### D-08 · `Gates de calidad` — 58 líneas, en su regla

| Se va                                                                                   | Se queda                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Los umbrales del lint → **su configuración**, que ya lleva la justificación de cada uno | **Un cambio no entra si un mutante de sus propias líneas sobrevive** |
| Los de duplicación y código muerto → sus configuraciones                                | Las excepciones van en línea y con motivo                            |
| Los de forma de los anillos → su script                                                 | El ritmo de las pruebas, en dos velocidades                          |

### D-09 · `Anillos y módulos` — 90 líneas, en su regla

| Se va                                                                               | Se queda                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| La lista de módulos que existen hoy (~12) → **`CONTEXT_MAP`**, su fuente verificada | La **tabla de anillos**: qué puede importar de qué                                     |
| El detalle de la composición (~45) → **ADR-033**                                    | La regla de la composición: un módulo declara tres cosas y no hay resolución por texto |
| Lo de fuera de `src/` (~7) → ADR-013 y los README                                   | Dónde va lo que comparten los controllers                                              |

**Efecto**: 90 → ~35.

### D-10 · El procedimiento — 16 líneas

|                                          |                                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qué es**                               | cuatro pasos en orden ante un mutante que sobrevive: describir el daño, clasificarlo, la prueba o la reestructuración, confirmar con una corrida acotada |
| **Cómo se sabe que es un procedimiento** | su propio texto dice «ante un superviviente, **en este orden**»                                                                                          |
| **Destino**                              | una skill, que es donde vive lo que se ejecuta paso a paso                                                                                               |
| **Qué queda en la regla**                | que existe y cómo se la invoca                                                                                                                           |
| **Restricción**                          | la skill **no importa nada del repositorio por ruta**, como las dos que ya hay                                                                           |

## Lo que no es una deuda, y por eso no entra al registro

|                                                                                           | Por qué                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Las decisiones de producto abiertas (hosting, merchant piloto, régimen de datos, muestra) | Son decisiones pendientes, no algo mal hecho; su ADR ya fija que ninguna feature puede asumirlas |
| Los hitos del roadmap con operaciones planeadas                                           | Es trabajo planeado, con su lugar en el mapa del contrato                                        |
| Un esquema marcado como propuesto                                                         | Espera su primera operación                                                                      |
