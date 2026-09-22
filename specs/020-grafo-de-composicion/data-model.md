# Data model — Grafo de composición tipado (020)

No hay entidades de dominio nuevas: la feature no toca `src/domain/` salvo por una regla que vuelve
a su agregado (`Merchant.liveCredentials`, R-16). Lo que sigue es el modelo de la **biblioteca del
grafo** y el mapa de lo que se muda entre módulos.

## 1. Componente

Algo que el grafo resuelve y comparte durante un arranque. Dos clases, una sola mecánica:

| Clase        | Qué es                                                          | Ejemplos                                                      |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| **Puerto**   | Lo que sirve una tecnología; el despliegue elige cuál           | `MerchantStore`, `Clock`, `DecisionLedger`, `SignatureWindow` |
| **Servicio** | Lo que un módulo expone ya construido; igual en todo despliegue | `AssignmentService`, `ProductTruthService`, `DecisionPlane`   |

**Invariantes**

- Un componente se resuelve **una vez por arranque** y se comparte entre sus consumidores.
- No hay estado global ni acceso estático: la instancia vive en el grafo de ese arranque. Dos
  arranques (dos pruebas) no se ven.
- El valor puede ser `undefined` legítimamente: la memorización pregunta por presencia, no por
  valor.

## 2. Puerto (`Port<T, L>`)

Declarado **una vez** por su módulo dueño, exportado, importado por quien lo necesita.

```ts
export const MerchantStorePort = port("merchant.store")<MerchantStore>();
```

| Campo     | Qué es                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------- |
| `label`   | Nombre legible, literal en la única declaración. **Sólo** para mensajes de error; nunca se compara. |
| fantasma  | El tipo servido, presente en el tipo y ausente en runtime.                                          |
| identidad | El objeto mismo: la resolución usa el objeto como clave, no la etiqueta.                            |

**Invariantes**

- Una declaración por componente en todo el repositorio (`check:ports-bound` lo verifica).
- Dos puertos no comparten etiqueta (mismo gate).
- Toda interfaz exportada por `src/application/*/ports/` es el tipo de algún puerto (FR-014).
- La etiqueta lleva el prefijo del módulo dueño (`merchant.store`, `ledger.decisions`): no es una
  regla del compilador, es la convención que hace legibles los mensajes.

## 3. Enlace (`Binding<Provides, Needs>`)

Cómo se construye un componente: qué puerto sirve, de qué puertos depende y el constructor.

```ts
bind(MerchantStorePort, [], () => memoryMerchantStore());
bind(
  ScopedMerchantsPort,
  [MerchantStorePort],
  (merchants) => new DefaultScopedMerchantService({ merchants }),
);
```

| Campo   | Qué es                                                                           |
| ------- | -------------------------------------------------------------------------------- |
| `port`  | El puerto que sirve; de él sale `Provides` (su etiqueta) en el tipo.             |
| `deps`  | Los puertos que necesita; de ellos sale `Needs` (la unión de sus etiquetas).     |
| `build` | Recibe los valores de `deps`, **en ese orden y con esos tipos**, y devuelve `T`. |
| `kind`  | `bind` o `derive`.                                                               |

**Invariantes**

- Los parámetros del constructor los infiere el compilador de `deps`: un orden equivocado o un tipo
  que no corresponde no compila.
- Un enlace no puede construir nada que no haya pedido: no hay acceso al grafo desde el builder.
- Sólo dentro de un builder puede instanciarse un adaptador o escribirse un objeto que haga de
  implementación de puerto (regla de forma nueva, FR-015).

## 4. Vista derivada (`derive(Vista, Fuente)`)

Un componente que **es** otro visto por una interfaz más angosta.

```ts
derive(MerchantDirectoryPort, MerchantStorePort); // la misma instancia, dos vistas
```

**Invariantes**

- `Fuente` satisface `Vista` (`S extends T`), o no compila.
- Resolver la vista devuelve **el objeto** que resolvió la fuente (identidad, no copia).
- Una vista no puede enlazarse por separado con `bind`: sería otra instancia (hoy es lo que evitan a
  mano los cierres `store ??= …` de merchant, experiment y configuration).

## 5. Tabla por tecnología (`technology(puertos, enlaces)`)

El conjunto de enlaces con que **una** tecnología sirve los puertos de un módulo.

```ts
const memory = technology(MERCHANT_PORTS, [bind(MerchantStorePort, [], …), derive(MerchantDirectoryPort, MerchantStorePort)]);
```

**Invariantes**

- Sirve **todos** los puertos que el módulo declara, o no compila (`Unserved<…>`).
- Puede servir un puerto **declarado por otro módulo** cuando el mapa de contextos permite verlo:
  es el idioma vigente del repositorio —el consumidor declara su puerto de lectura y quien puede
  resolverlo lo enlaza— y es lo que hace que la configuración sirva la política de la decisión, los
  presupuestos del catálogo y el holdout del experimento sin que ninguno de los tres la importe.
- Un módulo puede tener varias (`memory`, mañana `postgres`); el despliegue elige una.

## 6. Módulo de composición

Exporta **exactamente tres cosas**, todas opcionales (FR-008, FR-009):

| Parte          | Qué lleva                                                                          | Quién la consume |
| -------------- | ---------------------------------------------------------------------------------- | ---------------- |
| `technologies` | Una tabla por tecnología de sus propios puertos                                    | el despliegue    |
| `exposes`      | Los servicios que otros módulos pueden consumir, iguales en todo despliegue        | otros módulos    |
| `serves`       | Lo que aporta al servidor: handlers por `operationId`, esquemas de seguridad, CORS | el servidor      |

**Invariantes**

- Un módulo que no sirve operaciones **omite** `serves`; no existe `() => ({})` para figurar en una
  lista (hoy lo hacen `decisionModule` y `barrierModule`).
- Un módulo declara **sólo sus propias necesidades**: consume de otro módulo servicios ya
  construidos, nunca sus puertos internos (FR-010; hoy `DecisionPorts extends ExperimentPorts,
CatalogPorts, BarrierPorts, Pick<LedgerPorts, …>`).
- Lo que un módulo importa de otro lo juzga `CONTEXT_MAP`, ahora también en
  `src/composition/modules/` (FR-011).
- En `serves`, el `operationId` es **la clave**: el nombre viaja una sola vez y de ahí lo toman el
  log y la auditoría (FR-022).

## 7. Despliegue (`deployment([...])`)

La lista de módulos con la tecnología elegida para cada uno. **La única lista.**

```ts
export const localDeployment = deployment([kernel.with("system"), merchant.with("memory"), …]);
```

**Invariantes**

- **Sin orden significativo**: reordenar no cambia el resultado (FR-004). El orden sólo fija el
  orden de creación y, por lo tanto, el inverso de cierre.
- No compila si algún requisito queda sin proveedor (`Missing<…>`, FR-002).
- No compila si la unión de los `serves` no cubre `keyof operations` (`Unwired<…>`, FR-013).
- Ningún envoltorio perezoso: una dependencia cruzada es un puerto pedido, no un `() => …`.

## 8. Grafo resuelto (`Graph`)

Lo que `deployment(...)` produce al arrancar.

| Operación       | Qué hace                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `resolve(Port)` | El valor del componente; lo construye la primera vez y lo memoriza. Tipado por el puerto.      |
| `resolveAll()`  | Construye todo lo enlazado, en el orden de la lista: fija el orden de creación y halla ciclos. |
| `ports`         | Los puertos del despliegue (lo que el helper de pruebas necesita para envolverlos).            |
| `closables`     | Lo construido que sabe cerrarse, en orden de creación; el arranque cierra en orden inverso.    |

**Transiciones y fallas**

| Situación                                                    | Cuándo se ve    | Qué dice                                         |
| ------------------------------------------------------------ | --------------- | ------------------------------------------------ |
| Requisito sin proveedor                                      | **compilación** | `Missing<"clock">`                               |
| Tabla de tecnología incompleta                               | **compilación** | `Unserved<"merchant.directory">`                 |
| Vista derivada de una instancia ajena                        | **compilación** | el tipo de la fuente no satisface el de la vista |
| Operación del contrato sin handler                           | **compilación** | `Unwired<"getMerchant">`                         |
| Ciclo entre proveedores                                      | arranque        | `Cycle in the composition graph: a -> b -> a.`   |
| Operación en el archivo de contrato que el binario no conoce | arranque        | el mensaje de hoy, sin cambios (constitución II) |

## 9. Lo que se muda (sin cambiar de comportamiento)

### Al módulo `access` (US4)

| Desde                                                                                       | Hacia                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------- |
| `application/merchant/services/{ingest-key,platform-key,platform-signature}.service.ts`     | `application/access/services/`        |
| `application/admin/services/admin-token.service.ts`                                         | `application/access/services/`        |
| `application/merchant/ports/{signature-window,message-authenticator}.ts`                    | `application/access/ports/`           |
| `application/admin/ports/{operator-directory,token-fingerprinter}.ts`                       | `application/access/ports/`           |
| `interface-adapters/merchant/security/{ingest-key,platform-key}.ts`                         | `interface-adapters/access/security/` |
| `interface-adapters/admin/security/admin-token.ts`                                          | `interface-adapters/access/security/` |
| `interface-adapters/merchant/gateways/node-message-authenticator.ts`                        | `interface-adapters/access/gateways/` |
| `interface-adapters/admin/gateways/{config-operator-directory,node-token-fingerprinter}.ts` | `interface-adapters/access/gateways/` |
| Los tres esquemas (`ingestKey`, `platformKey`, `adminToken`) y sus headers                  | `composition/modules/access.ts`       |

**Se quedan**: `Merchant` y sus reglas, `PlatformSignature`, `CredentialMinter` y `RotationPolicy`
(puertos de `merchant`, implementación provista por `access`), `ClockTolerance` (kernel). Fundamento
en research R-10.

### Al `shared-kernel` (US6)

| Desde                                   | Hacia                                              |
| --------------------------------------- | -------------------------------------------------- |
| `AuditedUseCase` (`application/admin/`) | `application/shared-kernel/decorators/`            |
| — (nuevo)                               | `application/shared-kernel/ports/audit-trail.ts`   |
| — (nuevo)                               | `interface-adapters/admin/gateways/audit-trail.ts` |

**Se queda en `admin`**: `AdminEntry`, `AdminLog`, el almacén y las dos lecturas paginadas. El actor
cruza el borde del kernel como texto y `admin` lo vuelve a tipar con `asOperatorId` (pérdida
acotada y documentada, FR-024).

### Fuera de la composición (US5)

| Qué                                                       | Hacia                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `composition/adapters/switch-aware-policy-directory.ts`   | `application/configuration/services/` (el mapa ya lo permite)     |
| `rotation`, `signatureWindow` (objetos anónimos)          | `interface-adapters/access/gateways/`                             |
| `tolerance` (objeto anónimo)                              | `interface-adapters/shared-kernel/`                               |
| `visitorWindow` y la ventana de sesión (objetos anónimos) | `interface-adapters/decision/gateways/`                           |
| `holdout` (objeto anónimo)                                | `interface-adapters/experiment/gateways/`                         |
| El tope compartido `dedupWindow.maxIds`                   | `PlatformConfiguration.identityCap()`, con la decisión en ADR-034 |
