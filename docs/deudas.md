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

| Id   | Título                                                                                               | Origen                                           | Estado         | Fecha      | Cierre                                                  |
| ---- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------- | ---------- | ------------------------------------------------------- |
| D-01 | La skill de auditoría de arquitectura está acoplada a este repo                                      | Revisión del dueño tras la 018                   | `implementada` | 2026-09-21 | `5571829`                                               |
| D-02 | No hay skill de acondicionamiento: un proyecto no puede volverse auditable                           | Evaluación con el dueño (D-01)                   | `implementada` | 2026-09-21 | `eec62b3`                                               |
| D-03 | `engineering-baseline`: scaffold opinado con la cadena de calidad de este repo                       | Evaluación con el dueño (D-02)                   | `descartada`   | 2026-09-21 | —                                                       |
| D-04 | `config/` sin documentación ni esquema propio                                                        | Revisión del dueño, 2026-09-21                   | `implementada` | 2026-09-21 | `d37093b`                                               |
| D-05 | `contracts/` sin README ni tabla de extensiones `x-*`                                                | Revisión del dueño, 2026-09-21                   | `implementada` | 2026-09-21 | `8ffe84e`                                               |
| D-06 | Los directorios de primer nivel no se explican solos                                                 | Revisión del dueño, 2026-09-21                   | `implementada` | 2026-09-21 | `cd292e0`                                               |
| D-07 | `Convenciones` mezcla reglas que se obedecen con descripciones del sistema                           | Feature 025                                      | `implementada` | 2026-09-24 | `27bb238`                                               |
| D-08 | `Gates de calidad` mezcla la regla de mutación con los umbrales del linter                           | Feature 025                                      | `implementada` | 2026-09-24 | `05959f8`                                               |
| D-09 | `Anillos y módulos` mezcla la tabla de anillos con la lista de módulos                               | Feature 025                                      | `implementada` | 2026-09-24 | `34c4299`                                               |
| D-10 | El procedimiento del gate de mutación está escrito como una instrucción                              | Feature 025                                      | `implementada` | 2026-09-24 | `f4d6a8d`                                               |
| D-11 | Un fixture con el nombre viejo mantenía verde una regla que ya no vigilaba nada                      | Feature 026                                      | `implementada` | 2026-09-24 | `ea3d111`                                               |
| D-12 | Quince mutantes de arranque, semilla y lectores que ningún gate juzga                                | ADR-016 (2026-09-21)                             | `evaluada`     | 2026-09-24 | —                                                       |
| D-13 | Ninguna regla verifica que las rutas que ella misma nombra existan                                   | Feature 027 (al cerrar D-11)                     | `evaluada`     | 2026-09-25 | —                                                       |
| D-14 | El núcleo conoce la vertical: el vocabulario de OPE nombra conceptos de ropa                         | Evaluación con el dueño, 2026-09-25              | `implementada` | 2026-09-25 | `b238fdb`                                               |
| D-15 | Ningún gate verifica que un componente del contrato lo use alguna operación                          | Feature 027 (US3)                                | `descartada`   | 2026-09-25 | —                                                       |
| D-16 | El catálogo exige dos atributos de indumentaria en cada variante                                     | Feature 028 (al enmendar la fuente)              | `implementada` | 2026-09-25 | `2837b69`                                               |
| D-17 | La fuente de verdad del MVP no está bajo control de versiones                                        | Feature 028 (al enmendar la fuente)              | `implementada` | 2026-09-25 | `ef2c854`                                               |
| D-18 | La constitución no es verificable: sus afirmaciones no dicen de dónde salen                          | Feature 028 (auditoría de cierre)                | `abierta`      | 2026-09-25 | —                                                       |
| D-19 | Una omisión se leía como lista vacía: 500 al publicar, y un default borrado en silencio              | Feature 029 (Schemathesis)                       | `implementada` | 2026-09-26 | —                                                       |
| D-20 | Publicar configuración no es idempotente, y el 500 del borde llega después de escribir               | Revisión de deudas, 2026-09-26                   | `abierta`      | 2026-09-26 | —                                                       |
| D-21 | La durabilidad se implementa sobre SQLite: PostgreSQL y sus pruebas de concurrencia, después         | Decisión del dueño, 2026-09-26                   | `abierta`      | 2026-09-26 | feature 030 (lo que quedó apoyado en «un solo proceso») |
| D-22 | El contrato describe el holdout como tráfico fuera del experimento, y es el control mínimo           | Revisión del esquema con el dueño, 2026-09-27    | `abierta`      | 2026-09-27 | —                                                       |
| D-23 | La exposición no registra cuándo OPE la recibió, sólo cuándo el SDK dice que ocurrió                 | Revisión del esquema con el dueño, 2026-09-27    | `abierta`      | 2026-09-27 | —                                                       |
| D-24 | El tope diario por visitante es un default sin medición, y con 1 por sesión casi nunca muerde        | Revisión de la 032 con el dueño, 2026-09-27      | `abierta`      | 2026-09-27 | —                                                       |
| D-25 | CI corre sobre cosas con fecha de vencimiento: Node 20 en cinco actions y `ubuntu-latest` migrando   | Anotaciones del CI de la feature 031, 2026-09-28 | `abierta`      | 2026-09-28 | —                                                       |
| D-26 | Lo que la decisión paga por reconstruir está medido en la máquina que no importa                     | Feature 032 (SC-005, ADR-040)                    | `abierta`      | 2026-09-28 | —                                                       |
| D-27 | Nadie sabe qué cuesta un arranque en frío con tráfico: todas las sesiones reconstruyen a la vez      | Feature 032 (borde de la spec)                   | `abierta`      | 2026-09-28 | —                                                       |
| D-28 | Una transacción no se puede componer sobre puertos asincrónicos, y dos garantías del hito la esperan | Feature 033 (research R-05 y su enmienda)        | `abierta`      | 2026-09-29 | ADR-034 (la ventana que deja abierta)                   |

Las filas D-01 a D-06 vienen de la feature 019, que creó este registro dentro de su propia
especificación; ahí queda su historia.

D-03 se **descartó el 2026-09-25**, en la evaluación de las deudas abiertas, y el motivo es de la
constitución y no de conveniencia: Governance pide que toda complejidad añadida se justifique frente a
la tesis del MVP —«¿contribuye a producir un número confiable de contribución incremental?»— y un
scaffold para **otros** backends no contribuye. No es que esté mal hecho ni que falte: no es deuda de
este producto. La idea sigue viva fuera de este registro; lo que deja de ser cierto es que OPE tenga
algo pendiente por ella.

Que haya estado cuatro días en `evaluada` sin que nadie la mirara es la señal: una fila que nadie
puede cerrar porque no depende de este producto ensucia el registro cada vez que se lo revisa.

D-12 estaba anotada en la decisión de ADR-016 del 2026-09-21 —«deuda anotada para la feature de
calidad»— y nunca llegó al registro: exactamente el efecto que la feature 026 vino a corregir.

**Replanteada el 2026-09-25, después de medirla.** Decía «los mutantes estáticos no se activan de
forma fiable con el runner de Vitest», que suena a bug ajeno esperando un arreglo río arriba. No lo
es: Stryker está en su última versión y el parche que el repositorio lleva es por otra cosa.
`ignoreStatic` es una **decisión de ADR-016 con su motivo** —cada mutante estático corre la suite
entera y el runner los reporta como falsos supervivientes—, y lo que queda es su costo, que ahora está
contado: **quince mutantes** en la última corrida acotada al diff, en código que corre fuera de toda
prueba (el arranque, la semilla, los lectores de la configuración).

Se revisa cuando ese código empiece a importar de verdad, que es el hito `persistence-and-resilience`:
hoy el arranque es en memoria y lo que no juzga son quince mutantes de código que se reescribe en esa
feature.

**Y midiéndola apareció otra cosa**, que sí se arregló en el momento. Una excepción de
`decision.service.ts` decía «unreachable end to end **until the message catalogue**», y el catálogo de
mensajes llegó en la feature 027: la excepción nombraba un futuro que ya había ocurrido. Al quitarla,
el mutante no murió —seguía sin cobertura—, así que el motivo no sólo estaba vencido: **escondía una
prueba que faltaba**. La rama es alcanzable justamente desde la 027, porque una familia sin texto deja
de ser candidata y la escalera puede quedarse con el incentivo y sin escalón al que caer. Con esa
prueba escrita, el mutante muere.

Es la misma familia que D-13: algo que dejó de ser cierto y ningún gate lo nota. Una excepción que
nombra un evento futuro debería re-leerse el día que ese evento ocurre, y hoy no hay nada que lo
recuerde.

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

D-13 sale de ahí, y **se replanteó el 2026-09-25 después de medirla**, porque como estaba escrita no
se podía construir.

Decía «nada verifica que un fixture siga apuntando a algo que existe». Al contar, de los directorios
de `tests/architecture/fixtures/src/` y `tests/lint/fixtures/as-src/` que no tienen contraparte en
`src/`, **casi todos son deliberados**: `interface-adapters/a`, `b`, `c` y `x` son nombres de módulo
inventados para probar reglas _entre_ módulos, y `demo` y `some` lo mismo. Un fixture **tiene que**
poder modelar algo que no existe: para eso existe. Ese gate habría sido casi todo excepciones, que es
la forma más rápida de que un gate deje de significar algo.

**Lo que sí se rompió en D-11 fue otro vínculo**: no fixture → ruta real, sino **regla → ruta real**.
La regla de dependency-cruiser nombraba `src/composition/profiles/`, que ADR-033 había hecho
desaparecer; el fixture sólo la mantuvo verde después. La regla es el que afirma algo sobre el
repositorio, y es el que puede quedar afirmando sobre algo que ya no está.

Así que la deuda es: **un gate que extraiga las rutas que nombran las reglas** —las de
`.dependency-cruiser.cjs` y las de `ope/*`— y compruebe que resuelvan contra el disco, igual que
`check:identifiers` hace con lo que cita la documentación. Sin excepciones esperadas, y habría
atrapado D-11 el día del renombre en vez de dos features después.

**Y un caso concreto que la medición dejó servido**, para mirar al construirlo:
`tests/architecture/fixtures/src/composition/adapters/ok-adapter.ts` afirma que un adaptador entre dos
módulos «vive en la composición (feature 018): no dispara ninguna regla», y `src/composition/` hoy no
tiene `adapters/`. Puede ser legítimo —afirma que ese lugar sería válido— o puede ser el segundo caso
de D-11.

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

**Cerrada en la feature 028**, y conviene decir hasta dónde: de las cinco filas de la tabla de
arriba, dos estaban mal medidas (las corrige el párrafo anterior y ADR-037), una era «de OPE y por
diseño» y no había nada que hacer, y las dos que sí eran deuda —el anclaje con su evento y el
vocabulario de bloques— quedan cerradas. Lo que la tabla llamaba la variante **no se cierra acá**: se
separó como D-16, porque no es un renombre. Una deuda que se cierra parcialmente se dice así, no se
marca entera.

D-16 sale de ahí. La enmienda **permitió** que una variante deje de exigir talle y color, y la 028 la
dejó afuera a propósito porque parecía necesitar una decisión de diseño antes: cómo sabría el claim de
calce cuál de los atributos de una variante es el que se recomienda.

**Al medirla, esa pregunta no existía.** Nada del camino de decisión leía `variant.size` ni
`variant.color`: los únicos dos lugares que los tocaban eran la huella de contenido de la instantánea
y el controller que los copiaba del DTO. El claim de calce no los miraba —la variante se identifica
por su id, y el quality gate sólo exige que **haya** una variante en foco—, así que eran dos campos
obligatorios que viajaban, se validaban, se guardaban y no los leía ninguna autoridad: el mismo caso
que el campo del evento que la 028 borró.

**Cerrada en la feature 029.** La variante declara `attributes`, con la misma forma que el producto, y
esa forma se extrajo a un componente que los dos referencian —hasta entonces el producto la definía en
línea y la variante la habría duplicado—. Se generalizó en vez de borrarse porque `01 §0.1`, enmendado
el 2026-09-25, define la variante como «la combinación exacta de **atributos** que define un artículo
vendible»: borrarlos la habría dejado como un id opaco mientras la fuente dice otra cosa.

**Y apareció algo que la deuda no decía.** La huella de contenido de una instantánea **no veía** ningún
eje que no fuera talle o color, así que dos catálogos del mismo instante que diferían en cualquier otro
atributo se tomaban por el mismo. Ahora se distinguen. Es la única parte de la 029 que cambió
comportamiento, y nadie la había nombrado.

D-17 sale del mismo momento, y era incómoda: los documentos del MVP **no estaban bajo control de
versiones** —no había `.git` en su directorio—. La regla que la 027 dejó escrita, «cuando el diseño y
la fuente no coinciden, se corrige el diseño», se apoyaba en documentos que podían cambiar sin que
quedara registro de qué cambió, cuándo ni por qué.

**Cerrada el mismo día, en la evaluación de deudas abiertas.** `ope/mvp/` es ahora un repositorio, con
`backend/` ignorado porque ya tiene el suyo. Los respaldos con fecha que la enmienda había dejado
permitieron algo mejor que empezar la historia hoy: el **primer** commit es el estado previo a la
enmienda y el segundo es la enmienda, así que el cambio del 2026-09-25 quedó como un diff recuperable
(`ef2c854`) y las copias `.bak` se borraron porque la historia las reemplaza. Las citas
`mvp:01-...` siguen resolviendo y ningún gate de este repositorio cambió.

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

D-18 sale de la auditoría de cierre de la 028, y es incómoda por dónde está: **la constitución es el
documento que prevalece sobre todo y el que menos verificación tiene.**

- `check:adrs` le lee las citas `ADR-NNN` y comprueba que **el número exista**, no que lo que ella
  afirma coincida con lo que ese ADR decidió.
- `check:instructions` **no la cubre**: su política alcanza a `CLAUDE.md` y a las reglas acotadas, y la
  constitución no está en la lista.

La superficie sin vigilar son **56 afirmaciones normativas** y **10 ADR citados**.

Su primera instancia se corrigió el mismo día que se encontró: la viñeta `Escalas` mandaba expresar
porcentajes 0–100 en las superficies visibles y normalizar en el borde, y **ADR-035 abolió eso en la
feature 022**. Sobrevivió seis features y pasó `check:adrs` sin despeinarse, porque ADR-035 existe —
que es lo único que ese gate mira. Quien hubiera leído la constitución habría implementado una
conversión que el código no hace, y habría tenido razón según el documento que manda.

**Medida el 2026-09-26, y la medición invirtió la solución propuesta.** Contadas por viñeta completa
—no por línea, que es donde mi primer conteo se equivocó porque el documento envuelve a noventa y pico
de caracteres— son **67 afirmaciones normativas**: **7** citan un ADR, **3** citan la fuente del MVP y
**57 no citan nada**.

Y el detalle que decide el diseño: **el gate que esta deuda imaginaba no habría atrapado el caso que la
motivó.** La viñeta `Escalas`, antes de corregirse, **no citaba ADR-035** — decía lo suyo sin nombrar
la decisión que la había reemplazado. Verificar «que cada ADR citado siga estando de acuerdo» la habría
dejado pasar, porque no había cita. Hoy cita ADR-035 sólo porque la enmienda de la 028 se la puso.

Así que el trabajo no es el script: es **hacer el documento citable**. Es la forma que ADR-008 le impuso
al glosario —ningún sustantivo entra sin su nota con fuente— aplicada acá: ninguna afirmación normativa
sin su fuente. Con eso el gate es fácil y además puede verificar que el ADR citado no esté
`reemplazada`. Sin eso no hay nada que verificar.

**Y hay un riesgo que la feature tiene que decidir antes de empezar**: puede haber afirmaciones que no
se puedan rastrear a ninguna fuente. Inventarles una cita sería peor que no tenerla — sería darle
autoridad falsa al documento que prevalece sobre todo. Qué se hace con ésas es la primera pregunta de
la spec.

**Decisión del dueño (2026-09-26)**: se hace, en su propia feature.

D-19 la encontró **Schemathesis**, no una persona, y vale la pena decir cómo: el gate de contrato es
property-based, así que cada corrida genera cuerpos distintos. En la 028 pasó con 10 520 casos; en la
029, con un cuerpo que traía `decisionPolicy.evidence: {}`, tres operaciones de configuración
respondieron **500 `response-contract-violation`**. El bug estaba en `main` desde que existe el
esquema de evidencia: nadie lo había generado antes.

La causa era una línea del lector de la configuración: una clave **ausente** se convertía en `[]`. De
ahí salían dos defectos, y el segundo es peor que el que se fue a buscar:

1. **El eco violaba el contrato.** `PolicyEvidence` exige `minItems: 1`, así que el esquema obliga a
   decir «ninguna barrera necesita esto» **omitiendo** la clave, y el lector convertía esa omisión en
   lo único que el esquema rechaza. Publicar contestaba 500.
2. **Declarar una de las dos claves borraba la otra, en silencio.** `PolicyInput.merge` es superficial,
   así que el `evidence` declarado reemplazaba entero al de los defaults; con la clave ausente vuelta
   `[]`, un merchant que declaraba `freshStockAndPrice` se quedaba sin `availableVariant` en su
   política efectiva. Ninguna prueba lo cubría y nada chillaba.

El arreglo es el que el nombre del campo pedía: **lo declarado es lo que el merchant mandó**. Una clave
ausente se queda ausente, y `evidence` se mergea un nivel más profundo que el resto porque es el único
campo declarado que es un objeto propio. Las dos pruebas nuevas son una por defecto.

**Lo que esto deja como lección**: un gate property-based no es determinista, así que verde hoy no es
verde siempre. Vale más cuando falla que cuando pasa.

D-20 sale de contestar una pregunta que D-19 había dejado abierta: si el 500 ocurría **antes o
después** de escribir. Es después, y está verificado en el log de la reproducción —`use case
executed` y recién entonces `the handler response does not satisfy the contract`—, porque
`validateResult` juzga la respuesta cuando el handler ya la produjo. No hay otra forma: una respuesta
no se puede validar antes de existir.

Así que la propiedad es del borde entero y conviene tenerla escrita: **toda
`response-contract-violation` en una escritura le dice «error» a un cliente cuya acción ya ocurrió.**
Eso cambia la gravedad de cada violación —no es «devolvimos un cuerpo feo», es «le mentimos a un
cliente sobre su escritura»— y es un argumento más para tratarlas como severas, que es lo que la 029
hizo.

Lo que sí tiene arreglo es la consecuencia: **publicar una configuración no es idempotente**, así que
un cliente que reintenta ante ese 500 crea una **segunda versión**. El mecanismo ya existe en el
repositorio —`x-idempotency` con clave, primera respuesta y repetición, que `outcomes` usa desde la
feature 013— y aplicarlo a la publicación de configuración cierra el agujero en vez de documentarlo.

**Decisión del dueño (2026-09-26)**: se registra **y** se hace, en su propia feature. Qué otras
operaciones de escritura son no idempotentes hay que contarlo al escribir la spec: la publicación de
configuración es la que aparece, pero no se midió si es la única.

D-21 no es un defecto: es **alcance que se decide dejar afuera**, con su motivo y su fecha, para que
nadie lea después que el hito de persistencia está cerrado.

La constitución fija «Persistencia: PostgreSQL (durable) + Redis (sesión caliente)» como decisión D1.
Usar SQLite en desarrollo **no la contradice** —la constitución describe el stack de producción, y el
despliegue local ya corre hoy sobre algo que tampoco es PostgreSQL: memoria—, y la arquitectura de
composición lo previó: un módulo con dos tecnologías entra como `ledgerModule.with("postgres")` y **no
compila si nadie elige**.

Lo que sí queda pendiente es lo que el hito promete además de durabilidad: **atomicidad del
presupuesto por sesión** y **la entrada de administración commiteada junto con la acción que
registra** (la ventana que ADR-034 deja abierta). Eso es exactamente donde los dos motores más
difieren —aislamiento, bloqueo, concurrencia, semántica de `ON CONFLICT`—, así que implementarlo y
probarlo sobre SQLite deja sin verificar, en el motor real, justo lo que el hito existe para
garantizar.

**Motivo de la decisión (dueño, 2026-09-26)**: hoy no hay infraestructura para que CI levante un
PostgreSQL, y la etapa es de implementación. Se acepta a sabiendas.

**Lo que cierra esta deuda**: el gateway de PostgreSQL y las pruebas de atomicidad y concurrencia
corriendo contra él, antes del primer piloto con tráfico real.

### Lo que la feature 030 dejó apoyado en «un solo proceso», medido al implementarla

Tres cosas concretas, para que quien escriba el gateway de PostgreSQL no tenga que redescubrirlas.
**De las tres, la feature 031 saldó la primera**; las otras dos siguen abiertas y son las que hacen que
esta deuda no se cierre.

1. ~~**`rowid` es el orden de inserción.**~~ **Saldado por la feature 031** (migración `002`,
   2026-09-28). Las dos reglas de arquitectura del dueño dieron a **toda** tabla su propia clave
   primaria autoincremental, así que el orden de inserción es ahora una columna que el esquema declara:
   las tres consultas que nombraban `rowid` —`bySession` de las decisiones, la de las corroboraciones y
   la poda de recibos del catálogo— nombran `id`. **El gateway de PostgreSQL ya no tiene que decidir una
   columna de orden**, que era lo que esta parte de la deuda le dejaba.
2. **El primero/repetido/conflicto de la orden es un `SELECT` y un `INSERT` dentro de una
   transacción.** Con un proceso y SQLite síncrono eso es atómico de verdad. Con dos procesos no lo
   es por sí solo —hace falta `BEGIN IMMEDIATE` o el nivel de aislamiento equivalente—, y es
   exactamente lo que `01 §6` pide: ningún paso entre mirar y escribir.
3. **La idempotencia de exposiciones y corroboraciones se decide con `changes()`**, que es por
   conexión. Dentro de una transacción es correcto; el equivalente en PostgreSQL es otro
   (`RETURNING`, o `xmax`), y no es una traducción mecánica.

**Lo que sí quedó verificado**: el costo de la escritura durable en el camino crítico, medido y
fechado (ADR-038). Ese número **no** depende de PostgreSQL, pero tampoco vale para él.

## D-22 — el contrato describe mal el holdout

**Registrada primero con un diagnóstico equivocado, y corregida el mismo día.** Se escribió «el
holdout no separa tráfico: nadie lo aparta» mirando sólo el código. Al ir a los ADR apareció que el
comportamiento es el decidido, no un olvido:

> **ADR-022**: «Holdout (DECIDIDO, ADR-026): todo merchant conserva un **grupo de control mínimo**,
> `holdoutPercent` con 5 % por defecto; `treatmentPercent ≤ 100 − holdout`. El tope se aplica con la
> configuración por API.» Y **ADR-031** lo repite: «el holdout se aplica al abrir un experimento por
> API».

El holdout **es** el grupo de control mínimo. Que esos visitantes caigan en `CONTROL` no es el hueco:
es exactamente lo que garantiza que el brazo de comparación nunca sea demasiado chico, y el north
star de `01` se calcula **por intención de tratar**, TREATMENT frente a CONTROL — la fuente no nombra
un tercer grupo en ningún lado.

**Lo que sí queda, y es de otra naturaleza**: la descripción del contrato dice «Share of the traffic
kept out of every experiment», que se lee como un tercer destino que no existe ni debe existir. Lo que
el valor hace es reservar una porción que el reparto no puede tomar, y esa porción **es control**.

**Lo que la cierra**: corregir la descripción en `EffectiveConfiguration.yaml` y en
`MerchantConfigurationDeclared.yaml` para que diga lo que el valor hace. Es un cambio de prosa del
contrato, no de comportamiento.

**La lección, que es la misma de D-14**: una deuda sobre una decisión de diseño se verifica contra su
ADR antes de escribirla. El código dice qué hace; el ADR dice si eso es lo que se quiso.

## D-23 — la exposición no dice cuándo llegó

La orden y la corroboración guardan **dos** instantes: `confirmedAt`, el del hecho según el cliente,
y `receivedAt`, cuándo OPE lo recibió — y la guarda de reloj compara uno contra otro. La exposición
guarda sólo `exposedAt`, que es el que declara el SDK.

**Qué significa**: de una exposición no se puede saber cuánto tardó en llegar, ni distinguir una
confirmación de hace un segundo de una que el SDK acumuló y mandó mucho después. Para la cadena de
evidencia alcanza —la exposición existe o no existe—, pero para una discusión sobre una cifra, el
instante que hay es el que el cliente declaró y no uno que OPE haya medido.

**Lo que la cerraría**: un `receivedAt` en `Exposure`, con el mismo criterio que la orden.

## D-24 — el tope diario por visitante nunca se midió, y casi nunca es el que bloquea

`01 §4.5` pide «cooldown y fatiga: límites por sesión y por visitante», y ADR-027 los pone en la
política comercial del merchant. Los dos existen y los dos se aplican. Lo que nadie decidió con un
número es **cuánto** vale cada uno: `config/treatment-defaults.json` trae `interventionsPerSession: 1`,
`cooldownSeconds: 0` y `interventionsPerVisitorPerDay: 3`, y el 3 es un default que ninguna medición
de este piloto respalda.

**Y hay algo más, que se ve al mirar los dos juntos**: con **una** intervención por sesión y una sesión
de 30 minutos de inactividad (feature 032, FR-001), para que el tope diario dispare la misma persona
tiene que abrir **cuatro visitas separadas en un día**. El que bloquea en la práctica, en casi todo el
tráfico, es el presupuesto por sesión. El tope diario es el techo de un caso raro.

**Por qué importa y no es sólo una curiosidad**: mientras el tope diario se cuente como la protección
principal, la conversación sobre sobre-intervención apunta al parámetro que menos muerde. Pasó en la
primera redacción de la spec 032, cuya historia P1 estaba escrita alrededor del cupo diario.

**Qué la cerraría**: el registro de eventos de la feature **031** permite contar, por primera vez, a
cuántos visitantes les dispara cada tope y cuántas visitas hace un visitante en un día. Con ese número
el dueño puede fijar el 3 —o cambiarlo, o quitarlo— sobre datos. No antes: cambiar un default sin
medición por otro default sin medición no cierra nada.

**Lo que esta deuda NO dice**: que el tope sobre. El motivo económico es sólido —una intervención puede
llevar incentivo, y `01 §4.5` bloquea lo que destruye contribución aunque convierta—, y el argumento de
medición que parecía apoyarlo es el más débil de los tres: el piloto compara por intención de tratar, así
que la dosis real es parte del tratamiento y la comparación sigue siendo válida. Lo que se pierde con una
dosis inflada es más chico y más concreto: **la cifra publicada deja de describir la política configurada**.

## D-25 — CI corre sobre cosas con fecha de vencimiento

Las anotaciones del CI de la feature 031 (2026-09-28) avisan tres cosas. **Ninguna falla nada hoy**, y
dos tienen fecha, que es lo que las vuelve deuda y no ruido: cuando venzan, el workflow se rompe sin que
nadie haya tocado el repositorio.

| Qué                                                                                                                                                                       | Dónde                                                         | Qué pasa cuando venza                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node 20 deprecado** en cinco actions: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/cache/restore@v4`, `actions/cache/save@v4` | `.github/workflows/ci.yml`                                    | hoy el runner las fuerza a Node 24 y avisa; cuando deje de forzarlas, fallan. La salida es subir a `@v5` cuando esté disponible para cada una                                                                 |
| **`ubuntu-latest` migra a Ubuntu 26** el 19 de octubre de 2026                                                                                                            | los **tres** jobs de `ci.yml`                                 | el cambio de imagen llega solo. Lo que puede moverse con ella es el compilador nativo de TypeScript, el runner de Vitest con su parche y Stryker — los tres que la 030 miró al subir a Node 24                |
| El caché de `astral-sh/setup-uv@v5` **nunca se invalida**                                                                                                                 | `ci.yml:44`, `enable-cache: true` sin `cache-dependency-glob` | no vence: es un caché que no sirve. El proyecto no tiene `uv.lock` ni `requirements*.txt` —Schemathesis se instala por `uv` sin archivo de dependencias—, así que la opción es fijar el glob o sacar el caché |

**Por qué se anota y no se arregla acá**: la feature 031 no toca CI, y cambiar cinco versiones de action
en la misma PR que una feature mezcla dos revisiones que no tienen nada que ver. Es una rama corta y
propia, y conviene hacerla **antes del 19 de octubre**, corriendo la cadena entera sobre la imagen nueva
— que es el procedimiento que la 030 ya usó para el salto de Node: primero y solo, con el diff más chico
posible, porque si algo del stack se queja no tiene nada que ver con la feature en curso.

## D-26 — Lo que la decisión paga por reconstruir está medido en la máquina que no importa

La feature 032 puso una lectura durable en el camino de decisión (ADR-040, decisión 1) y la midió:
cuatro corridas, el p50 de una decisión que reconstruye quedó **entre +0,03 y +0,78 ms** sobre una que
no, y el p95 osciló entre −7,9 y +2,1 ms. Menos de un milisegundo donde se ve, ruido en p95.

**Y eso vale poco, que es el punto de la deuda.** Es SQLite local, sin red, en una laptop. Las dos
consultas de la reconstrucción están indexadas y su plan está verificado, así que contra este almacén el
costo es el de dos lecturas de índice — pero contra un Postgres remoto cada una es un viaje de red, y
ahí la pregunta cambia de escala, no de grado.

**Qué haría falta para cerrarla**: el gateway de PostgreSQL (**D-21**) y la misma medición contra él. Hasta
entonces la excepción al principio IV está declarada **sin cuantificar**, que es distinto de cuantificada
mal: ADR-038 pudo nombrar un disparador porque tenía una base de comparación, y acá no hay ninguna.

**Lo que sí quedó descartado con lo medido**: que reconstruir cambie el orden de magnitud de la petición.
Eso no es nada, pero tampoco es un presupuesto.

## D-27 — Nadie sabe qué cuesta un arranque en frío con tráfico

La spec lo anotó como borde y sigue abierto: en un arranque con tráfico real **todas las sesiones activas
piden reconstrucción a la vez**. Cada una son dos consultas indexadas, así que el problema no es una
consulta cara sino muchas juntas contra un almacén recién abierto, con el caché de páginas vacío.

**Por qué no se puede medir hoy.** Haría falta saber cuántas sesiones hay activas en el momento de un
despliegue, y eso es una cifra de piloto: depende del tráfico del merchant y de la duración de la sesión,
que recién ahora son treinta minutos. Inventar un número y medir contra él daría un resultado con la
misma precisión que el número inventado.

**Qué la vuelve menos grave de lo que suena**, y conviene tenerlo escrito para no sobredimensionarla: la
reconstrucción sólo ocurre en el **primer** lote de cada sesión después del arranque, y a partir de ahí
esa sesión está en memoria. El pico es de una vez, no sostenido. Y si la lectura no contesta, la respuesta
ya está definida y no es un 500: degrada con motivo (ADR-040, decisión 3).

**Qué haría falta para cerrarla**: tráfico de piloto, o la decisión del dueño de aceptar el pico sin
medirlo. Lo que **no** hace falta es una decisión de diseño nueva: las tres alternativas al desacople ya
están evaluadas y descartadas en ADR-040.

## D-28 — Una transacción no se puede componer sobre puertos asincrónicos, y hay dos garantías esperándola

Dos cosas que el hito `persistence-and-resilience` promete siguen sin hacerse, y **son la misma cosa**:

- **La entrada de administración commiteada junto con la acción que registra** — la ventana que ADR-034 deja abierta: hoy una acción que no se puede auditar **no empieza** (el decorador pregunta antes), y lo que queda abierto es que el registro se caiga **durante** la acción.
- **La atomicidad del presupuesto por sesión.**

Las dos necesitan lo mismo: **componer una transacción sobre varias escrituras que pasan por puertos asincrónicos**. Y eso hoy no se puede, por un motivo concreto: `SqlStore.transaction` es **síncrona** —`transaction<T>(work: () => T): T`— y el caso de uso es `async`. Envolver un `await` en una transacción síncrona no es incómodo, es **inseguro**: el `await` cede al bucle de eventos y otra petición puede escribir **dentro** de la transacción abierta.

### Lo que se descartó al tensionarlo (feature 033, research R-05)

- **«En realidad nadie se interpone».** Los gateways de SQLite son sincrónicos de hecho y asincrónicos sólo de tipo, y ningún caso de uso de administración hace I/O real, así que tienta creer que todo corre en un solo drenaje de microtareas. **No**: la cola de microtareas no es de una sola petición, y un `POST /v1/events` a mitad de sus `await` tiene su continuación ahí mismo.
- **Una segunda conexión para el camino de administración.** SQLite admite un solo escritor, `DatabaseSync` es síncrono y la transacción se sostiene a través de `await`: el `run` del ledger **bloquea el bucle** esperando el lock y la transacción no puede avanzar. Deadlock; y con `busy_timeout` corto, toda escritura del SDK durante una acción de administración degradaría a `ledger-unavailable` — publicar una configuración apagaría decisiones.
- **Partir cada caso de uso en «decidir» y «escribir».** Funciona, y es un cambio de forma de **todos** los casos de uso de administración más el decorador.

### El diseño que sí funciona, para que no se vuelva a derivar

Tres piezas, y ninguna toca los casos de uso ni el dominio:

1. **El almacén gana dos métodos y conserva la `transaction` síncrona** tal como está —la orden sigue decidiendo primero/repetido/conflicto ahí adentro—: `scope(work)` abre, espera y cierra o revierte; `enter()` resuelve ya, salvo que haya un scope abierto, y entonces resuelve cuando cierra.
2. **Cada gateway durable espera su turno** con un `await store.enter()` antes de tocar el almacén. Una línea por gateway, sin cambiar ninguna forma.
3. **El olvido no puede ser silencioso**: con `AsyncLocalStorage`, `run` y `all` **lanzan** si hay un scope abierto que no es el propio. A un gateway al que le falte el `enter()` le falla la primera prueba en vez de escribir dentro de la transacción de otro, y eso es un error de programación, que en este proyecto se lanza.

El decorador queda con un puerto del kernel: envuelve `inner.execute` y `log.record` en un `scope`, y si el registro no acepta, lanza y el scope **revierte la acción**. `writable()` desaparece porque la transacción lo subsume.

**El borde filoso, que hay que resolver con esto y no después**: la cola del registro de eventos vacía **por temporizador** y su `flush()` es **sincrónico** a propósito (`record` devuelve `void` para que nadie pueda esperarlo), así que no puede hacer `await enter()`. La salida son pocas líneas y es lo que una cola sabe hacer: si el almacén está ocupado, se queda con las llegadas pendientes y reintenta en el próximo intervalo.

### Por qué se registra en vez de hacerse en la 033

La feature 033 ya tiene su propio riesgo de camino caliente —el índice en memoria de los merchants— y se verifica de otra manera. **Dos riesgos de latencia en la misma feature se estorban al medirlos**, y el criterio de aceptación de la 033 es una medición.

**Qué haría falta para cerrarla**: su propia feature, con este diseño y su prueba del borde filoso. No hace falta ninguna decisión de diseño nueva.

**Y una cosa que conviene saber antes de programarla**: el puerto sobrevive al cambio de motor. Con PostgreSQL, `scope` es `BEGIN`/`COMMIT` sobre un cliente del pool y el `enter()` que hace la cola **desaparece** — es la mitad específica de SQLite. Nada del trabajo se tira, y por eso tampoco urge adelantarlo a D-21.

## Lo que **no** es deuda, y por eso no está acá

| Qué                                                                         | Dónde vive                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Las decisiones del MVP todavía sin cerrar (hosting, piloto, datos, muestra) | ADR-010: son decisiones pendientes, no algo mal hecho |
| Los hitos con operaciones planeadas                                         | el roadmap de `contracts/api-map.yaml`                |
| Un esquema de seguridad que espera su primera operación                     | ADR-020, marcado como propuesto                       |

La diferencia importa: una decisión pendiente no se «cierra» arreglando algo, y un hito planeado ya
tiene su lugar. Mezclarlos acá haría que el registro dejara de decir qué falta **arreglar**.
