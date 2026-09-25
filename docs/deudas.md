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

| Id   | Título                                                                          | Origen                              | Estado         | Fecha      | Cierre    |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------- | -------------- | ---------- | --------- |
| D-01 | La skill de auditoría de arquitectura está acoplada a este repo                 | Revisión del dueño tras la 018      | `implementada` | 2026-09-21 | `5571829` |
| D-02 | No hay skill de acondicionamiento: un proyecto no puede volverse auditable      | Evaluación con el dueño (D-01)      | `implementada` | 2026-09-21 | `eec62b3` |
| D-03 | `engineering-baseline`: scaffold opinado con la cadena de calidad de este repo  | Evaluación con el dueño (D-02)      | `evaluada`     | 2026-09-21 | —         |
| D-04 | `config/` sin documentación ni esquema propio                                   | Revisión del dueño, 2026-09-21      | `implementada` | 2026-09-21 | `d37093b` |
| D-05 | `contracts/` sin README ni tabla de extensiones `x-*`                           | Revisión del dueño, 2026-09-21      | `implementada` | 2026-09-21 | `8ffe84e` |
| D-06 | Los directorios de primer nivel no se explican solos                            | Revisión del dueño, 2026-09-21      | `implementada` | 2026-09-21 | `cd292e0` |
| D-07 | `Convenciones` mezcla reglas que se obedecen con descripciones del sistema      | Feature 025                         | `implementada` | 2026-09-24 | `27bb238` |
| D-08 | `Gates de calidad` mezcla la regla de mutación con los umbrales del linter      | Feature 025                         | `implementada` | 2026-09-24 | `05959f8` |
| D-09 | `Anillos y módulos` mezcla la tabla de anillos con la lista de módulos          | Feature 025                         | `implementada` | 2026-09-24 | `34c4299` |
| D-10 | El procedimiento del gate de mutación está escrito como una instrucción         | Feature 025                         | `implementada` | 2026-09-24 | `f4d6a8d` |
| D-11 | Un fixture con el nombre viejo mantenía verde una regla que ya no vigilaba nada | Feature 026                         | `implementada` | 2026-09-24 | `ea3d111` |
| D-12 | Los mutantes estáticos no se activan de forma fiable con el runner de Vitest    | ADR-016 (2026-09-21)                | `abierta`      | 2026-09-24 | —         |
| D-13 | Ningún gate verifica que un fixture siga apuntando a algo que existe            | Feature 027 (al cerrar D-11)        | `abierta`      | 2026-09-25 | —         |
| D-14 | El núcleo conoce la vertical: el vocabulario de OPE nombra conceptos de ropa    | Evaluación con el dueño, 2026-09-25 | `abierta`      | 2026-09-25 | —         |
| D-15 | Ningún gate verifica que un componente del contrato lo use alguna operación     | Feature 027 (US3)                   | `descartada`   | 2026-09-25 | —         |
| D-16 | El catálogo exige dos atributos de indumentaria en cada variante                | Feature 028 (al enmendar la fuente) | `abierta`      | 2026-09-25 | —         |
| D-17 | La fuente de verdad del MVP no está bajo control de versiones                   | Feature 028 (al enmendar la fuente) | `abierta`      | 2026-09-25 | —         |

Las filas D-01 a D-06 vienen de la feature 019, que creó este registro dentro de su propia
especificación; ahí queda su historia.

D-12 estaba anotada en la decisión de ADR-016 del 2026-09-21 —«deuda anotada para la feature de
calidad»— y nunca llegó al registro: exactamente el efecto que esta feature vino a corregir. Se
registra tal como estaba escrita, sin decidir nada sobre ella.

D-11 apareció **al separar**, no antes: ADR-033 reemplazó los perfiles por despliegues y la regla
de dependency-cruiser se quedó apuntando a `src/composition/profiles/`, que ya no existe.

**Su diagnóstico estaba incompleto, y al cerrarla resultó peor de lo que la fila decía.** No era una
regla muerta: su fixture había conservado el nombre viejo, así que la regla **sí disparaba —sobre el
fixture— y su prueba seguía en verde** mientras el despliegue real quedaba sin vigilancia. Un
fixture que sobrevive a su sujeto no prueba una regla: esconde que dejó de aplicarse, y con más
convicción que si no existiera.

Cerrada en la feature 027 (pasando por ahí): la regla es `deployments-compose-modules` y nombra
`composition/deployments/`, con su fixture renombrado, y el renombre queda registrado en la
enmienda del 2026-09-24 de ADR-013.

D-13 sale de ahí, y es la lección y no el caso: **nada verifica que un fixture siga apuntando a algo
que existe.** El repositorio tiene fixtures para casi todo —reglas de arquitectura
(`tests/architecture/fixtures/`), reglas de lint (`tests/lint/fixtures/`), reglas del contrato
(`tests/contract-rules/fixtures/`), evaluaciones de la auditoría— y son su mejor idea: una regla sin
fixture no se sabe si dispara. Pero un fixture **construye su propio sujeto**, así que sobrevive a
que el sujeto real cambie de nombre o desaparezca, y entonces la prueba mide el fixture en vez de la
regla. El síntoma es el peor posible: verde.

No está claro qué lo verificaría, y por eso es una deuda y no un arreglo. Lo que D-11 sugiere es que
hay algo comparable a lo que ya hacen `check:identifiers` (toda cita resuelve) y
`check:behaviour-constants` (los archivos retirados no existen): **cada fixture nombra la ruta real
que imita, y un gate comprueba que esa ruta exista**. Medir primero cuántos fixtures podrían
declararla es parte del trabajo.

D-14 sale de una evaluación con el dueño sobre usar OPE en otro rubro. Lo medido, para no
re-deducirlo:

| Capa                                                            | Veredicto                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Escalones, las cinco autoridades, clases de claim               | **universales**: hablan de persuasión y evidencia, no de productos                 |
| Barreras (`fit`, `price`, `returns`)                            | **universales en concepto**: «¿me va a servir?» le pasa a una heladera igual       |
| `size_selector` (anclaje) y `size_selector_interacted` (evento) | **mal nombrados**: el control genérico elige variante, no talle                    |
| `block` (`size_guide` entre siete)                              | **vocabulario de OPE que debería ser del merchant**: nombra lugares de _su_ página |
| `AttributeValue` (telas) y el corpus                            | **de OPE y por diseño**: la prosa la escribe OPE, así que el vocabulario es suyo   |

**El límite del principio**, que conviene tener escrito: lo que OPE tiene que **escribir** sigue
siendo de OPE; lo que sólo **identifica un lugar o un comportamiento** puede ser del merchant.

Tres cosas que la evaluación descartó, con su motivo:

- **Un nivel de configuración «industria»** contradice la constitución XI, que fija **tres** niveles
  de resolución. Si alguna vez existe, es una **plantilla del onboarding** que se expande en la
  versión del merchant y después deja de existir, no un nivel que se resuelva en runtime.
- **«La industria del merchant»** se rompe con una tienda por departamentos, que vende dos rubros.
- **Parametrizar los vocabularios por industria** no abarata nada: todos crecen **por suma** y eso es
  a propósito. Lo único estructuralmente caro es una **barrera nueva**, y el tipo lo hace visible
  —`Record<Barrier, readonly Candidate[]>` no compila sin su escalera— pero no se puede diseñar sin
  observar un merchant del rubro.

`03 §9` dice que el piloto **no va a poder decir «qué pasa en otros rubros»**, así que esto no es una
promesa incumplida: es acople que se decide cargar, con el mapa de dónde está.

**Esa tabla se escribió sin abrir `01`, y dos de sus filas estaban mal.** Al arrancar la feature 028
se fue a verificarla contra la fuente y apareció lo contrario de lo que decía: el anclaje no estaba
«mal nombrado» —`01 §3` listaba «dónde están el selector de talle, el de color…»— y la variante no era
una omisión nuestra, porque `01 §0.1` la definía como «la combinación exacta de talle y color». El
núcleo no se había acoplado a la vertical: **estaba implementando la fuente con fidelidad.** Renombrar
sin más habría separado el código de la fuente de verdad #2, que es exactamente el error que la 027
enseñó a no cometer.

Lo que la verificación sí encontró, y la tabla no tenía:

- **`01` argumentaba a favor del renombre en la misma tabla**: dos filas arriba de «selector de talle»
  dice que la normalización mínima produce «un vocabulario de eventos **estable, independiente de la
  plataforma**».
- **El contrato le debía un anclaje a la fuente**: `01 §3` listaba **cinco** puntos de anclaje y el
  contrato publica **cuatro** —faltaba el del selector de color—. Generalizar los dos selectores en uno
  cierra esa deuda sin agregar nada.

Así que el orden correcto era al revés, y se hizo así: **la fuente se evaluó con el dueño y se enmendó
el 2026-09-25** (catorce líneas en `01`, `02` y `03`; en cada caso lo que el documento decidía era
genérico y lo que ejemplificaba era ropa, y la enmienda bajó la ropa a ejemplo). Recién con la fuente
enmendada el renombre alinea en vez de divergir, y eso es la feature 028. La lección, que vale más que
la fila: **antes de llamar deuda a un acople, hay que verificar si la fuente lo pide.**

D-16 sale de ahí. La enmienda **permitió** que una variante deje de exigir talle y color, pero eso no
es un renombre: cambia la forma de lo que un merchant envía. La pregunta que hay que contestar antes de
tocarlo, y que es el trabajo de verdad, es **cómo el claim de calce sabe cuál de los atributos de una
variante es el que se recomienda** — hoy lo sabe porque el atributo se llama `size`. Se queda afuera de
la 028 a propósito, que hace sólo los renombres.

D-17 sale del mismo momento, y es incómoda: los documentos del MVP **no están bajo control de
versiones** —no hay `.git` en su directorio—. La regla que la 027 dejó escrita, «cuando el diseño y la
fuente no coinciden, se corrige el diseño», se apoya en documentos que pueden cambiar sin que quede
registro de qué cambió, cuándo ni por qué. La enmienda del 2026-09-25 quedó respaldada con una copia
fechada a mano (`../*.bak-2026-09-25`), que es mejor que nada y bastante peor que una historia.

D-15 se registró y se descartó el mismo día, y queda acá porque **descartar con el motivo vale más
que borrar**: un commit de la 027 la nombra y alguien va a venir a buscarla.

Apareció al escribir la operación del reporte: la tarea pedía los parámetros `from`/`to`, y al
buscarlos resultó que `contracts/components/parameters/from.yaml` y `to.yaml` existen, están bien
escritos y ninguna operación los referencia. La conclusión que escribí —que ningún gate mira si un
componente tiene consumidor, y que por eso el síntoma vuelve a ser verde— **estaba mal**, y lo dice
el propio repositorio: `contracts/README.md` tiene la fila «Componentes sin referencia hasta su
primera operación», que explica que un parámetro de paginación o un `Page` que ninguna operación
construida usa **existe como archivo y no se referencia desde la raíz**, y entra con la primera
operación que lo use (ADR-020). No es un huérfano: es algo que espera, decidido y escrito.

La diferencia con D-13 es justo la que importa: allá el fixture **afirmaba** algo falso (una regla
vigilada) y acá el archivo no afirma nada. Lo que quedó de esto no es una deuda, es una lección sobre
este registro: antes de escribir una fila hay que buscar si la práctica ya está documentada, porque
una deuda inventada le cuesta credibilidad a las que sí existen.

## Lo que **no** es deuda, y por eso no está acá

| Qué                                                                         | Dónde vive                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Las decisiones del MVP todavía sin cerrar (hosting, piloto, datos, muestra) | ADR-010: son decisiones pendientes, no algo mal hecho |
| Los hitos con operaciones planeadas                                         | el roadmap de `contracts/api-map.yaml`                |
| Un esquema de seguridad que espera su primera operación                     | ADR-020, marcado como propuesto                       |

La diferencia importa: una decisión pendiente no se «cierra» arreglando algo, y un hito planeado ya
tiene su lugar. Mezclarlos acá haría que el registro dejara de decir qué falta **arreglar**.
