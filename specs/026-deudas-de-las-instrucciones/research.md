# Research — Las cuatro deudas de las instrucciones (026)

Todo lo de acá se midió en la rama `026-deudas-de-las-instrucciones`, que sale de `main`
(`fdeea10`). Cada decisión cita su evidencia y qué se descartó.

---

## R-01 — El registro se muda: un registro vivo no vive dentro de un documento histórico

**Decisión**: el registro de deudas pasa a `docs/deudas.md`, con su fila en el inventario de
`docs/`. La tabla de `specs/019-deudas-tecnicas/spec.md` queda como estaba —es historia— y apunta al
registro nuevo.

**Evidencia, y explica por qué nadie registró estas cuatro.** El repositorio tiene escrita su propia
convención: «las tablas de estado de `specs/*/quickstart.md` son **históricas y fechadas**». Un
`specs/NNN-*/` es el registro de **una** feature: lo que se decidió, se planeó y se hizo, con su
fecha. Un registro de deuda técnica es lo contrario: **vive**, recibe filas de features que todavía
no existen y se lee para saber el estado de hoy.

Meter uno dentro del otro tiene dos efectos medibles:

1. **El documento de una feature cerrada crece para siempre** con contenido que no es suyo. La 019
   ya recibió cuatro ediciones posteriores a su cierre, todas para marcar estados.
2. **Nadie lo encuentra.** Para registrar una deuda de la feature 025 hay que saber que el registro
   está en la spec de la 019. Las features 024 y 025 escribieron sus deudas en el lugar donde
   estaban trabajando —la política de instrucciones y un `research.md`— que es lo que hace alguien
   que no sabe dónde va.

`docs/` es el hogar natural: ya hospeda lo vivo —los ADR, el glosario, la auditoría— y tiene su
`README.md` con inventario (ADR-032), así que el registro nuevo entra con su fila y queda verificado
por la prueba que ya existe.

**Descartado: dejarlo en la 019.** Habría que aceptar que el documento de una feature cerrada es el
lugar donde se anota lo que pasa después, que es lo contrario de lo que la convención del
repositorio dice de `specs/`.

---

## R-02 — D-07: qué se va de `Convenciones`, viñeta por viñeta

**Decisión**: se va **una sola viñeta**, la primera, y sólo su cuerpo descriptivo. Las otras siete
se quedan.

**Evidencia**. Leída viñeta por viñeta contra la pregunta «¿dice qué hacer o describe cómo es el
sistema?»:

| Viñeta                             | Líneas | Veredicto                                                                                                    |
| ---------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------ |
| Ninguna política vive en el código | **15** | **mixta**: la regla son dos líneas; las otras trece describen los tres niveles, sus contenidos y sus puertos |
| TypeScript, módulos, ids marcados  |      7 | normativa                                                                                                    |
| Tasas como fracciones de 1         |      2 | normativa                                                                                                    |
| Literales de la plataforma         |      5 | normativa                                                                                                    |
| `NO_OP` y `DomainError`            |      2 | normativa                                                                                                    |
| Qué explica un comentario          |     10 | normativa (larga, pero es la regla)                                                                          |
| Marcar afirmaciones                |      2 | normativa                                                                                                    |
| Commits                            |      3 | normativa                                                                                                    |

La regla de la primera viñeta es: **un valor de comportamiento nuevo es una entrada en un nivel,
nunca una constante**, y un gate la vigila. Todo lo demás —qué contiene cada nivel, quién resuelve,
qué puertos lo entregan— es la descripción de una decisión que ADR-031 ya tomó.

**Efecto**: `Convenciones` pasa de 44 a ~31 líneas, y el núcleo de 195 a ~182.

**Y un hallazgo que no estaba en la lista**: «Sin `any`» aparece **dos veces en el núcleo**, en la
viñeta de tipado (línea 57) y en ésta (línea 163). Es duplicación dentro del mismo archivo, que es
justo lo que el criterio existe para evitar. Se resuelve al separar, sin trabajo extra.

---

## R-03 — D-08: los umbrales describen su configuración

**Decisión**: se van las tres viñetas de umbrales; se quedan las tres normativas y el procedimiento
sale por D-10.

**Evidencia**:

| Viñeta                             | Veredicto                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Forma del código en el lint        | **descriptiva**: enumera los umbrales de `eslint.config.mjs`, que ya lleva la justificación de cada uno |
| Duplicación y código muerto        | **descriptiva**: los números de `jscpd` y `knip.json`                                                   |
| Mutación: un mutante que sobrevive | **normativa** — la regla. Se queda                                                                      |
| Forma de los anillos               | **descriptiva**: los umbrales de `scripts/shape-rules.mjs`                                              |
| Excepciones en línea con motivo    | **normativa**. Se queda                                                                                 |
| Cómo se trabaja el gate            | **D-10** (ver R-05)                                                                                     |
| Ritmo de las pruebas               | **normativa**: qué se corre por historia y qué por hito. Se queda                                       |

Los tres descriptivos tienen la misma fuente: **el archivo de configuración que los declara**, que
es donde alguien va a mirarlos cuando los cambie. Duplicarlos en una instrucción los condena a
quedar viejos, que es exactamente lo que la feature 024 encontró en otro lado.

---

## R-04 — D-09: la lista de módulos y el detalle de la composición

**Decisión**: se van dos bloques —la lista de módulos y el detalle de la composición—; se quedan la
tabla de anillos, la regla del borde y la **regla** de la composición.

**Evidencia**, sobre las 90 líneas:

| Bloque                                    | Líneas | Veredicto                                                                                                                    |
| ----------------------------------------- | -----: | ---------------------------------------------------------------------------------------------------------------------------- |
| Tabla de anillos (qué importa de qué)     |      8 | **normativa**: es la regla que `arch` verifica. Se queda                                                                     |
| Dónde va lo que comparten los controllers |      4 | **normativa**. Se queda                                                                                                      |
| Fuera de `src/`: generados y cliente      |      7 | **descriptiva**: lo gobierna ADR-013 y el README de cada directorio                                                          |
| **Módulos** que existen hoy               |    ~12 | **descriptiva**: la lista cambia con cada feature, y `CONTEXT_MAP` es su fuente verificada                                   |
| **Composición**: el detalle               |    ~45 | **mixta**: la regla son cuatro líneas —un módulo declara tres cosas, no hay resolución por texto—; el resto describe ADR-033 |

La lista de módulos es el caso más claro: **crece con cada feature**, y ya tiene una fuente que un
gate verifica. Tenerla en una instrucción garantiza que quede vieja.

**Efecto**: de 90 a ~35 líneas.

---

## R-05 — D-10: es un procedimiento, y el destino es una skill

**Decisión**: las dieciséis líneas pasan a una skill; en la regla queda que existe y cómo se la
invoca.

**Evidencia**. La pregunta que la spec fijó es «¿alguien lo **ejecuta** paso a paso o lo
**consulta**?». El texto dice, literalmente, «ante un superviviente, **en este orden**», y enumera
cuatro pasos: describir el daño observable del mutante, clasificarlo antes de tocar nada, escribir
la prueba o reestructurar según la clase, y confirmar con una corrida acotada. Eso se ejecuta.

Concuerda con la documentación oficial de la herramienta, que dice que un procedimiento de varios
pasos es material de skill y no de instrucción, y con el repositorio, que ya tiene dos skills
versionadas con el mismo criterio.

**Lo que hay que respetar al moverlo**: la skill **no puede importar nada del repositorio por ruta**
—es lo que `tests/audit/skills-isolation.test.ts` ya exige de las dos que hay—, así que lo que sea
propio de este repo (los nombres de los comandos, el archivo incremental) va como dato de la skill o
queda en la regla.

---

## R-06 — Qué no se toca, y por qué conviene decirlo

- **El mapa del contrato.** El hito mal escrito que reporté **no existe**; el recuento leyó la
  palabra dentro de un comentario. Verificado: los cinco hitos están bien formados y su verificación
  pasa.
- **`src/`, el contrato y las pruebas del producto.** Las cuatro deudas son de documentación. Si al
  terminar se movió una prueba del producto, hay algo mal entendido.

---

## R-07 — Dónde se registra la decisión

**Decisión**: **sin ADR nuevo y sin enmienda**. Esta feature **aplica** el criterio que ADR-032 ya
fijó en su enmienda de la feature 025; no lo cambia.

Lo único que cambia de forma es dónde vive el registro de deudas, y eso no es una decisión de
arquitectura: es dónde se guarda una lista. Queda escrito en el registro mismo y en el inventario de
`docs/`.

**Descartado: enmendar ADR-032 igual.** Un ADR que registra «esta vez aplicamos el criterio» diluye
los que registran decisiones. Si al separar apareciera que el criterio no alcanza, ahí sí habría
enmienda — y sería el hallazgo, no el trámite.

---

## Lo que no se investigó y por qué

- **Si las otras secciones esconden procedimientos.** La spec lo dejó fuera de alcance: si aparece
  uno, se registra como deuda nueva en vez de arrastrarlo.
- **El scaffold del registro anterior** (la única fila que quedaba abierta). Trabajo de otro tamaño,
  fuera de alcance por la spec.
