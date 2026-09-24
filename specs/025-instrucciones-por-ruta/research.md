# Research — El núcleo se lee siempre; el resto carga cuando hace falta (025)

Todo lo de acá se midió en la rama `025-instrucciones-por-ruta`, que sale de
`024-instrucciones-verificadas` (`2d41fd7`). Cada decisión cita su evidencia y qué se descartó.

---

## R-00 — La cuenta de la spec no cerraba

**Hallazgo**: el reparto de la spec da **211 líneas de núcleo**, no 190. Rompe el umbral por once.

**Evidencia**. La spec sumó las siete secciones que se quedan (190) pero **no contó los punteros**:
cada sección que se va deja en el núcleo su invariante de una línea más de qué se trata, y eso son
unas tres líneas por sección. 190 + 7 × 3 = **211**.

Es el número que obliga a decidir algo más, y todo R-01 y R-02 sale de ahí. Una spec que no cierra
por once líneas no es un detalle: si el plan lo hubiera dado por bueno, la feature habría terminado
con un núcleo de 211 líneas declarando que cumple un umbral de 200.

---

## R-01 — La tabla de comandos se consolida en un inventario que ya existe

**Decisión**: la tabla de comandos **no** se queda en el núcleo tal como está. Sus treinta filas se
consolidan en `scripts/README.md`, y el núcleo conserva los **siete** comandos del lazo normal.

**Evidencia, medida**: de los **30 comandos** que la tabla del núcleo describe, **26 ya están
descritos en `scripts/README.md`**, que es un inventario que ADR-032 gobierna y que
`tests/docs/readmes.test.ts` ya verifica fila por fila. La tabla del núcleo es, en su mayor parte,
una segunda copia de ese inventario — el mismo acople que la feature 024 sacó de las notas del
contrato, sin que nadie lo hubiera visto porque la tabla no cita un ADR.

Los **cuatro** que no están —`build`, `arch`, `format`, `check:mutation-report`— no son scripts de
`scripts/`: son envoltorios de `tsc`, de dependency-cruiser y de Prettier. Van con los del lazo
normal en el núcleo, o al inventario con su fila, lo que el plan resuelva sin perderlos.

El núcleo conserva lo que un agente corre en su lazo, que el propio flujo de trabajo ya enumera:
`format:check`, `quality`, `typecheck`, `test`, `test:mutation`, `test:contract` y `contract:check`.
Para el resto, el puntero al inventario.

**Esto contradice a la spec**, que tenía «Comandos» entre lo que se queda. Se contradice con
evidencia y entra en el alcance que la propia spec declaró: «se mueven tal cual; **lo que se
consolide se enumera**».

---

## R-02 — El tipado **no** se mueve

**Decisión**: la sección de tipado se queda en el núcleo. La spec la tenía entre las que se van.

**Evidencia**, dos motivos que apuntan igual:

1. **Es casi toda invariante ya.** Diecisiete líneas que dicen qué está prohibido escribir —sin
   `any`, sin `!`, promesas manejadas, imports de tipo con `type`, una excepción en línea con su
   motivo—. Reducirla a «su invariante de una línea» daría unas cuatro líneas: se ahorran trece a
   cambio de partir en dos algo que ya es corto.
2. **Su alcance sería casi universal.** Acotada a todo archivo de código, entraría en casi toda
   sesión que toque código: el mecanismo cobra su precio —llegar tarde cuando se escribe el primer
   archivo— y no paga casi nada a cambio.

Es el peor negocio de las siete, y la cuenta lo confirma: con la consolidación de R-01, el núcleo
cierra **sin** moverla.

---

## R-03 — La cuenta que sí cierra

Con R-01 y R-02, el núcleo queda:

| Se queda                            | líneas |
| ----------------------------------- | -----: |
| Flujo de trabajo                    |     52 |
| Convenciones                        |     44 |
| Documentación viva                  |     31 |
| Tipado (R-02)                       |     17 |
| Reglas que fallan el build          |     12 |
| Comandos del lazo (R-01)            |    ~10 |
| Fuentes de verdad                   |      8 |
| Si existe `HANDOFF.md`              |      3 |
| Punteros de las **seis** que se van |    ~18 |
| **≈ 195**                           |        |

Bajo el umbral, con margen chico y honesto. **El plan no persigue un número menor**: la spec lo dejó
fuera de alcance porque premiaría borrar cosas útiles.

Las seis que se van, con la parte del código a la que se acotan:

| Sección                        | líneas | Se acota a                     |
| ------------------------------ | -----: | ------------------------------ |
| Notas operativas del contrato  |     92 | el contrato                    |
| Anillos y módulos              |     85 | el código fuente               |
| Cómo se escribe un caso de uso |     59 | la capa de aplicación          |
| Gates de calidad               |     51 | el código fuente y las pruebas |
| Cómo se escribe una entidad    |     48 | el dominio                     |
| Auditoría de arquitectura      |     12 | las evaluaciones y las skills  |

---

## R-04 — Las seis sobreviven la prueba de la invariante de una línea

**Decisión**: las seis se mueven. Ninguna cae en FR-004.

**Evidencia**: la prueba es «¿qué línea impide equivocarse antes de que la regla llegue?». Para cada
una hay una, y las seis ya están sostenidas por un gate que falla si se las viola, lo que baja el
costo de que la regla llegue tarde:

| Sección            | La línea que queda en el núcleo                                                                                          | Gate que la sostiene |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Anillos y módulos  | la dependencia va sólo hacia adentro; un módulo importa de otro sólo por su índice y sólo si el mapa lo permite          | `arch`               |
| Caso de uso        | una clase con `execute`, dependencias por constructor y sólo interfaces; un error de negocio se devuelve, nunca se lanza | `lint`               |
| Entidad            | clase si hay reglas, tipo si no; las reglas viven con su dueño                                                           | `lint`               |
| Gates de calidad   | un cambio no entra si un mutante de sus propias líneas sobrevive                                                         | `test:mutation`      |
| Notas del contrato | el contrato es la única fuente de verdad de la superficie HTTP                                                           | `contract:check`     |
| Auditoría          | el método vive en la skill; lo de este repo, en su perfil                                                                | `tests/audit/`       |

**El caso que más se acercó a no moverse** es el de escribir un caso de uso, que es el escenario
exacto de FR-004: un agente creando el primer archivo de la capa. Sobrevive porque su invariante
—una clase con `execute`, dependencias interfaces, el error se devuelve— es justamente lo que
`lint` rechaza en el acto, así que equivocarse cuesta un ciclo de gate y no una revisión.

---

## R-05 — El gate se extiende a los archivos, no cambia de diseño

**Decisión**: la política declara **archivos**, cada uno con sus secciones; el gate recorre los
siete. No hay mecanismo nuevo.

**Evidencia**. La política de la feature 024 ya declara secciones con su clase y las verifica en los
dos sentidos. Pasar de «las secciones de un archivo» a «los archivos y sus secciones» es una
envoltura más, no un diseño distinto, y conserva lo que importa: una sección sin clase falla, y una
clase sin sección también. Se agregan dos verificaciones propias de esta feature: **toda regla
declara a qué parte del código se aplica** (o declara por qué no), y **esa parte existe** — una regla
acotada a algo que no está nunca se activa, y una regla que nunca se activa es una regla muerta.

Las tres verificaciones que hoy alcanzan sólo al núcleo —citas de decisiones, marcadores e
identificadores— reciben los archivos nuevos en su lista. En las tres es una línea: las tres ya
arman su lista de documentos y las tres ya recibieron el núcleo en la feature 024.

---

## R-06 — La condición de arranque

**Verificado**: la herramienta instalada es **2.1.280**, por encima de todos los mínimos que la
documentación menciona para reglas acotadas (2.1.198, 2.1.207, 2.1.211, 2.1.217). El directorio de
configuración hoy sólo tiene las skills, así que el lugar donde viven las reglas se crea con esta
feature y no pisa nada. Ese directorio ya dispara el proyecto de herramientas en las pruebas por
alcance.

---

## R-07 — Dónde se registra la decisión

**Decisión**: **enmienda de ADR-032**, que ya gobierna el patrón de política más prueba y que la
feature 024 extendió a las instrucciones. Ésta lo extiende otra vez, al reparto entre destinos.

La enmienda **tiene que citar la documentación oficial como fuente del umbral** —lo pide la spec—
para que las doscientas líneas se lean como lo que son: el número que la herramienta publica, con su
motivo (un archivo más largo se obedece peor), y no una preferencia de quien escribió el ADR.

---

## Lo que no se investigó y por qué

- **Convertir la forma de trabajar el gate de mutación en una skill.** Es un procedimiento de varios
  pasos y la documentación oficial dice que eso es material de skill, pero la spec lo dejó fuera de
  alcance para no mezclar dos mudanzas en una feature. Queda anotado como el candidato más claro
  cuando se decida.
- **El orden de carga entre el núcleo y las reglas.** La documentación lo fija y no hay nada que
  decidir; el plan sólo tiene que no contradecirlo.
- **Bajar de las doscientas líneas.** Fuera de alcance por la spec: perseguir un número menor premia
  borrar cosas útiles.
