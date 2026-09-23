# Research — Grafo de composición tipado y seguridad con dueño (020)

**Fecha**: 2026-09-22 · **Rama**: `020-grafo-de-composicion` · **Base**: `main` (`eb32fc2`)

Cada decisión lleva su evidencia. Lo medido se midió en el repositorio; lo tipado se compiló con
el compilador del repositorio (`@typescript/native`, TS 7) antes de escribirse acá.

## R-01 — Se conserva la inyección de dependencias manual

**Decisión**: DI manual, composition root único, sin contenedor y sin framework de efectos
(ADR-013, constitución I y "Stack": _inyección de dependencias explícita, composition root único,
sin singletons de infraestructura_). Lo que cambia es **cómo** se expresa el cableado, no quién lo
hace.

**Fundamento**: los contenedores del ecosistema chocan con reglas vigentes:

| Candidato    | Mecanismo                                | Por qué queda afuera                                                                                   |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| InversifyJS  | decoradores + `reflect-metadata`         | `erasableSyntaxOnly` (ADR-011/012) prohíbe decoradores y parámetros de propiedad; metadatos en runtime |
| tsyringe     | decoradores + `reflect-metadata`         | igual                                                                                                  |
| Awilix       | resolución por nombre (`asClass`, proxy) | resolución por texto: la decisión del dueño la prohíbe (spec, FR-001)                                  |
| Effect Layer | runtime de efectos completo              | reescribiría dominio y aplicación; fuera del alcance de la spec                                        |

**Alternativas consideradas**: adoptar `Layer` de Effect sólo en la composición — descartada: su
tipo `Layer<Out, Error, In>` es inseparable de su runtime (`Effect`), y arrastrarlo al arranque
obliga a que los constructores devuelvan efectos.

## R-02 — Prior art: de dónde sale la forma elegida

**Fuentes consultadas (2026-09-22)**:

1. **"Dependency Composition"**, Chris Simon, martinfowler.com (2024). Fábricas con aplicación
   parcial en vez de contenedor; **interfaces angostas definidas por el consumidor**; composition
   root explícito; se acepta duplicar un tipo antes que acoplar dos módulos. Es exactamente la
   regla que el repositorio ya sigue ("cada consumidor define su puerto de lectura y la composición
   enlaza") y confirma que el problema no es la DI manual sino su expresión.
2. **`Layer` de Effect-TS**. Tres ideas que sí se toman: el servicio se identifica por una
   **etiqueta declarada una vez** (`Context.Tag("Nombre")`), los **requisitos viajan en el tipo**
   (`Layer<Out, Error, In>`) y la capa final del despliegue sólo compila con requisitos `never`
   —cobertura verificada por el compilador—. La idea que no se toma: el runtime de efectos.
3. **`androidand/opencode-skein`, issue #10**. Caso documentado de **dos grafos mantenidos a mano**
   que divergen en silencio; el arreglo fue declarar las dependencias junto al nodo
   (`LayerNode.make(layer, deps)`) y verificar la cobertura en compilación (`CheckDependencies`).
   Es el mismo defecto que se midió acá: la lista de módulos (`modules/index.ts`), la intersección
   de puertos (`ports.ts`) y el spread del perfil (`profiles/local.ts`) son tres grafos paralelos
   escritos a mano.

**Decisión**: recorte deliberado de `Layer` —etiqueta única, requisitos en el tipo, tablas por
tecnología— sin traerse el runtime de efectos; forma de fábricas y de interfaces del consumidor
según Simon.

## R-03 — Un puerto es una constante importada, no un nombre

**Decisión**:

```ts
export const MerchantStorePort = port("merchant.store")<MerchantStore>();
```

`port` es currificada para que la etiqueta se infiera como literal (`"merchant.store"`) y el tipo
servido se dé explícito. El valor que devuelve es el **objeto de identidad** del componente: la
resolución en runtime usa ese objeto como clave de un `Map`, nunca la cadena. La etiqueta viaja en
el tipo para que los mensajes del compilador y del arranque la nombren, y aparece **una sola vez**
en todo el repositorio, en su declaración.

**Forma del tipo** (probada, § R-04):

```ts
declare const PHANTOM: unique symbol;
export interface Port<T, L extends string = string> {
  readonly label: L;
  readonly [PHANTOM]?: T; // fantasma: no existe en runtime
}
export type AnyPort = Port<unknown, string>;
```

El fantasma es una **propiedad opcional** (covariante en `T`), no una función: con
`readonly [PHANTOM]?: (v: T) => T` el tipo queda invariante y `Port<Clock, "clock">` deja de ser
asignable a `AnyPort`, lo que rompe toda la maquinaria (comprobado: siete errores TS2352/TS2375 en
el primer intento del spike).

**Consecuencia buscada**: consumir algo de otro módulo es un `import` de su puerto. El acoplamiento
entre módulos de composición deja de ser invisible y pasa a ser un arco que dependency-cruiser
puede juzgar (R-13). Es el argumento decisivo frente a la resolución por nombre, más allá de la
prohibición de literales.

## R-04 — La cobertura la verifica el compilador (`Missing<…>`)

**Decisión**: `compose` recibe la lista de enlaces y **no compila** si algún requisito queda sin
proveedor; el error nombra las etiquetas faltantes.

```ts
type Holes<B extends readonly Binding[]> = Exclude<Needed<B>, Provided<B>>;
export function compose<const B extends readonly Binding[]>(
  bindings: B & (Holes<B> extends never ? unknown : Missing<Holes<B>>),
): Graph<Provided<B>>;
```

**Evidencia** (spike compilado con `node_modules/@typescript/native/bin/tsc`, `strict`,
`erasableSyntaxOnly`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`):

| Caso                                             | Resultado                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Despliegue completo (4 enlaces, uno derivado)    | compila, `exit=0`                                                                      |
| Falta el proveedor de `clock`                    | `TS2345 … no es asignable a … & Missing<"clock">` — la etiqueta faltante en el mensaje |
| Tabla de tecnología sin uno de sus puertos       | `TS2345 … & Unserved<"merchant.directory">`                                            |
| `derive(DirectoryPort, ClockPort)` (vista ajena) | `TS2379 … 'Clock' no tiene 'get', requerido por 'Directory'`                           |
| Despliegue al que le falta un módulo que sirve   | `TS2345 … & Unwired<"getMerchant">` — la operación sin handler en el mensaje           |

Los cuatro negativos entran como fixtures de `tests/typecheck/` (el mecanismo ya existe:
`tests/typecheck/fixtures/ports-incomplete.ts` compila un fixture con un tsconfig temporal y
afirma el código de error), y el positivo lo verifica `npm run typecheck` sobre `src/`.

**Distribución de uniones**: `Provided`/`Needed` se calculan con alias de parámetro desnudo
(`type ProvidesOf<B> = B extends Binding<infer P, string> ? P : never`) para que el condicional
distribuya sobre `B[number]`. Con el condicional escrito en línea sobre `B[number]`, TS infiere
`string` y todo despliegue se reporta como incompleto (medido en el primer intento).

**Alternativas consideradas**: (a) verificar la cobertura al arrancar — es lo que hay hoy para las
operaciones y no impide el error, sólo lo corre el proceso; (b) una prueba que recorra el grafo —
tampoco impide escribirlo mal. La spec pide compilación (FR-002, FR-003, FR-013).

## R-05 — Tablas por tecnología y la lista del despliegue

**Decisión**: el módulo declara sus componentes y **la lista de enlaces que los sirve**. Una tabla
por tecnología aparece **sólo** cuando hay más de una manera de servirlos, y entonces el despliegue
elige una con una clave tipada del propio módulo:

```ts
export const localDeployment = deployment([
  kernelModule,
  merchantModule,
  ledgerModule, // mañana, con dos tecnologías: ledgerModule.with("postgres")
]);
```

**Enmendado el 2026-09-22** (challenge del dueño, después de la entrega): la primera versión pedía
la tabla siempre, con `memory` como única clave en los catorce módulos. Era una pregunta sin
alternativa: nombraba una elección que no existía y obligaba a leer una clave para llegar a los
enlaces. No hay nombre de tecnología que inventar hasta que haya algo que elegir, y el día que lo
haya la tabla vuelve con las dos claves y el compilador pide la elección (`ChooseATechnology<…>`).
Por el mismo motivo `exposes` pasó a llamarse `assembles`: dice lo que el módulo **hace** con sus
componentes, no una dirección.

`with` está tipado `<K extends Names<M>>`: un nombre inexistente no compila, y no es resolución por
texto (es una clave de un registro cerrado que el compilador verifica). Con una sola manera de
servirse, `Names<M>` es `never` y el módulo entra al despliegue tal cual. La lista **no tiene orden
significativo**: la resolución va por dependencia. Desaparecen `ports.ts` (la intersección de trece
slices), `modules/index.ts` (la lista `MODULES`) y `profile.ts` (el `binder`): la lista del
despliegue es la única lista.

Las tecnologías de un módulo tienen que proveer **lo mismo**; la que se aparta no compila y el
error la nombra (`TechnologiesDisagree<…>`, FR-003, probado en R-04).

## R-06 — Cobertura de operaciones: en compilación **y** al arrancar

**Decisión**: las dos, porque protegen de cosas distintas.

- **En compilación** (nuevo, FR-013): la unión de lo que los módulos del despliegue sirven cubre
  `keyof operations` (el tipo generado del contrato). Atrapa el módulo olvidado en la lista.
  Probado: `Unwired<"getMerchant">` (R-04).
- **Al arrancar** (se conserva, constitución II): `assertEveryOperationWired` compara contra el
  **archivo de contrato que el proceso carga**, que puede declarar más operaciones que el binario
  conoce (es justo lo que verifica `tests/integration/bootstrap.test.ts` con un contrato
  modificado). El compilador no puede ver ese archivo.

**Consecuencia**: la prueba de arranque existente sigue valiendo sin tocarse, y el caso que hoy
sólo se ve al arrancar (un módulo fuera de la lista) se adelanta a compilación.

## R-07 — Resolución perezosa, memorizada, y ciclos al arrancar

**Decisión**: `compose` devuelve un grafo que resuelve por dependencia, **perezoso y memorizado**:
un componente se construye una vez por arranque y se comparte entre sus consumidores. No hay patrón
Singleton (nada global, nada estático): la instancia vive en el grafo de ese arranque, y dos
arranques —dos pruebas— no se ven. Esto reemplaza los cierres `store ??= …` que hoy garantizan "una
instancia detrás de dos puertos" en merchant, experiment y configuration.

El arranque hace `resolveAll()` (recorre los enlaces del despliegue) para que:

- un **ciclo** falle al arrancar nombrando el ciclo completo (probado: `Cycle in the composition
graph: a -> b -> a.`), y no en la primera request que lo toque;
- el orden de creación quede fijado por el orden de la lista, y el cierre sea su inverso (la
  prueba de `close()` en orden inverso de creación no cambia);
- un componente enlazado que nadie consume igual se construya y se cierre.

La memorización usa `Map.has`, no `!== undefined`: un componente cuyo valor legítimo sea `undefined`
no debe reconstruirse.

**Costo aceptado**: el tipo no puede expresar la ausencia de ciclos de forma practicable (el spike
lo confirma: `Binding` no lleva un orden topológico en el tipo). Queda como falla de arranque con
prueba (FR-006, SC-004).

## R-08 — Una instancia, dos vistas: `derive`

**Decisión**: `derive(VistaPort, FuentePort)` declara que la vista **es** la fuente vista por una
interfaz más angosta; el grafo devuelve el mismo objeto (probado: `store === directory`, y el
constructor corrió una sola vez). `S extends T` en la firma hace que derivar de una instancia que
no satisface la vista no compile (probado, R-04).

Reemplaza los tres cierres de hoy (`merchants`/`merchantStore`, `experiments`/`experimentStore`,
`configuration`/`levels`/`configurationStore`).

## R-09 — Las pruebas: el helper conserva su truco

**Medido**: 49 lugares pasan `ports: { … }` y 27 leen `ports.decisions` y compañía;
`sharedTestApp` construye el servidor una vez por archivo y reemplaza los puertos en memoria antes
de cada prueba envolviendo **cada clave de `Ports`** en un proxy que delega en la construcción
vigente (015 F-055).

**Decisión**: el truco se conserva porque el grafo sabe enumerar sus puertos (`graph.ports`): el
helper resuelve cada puerto, lo envuelve en el mismo proxy delegante y arma el grafo del servidor
con esos valores. Lo que cambia es la forma de nombrar el reemplazo:

```ts
await startTestApp({ ports: [replace(DecisionLedgerPort, fakeLedger)] });
```

Es un cambio mecánico en 49 llamadas y 27 lecturas (`app.ports.decisions` →
`app.resolve(DecisionLedgerPort)`), **sin tocar una sola aserción de comportamiento** (FR-026): lo
que cambia es cómo la prueba nombra el puerto, no qué espera del sistema.

**Alternativa considerada**: mantener un mapa por nombre sólo para las pruebas. Descartada: sería
resolución por texto reintroducida por la puerta de atrás, y el compilador dejaría de verificar que
el doble corresponde al puerto.

## R-10 — El dueño de la seguridad se llama `access`

**Decisión**: el módulo nuevo se llama **`access`** —quién entra y con qué— y no `security`, porque
el anillo de adaptadores ya usa `<módulo>/security/` para la carpeta de security handlers de cada
módulo: un módulo llamado `security` daría `interface-adapters/security/security/`. Con `access`
todas las convenciones de carpeta quedan intactas:

| Qué                                                                   | Hoy                                                                                     | Con `access`                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| Resolución de clave de ingesta, de plataforma y verificación de firma | `application/merchant/services/{ingest-key,platform-key,platform-signature}.service.ts` | `application/access/services/`        |
| Resolución del token de operador                                      | `application/admin/services/admin-token.service.ts`                                     | `application/access/services/`        |
| Puertos de firma y HMAC                                               | `application/merchant/ports/{signature-window,message-authenticator}.ts`                | `application/access/ports/`           |
| Directorio de operadores y huellas                                    | `application/admin/ports/{operator-directory,token-fingerprinter}.ts`                   | `application/access/ports/`           |
| Los tres security handlers                                            | `interface-adapters/{merchant,admin}/security/`                                         | `interface-adapters/access/security/` |
| Gateways de firma, huella y directorio de operadores                  | `interface-adapters/{merchant,admin}/gateways/`                                         | `interface-adapters/access/gateways/` |
| Los tres esquemas del contrato y sus headers                          | repartidos entre `modules/merchant.ts` y `modules/admin.ts`                             | `composition/modules/access.ts`       |

`CONTEXT_MAP` gana `access: ["shared-kernel", "operator", "merchant"]`. La dirección es
**`access` → `merchant`** (lee la vista del directorio, FR-017) y nunca al revés: ése es el
invariante que evita el ciclo.

**Lo que no se mueve, y por qué**:

- `Merchant` (credenciales, `owns`, `signingSecrets`, `requiresSignature`, `rotated`) se queda en
  `domain/merchant`: las reglas viven en el agregado (ADR-024, ADR-031). `access` las invoca.
- `PlatformSignature` (`domain/merchant/platform-signature.ts`) se queda: es la firma **de una
  request de un merchant**, verificada con los secretos del agregado; moverla obligaría a
  `merchant` a mirar a `access`.
- `ClockTolerance` se queda en el `shared-kernel`: la leen ingesta, catálogo y outcomes para juzgar
  instantes declarados. Es una regla de frescura de datos, no de autenticación; moverla haría que
  tres módulos que no autentican dependan de `access`. La spec la nombró en el contexto como
  ejemplo de política repartida; el plan decide que su dueño correcto es el kernel (el único módulo
  que todos pueden ver) y que lo que se corrige es su **implementación anónima**, que pasa a un
  adaptador con nombre (R-12).
- `RotationPolicy` y `CredentialMinter` siguen declarados como puertos de `application/merchant`
  (los consume `RotateCredentialUseCase`, que administra el agregado), pero **`access` provee sus
  implementaciones**: así `modules/merchant.ts` no declara ninguna política de firma ni de rotación
  (FR-018) y no aparece ningún ciclo. Es el idioma que el repositorio ya usa con `configuration`
  ("cada consumidor define su puerto de lectura y la composición enlaza").

**Alternativa descartada**: que `access` fuera dueño también del puerto `RotationPolicy` y
`merchant` lo consumiera. Produce `merchant → access` y `access → merchant`: ciclo en el mapa de
contextos.

## R-11 — La auditoría es una obligación de plataforma

**Decisión**: el `shared-kernel` de aplicación declara un puerto de **escritura angosto** y el
decorador que lo usa; `admin` conserva la entrada, el almacén y las lecturas paginadas, e
implementa el puerto.

```
application/shared-kernel/ports/audit-trail.ts      AuditTrail.record(entry): Promise<void>
application/shared-kernel/decorators/audited.use-case.ts   AuditedUseCase (hoy en application/admin)
application/admin/…                                  AdminEntry, AdminLog, las dos lecturas
interface-adapters/admin/gateways/audit-trail.ts     implementa AuditTrail sobre AdminLog
```

**Costo aceptado y acotado** (FR-024): el kernel no puede ver `OperatorId` (tiene dueño:
`domain/operator`), así que en el puerto el actor viaja como texto; la implementación de `admin` lo
vuelve a tipar con `asOperatorId`. La pérdida está en **un** borde, documentada en el ADR y cubierta
por la prueba de que la entrada del registro es idéntica campo por campo.

**Alternativa descartada** (decisión del dueño en la sesión de evaluación): ampliar `CONTEXT_MAP`
con "todos pueden ver `admin`". Convierte una excepción silenciosa en una excepción escrita, que es
peor: cualquier módulo podría importar casos de uso de administración.

## R-12 — Ninguna política anónima en la composición

**Medido**: hoy se escriben como objetos literales dentro de `composition/modules/`:
`rotation`, `signatureWindow`, `tolerance`, `visitorWindow`, la ventana de sesión y `holdout`. Son
implementaciones de puerto que esquivan el anillo de adaptadores.

**Decisión**: cada una pasa a un gateway con nombre en `interface-adapters/<módulo>/gateways/`
(`rotationPolicyOf(platform)`, `signatureWindowOf(platform)`, `clockToleranceOf(platform)`,
`visitorWindowOf(platform)`, `sessionWindowOf(platform)`, `holdoutSourceOf(configuration)`), y una
**regla de forma nueva** las mantiene ahí: en `composition/modules/*.ts` un `new` de
`interface-adapters/`/`infrastructure/` y todo objeto literal que haga de implementación de puerto
sólo pueden aparecer **dentro del builder de un `bind`**; `assembles` y `serves` sólo instancian casos
de uso y servicios de `application/` (FR-015, FR-016). Fixture propio, como las otras seis reglas de
forma.

`switchAwarePolicyDirectory` (la regla "un merchant que el store no conoce está apagado") pasa a
`application/configuration/` como servicio, que es el módulo cuyo mapa de contextos ya permite ver
`merchant` y `decision`; `composition/adapters/` desaparece (FR-019).

## R-13 — El mapa de contextos rige en la composición

**Decisión**: las reglas `context-map:<módulo>` se extienden a
`src/composition/modules/<módulo>.ts` (hoy `MOD` sólo cubre `domain|application|interface-adapters`).
Es posible **porque** R-03 convirtió el consumo entre módulos en un import.

**Medido hoy**: `modules/decision.ts` importa cinco módulos y `modules/ingestion.ts` importa
`decision`, sin que ninguna regla lo juzgue; `modules/merchant.ts` importa `application/admin`
violando el mapa en silencio. Con la regla, lo primero queda legítimo (el mapa ya permite
`decision → {experiment, catalog, barrier, ledger}` e `ingestion → decision`) una vez que el plano
pida **servicios construidos** en vez de heredar slices (FR-010), y lo segundo desaparece por R-11.

El fixture vive en `tests/architecture/fixtures/src/composition/modules/` junto a los demás.

## R-14 — `check:ports-bound`: ninguna abstracción declarada y no enlazada

**Decisión**: gate nuevo, `scripts/check-ports-bound.mjs`, en la cadena de `quality` (ADR-016) y con
adaptador `findings-v1` en `scripts/audit/gate-ports-bound.mjs`.

- **Entrada**: toda interfaz o tipo exportado por `src/application/*/ports/*.ts`.
- **Regla**: cada uno aparece como el tipo servido de algún `port<T>()` en
  `src/composition/modules/*.ts`. Lo que no, se reporta con archivo y línea.
- **Además**: dos puertos no comparten etiqueta (la etiqueta viaja en el tipo y una repetida
  confundiría los mensajes y el conteo).
- **Cómo lee**: con la API 6.0 de TypeScript, como ya hacen `scripts/lint/_typed.mjs` y
  `scripts/check-language.mjs`; sin expresiones regulares sobre el fuente.
- **Fixture**: `tests/audit/fixtures/` gana un caso con un puerto declarado y no enlazado; la prueba
  exige que el gate lo nombre y que `src/` pase limpio.

Hoy esto no lo cubre nadie: knip informa los **tipos exportados sin uso** en modo informativo, y un
puerto puede estar "usado" por un caso de uso y aun así no estar enlazado en ningún despliegue.

## R-15 — El tope que comparten sesión, visitante y deduplicación

**Medido**: `memoryDecisionPorts` toma `maxVisitors` y `maxSessions` de `platform.dedupWindow.maxIds`
—un valor de la deduplicación de eventos— sin decisión que lo respalde.

**Decisión**: **decisión registrada**, no valor nuevo (la spec admite las dos, FR-021). El nivel de
plataforma se publica por el contrato (`PlatformConfiguration`, `additionalProperties: false`,
`required` con diez campos): agregar `sessionCap`/`visitorCap` cambiaría el contrato, y SC-007 exige
**cero diff** del contrato y su mapa. Lo que se corrige es que el reparto sea implícito: la entidad
`PlatformConfiguration` gana un lector con nombre —`identityCap()`— que devuelve
`dedupWindow.maxIds`, y los tres gateways en memoria lo piden por ese nombre.

**Fundamento**: es un único límite de la instancia —cuántas identidades mantiene en memoria un
proceso (constitución IV: instancia única; Redis es estado caliente acotado)—, no tres políticas.
Queda escrito en el ADR y el día que la persistencia caliente llegue, separarlo es un campo nuevo
del nivel 1 y un bump del contrato, no un cambio de forma.

## R-16 — El reloj de los controllers

**Medido**: cuatro controllers de `merchant` reciben `Clock` sólo para que `merchantDto` filtre las
credenciales vigentes (`expiresAt > now`).

**Decisión**: el instante viaja con el resultado. "Qué credenciales están vigentes ahora" es una
regla del agregado (ADR-024): pasa a `Merchant.liveCredentials(now)`, el caso de uso —que ya tiene o
recibe el reloj— la invoca y su respuesta lleva lo que el presenter pinta. Los cuatro controllers
dejan de recibir el reloj (FR-023) y el DTO no cambia: la misma lista, el mismo orden.

## R-17 — Un solo salto, no una migración gradual

**Decisión**: el cambio es de una sola vez sobre `src/composition/`, el arranque y el helper de
pruebas. No hay convivencia de dos mecanismos: `binder`/`Bindings`/`Module`/`Ports` y el grafo no
pueden coexistir sin que el perfil mantenga dos listas —justo el defecto que la feature elimina
(R-02, caso 3).

**Orden de ejecución** (una historia, un commit):

1. **US1 + US2** juntas en la biblioteca y la forma (el contrato del módulo no se puede probar sin
   grafo, y el grafo sin la forma no tiene quién lo use), pero con commits separados: primero la
   biblioteca con sus fixtures de tipo, después la migración de los catorce módulos y el despliegue.
2. **US3** (los dos gates nuevos) inmediatamente después: verifican lo que US1/US2 acaban de dejar.
3. **US4** (`access`), **US5** (la composición deja de decidir) y **US6** (auditoría en el kernel)
   son movimientos independientes sobre el grafo ya en pie.

**El juez**: la suite existente. En cada paso corren `format:check`, `typecheck`, `quality` y
`npm test`; al cierre, `contract:check`, `test:scoped`, `test:contract`, `release-check` y
`test:mutation`. Las únicas pruebas que se reescriben son las **del mecanismo que se reemplaza**
(`tests/unit/composition/wiring.test.ts`, `profile.test.ts`, el fixture de tipos
`ports-incomplete.ts` y `tests/unit/composition/adapters/switch-aware-policy-directory.test.ts`, que
se muda a `configuration`): ninguna de ellas afirma comportamiento del producto.
