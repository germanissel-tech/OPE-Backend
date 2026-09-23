# Contrato — la API del grafo de composición

Lo que un módulo de composición puede usar y lo que tiene que respetar. Las firmas de acá se
compilaron con el compilador del repositorio; los mensajes de error citados son los que emitió.

## 1. Declarar un componente

```ts
export const MerchantStorePort = port("merchant.store")<MerchantStore>();
```

- La forma es currificada para que la etiqueta se infiera como literal y el tipo servido se dé
  explícito.
- La etiqueta lleva el prefijo del módulo dueño y **no se repite en ningún otro lugar**: no es un
  identificador de resolución, es lo que el compilador y el arranque imprimen.
- El módulo dueño exporta la constante **si otro la necesita**; lo que sólo usa él queda interno.
  **No hay `get("nombre")`.**

## 2. Enlazar

```ts
bind(Puerto, { dep1: Dep1Port, dep2: Dep2Port }, ({ dep1, dep2 }) => valor);
```

- Las dependencias se declaran **por nombre**, nunca por posición: el builder recibe un objeto con
  esos mismos nombres y sus tipos salen de los puertos.
- El builder es el **único** lugar donde puede instanciarse un adaptador o escribirse un objeto que
  haga de implementación de puerto (regla de forma, ver `ports-bound-gate.md` § 2).

```ts
bindAll([MerchantStorePort, MerchantDirectoryPort], {}, () => memoryMerchantStore());
```

- Una instancia, varias vistas: se construye **una vez** y los dos puertos responden con el mismo
  objeto. El valor tiene que satisfacer a todas; si no:

  ```
  TS2322: Type '{ ids: () => never[]; }' is not assignable to type
  '{ now: () => Date; } & { ids: () => string[]; }'. Property 'now' is missing
  ```

- Un reemplazo es de un componente, no de un enlace: reemplazar el store no reemplaza su directorio.

## 3. El módulo dice tres cosas

```ts
export const merchantModule = compositionModule({
  // Lo que provee: sus componentes.
  provides: [
    bindAll([MerchantStorePort, MerchantDirectoryPort], {}, () => memoryMerchantStore()),
    bind(CredentialMinterPort, {}, () => nodeCredentialMinter),
  ],
  // Lo que arma con eso, igual en todo despliegue.
  assembles: [bind(ScopedMerchantsPort, { merchants: MerchantStorePort }, (d) => new DefaultScopedMerchantService(d))],
  // Lo que sirve al servidor.
  serves: { handlers: { … }, security: { … }, cors: … },
});
```

Lo que **necesita** no es una cuarta clave: son los `import` del encabezado y los nombres de cada
`bind`. Una lista escrita a mano puede quedar vieja y mentir; un import no, y el mapa de contextos
lo juzga.

**La tecnología sólo se nombra cuando hay algo que elegir.** El día que la persistencia llegue,
`provides` pasa a ser una tabla y el despliegue nombra una clave:

```ts
provides: {
  memory: [bind(DecisionLedgerPort, {}, () => memoryDecisionLedger())],
  postgres: [bind(DecisionLedgerPort, { pool: PoolPort }, ({ pool }) => postgresDecisionLedger(pool))],
},
```

Si un módulo declara dos tecnologías y una no provee lo que la otra sí:

```
TS2345: … is not assignable to parameter of type '… & TechnologiesDisagree<"test.directory">'
```

## 4. Servir operaciones

```ts
serves: {
  handlers: {
    getMerchant: handler({ deco: DecoratorsPort, scoped: ScopedMerchantsPort, clock: ClockPort },
      (operation, { deco, scoped, clock }) =>
        makeGetMerchant(deco.logged(operation, new GetMerchantUseCase({ scoped })), clock)),
  },
},
```

- La **clave es el `operationId`** y el compilador la verifica contra el tipo generado del contrato.
- El builder recibe ese `operationId` como primer argumento: el nombre viaja una sola vez (FR-022).
  El nombre del **log** es el del caso de uso, que a veces no es el de la operación.
- Un módulo que no sirve nada **omite la clave**.

Lo demás que un módulo sirve —los esquemas de seguridad y la política de CORS— no recibe
`operationId` y se arma con `from`:

```ts
serves: {
  cors: from({ merchants: MerchantDirectoryPort }, ({ merchants }) => merchants),
  security: {
    [INGEST_KEY_SCHEME]: from({ merchants: MerchantDirectoryPort, … }, (deps) => ({ … })),
  },
},
```

La clave dice **qué** es; `from` dice **de dónde sale**. Es la misma convención que `handler`.

## 5. Componer el despliegue

```ts
export const localDeployment = (config: AppConfig) =>
  deployment([
    releaseComponents(config),
    kernelModule,
    merchantModule,
    ledgerModule.with("postgres"), // sólo si el módulo declara más de una tecnología
    …
  ]);
```

- La lista **no tiene orden significativo**.
- Un módulo con una sola forma de servirse entra tal cual: no hay nada que decidir. Con dos o más,
  el compilador pide la elección:

  ```
  TS2322: Type 'ChooseATechnology<Names<…>> & { … }' is missing the following properties
  from type 'Deployed<…>': bindings, provided, serves
  ```

- Falta un proveedor:

  ```
  TS2345: … is not assignable to parameter of type '… & Missing<"clock">'
  ```

- Falta un módulo que sirve operaciones:

  ```
  TS2345: … is not assignable to parameter of type '… & Unwired<"getMerchant">'
  ```

## 6. Arrancar y resolver

| Llamada              | Qué garantiza                                                                         |
| -------------------- | ------------------------------------------------------------------------------------- |
| `graph.resolve(P)`   | El valor del componente, tipado. Construido a lo sumo una vez por arranque.           |
| `graph.resolveAll()` | Construye todo lo enlazado en el orden de la lista; acá se descubre un ciclo.         |
| `graph.ports`        | Los puertos del despliegue (lo usa el helper de pruebas para envolverlos).            |
| `graph.closables`    | Lo construido que sabe cerrarse, en orden de creación; el cierre va en orden inverso. |

Ciclo:

```
Error: Cycle in the composition graph: a -> b -> a.
```

## 7. Reemplazos en pruebas

```ts
await startTestApp({ ports: [replace(DecisionLedgerPort, fakeLedger)] });
const decisions = app.resolve(DecisionLedgerPort);
```

- El reemplazo es por **puerto**, no por nombre: el compilador verifica que el doble corresponda al
  puerto.
- `sharedTestApp` conserva su optimización: el servidor se construye una vez por archivo y cada
  componente que una tecnología provee se envuelve en un proxy que delega en el grafo vigente
  (research R-09).

## 8. Lo que la forma prohíbe

| Prohibido                                                             | Lo reporta                                         |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| Exportar de un módulo de composición algo que no sean sus componentes | regla de forma `composition-module-shape`          |
| Resolver por texto                                                    | no existe la API; `ope/no-magic-strings`           |
| Heredar los componentes de otro módulo                                | revisión + `CONTEXT_MAP` en composición            |
| Importar un módulo que el mapa de contextos no permite                | `npm run arch`                                     |
| Instanciar una implementación de puerto fuera de un enlace            | regla de forma `port-implementations-only-in-bind` |
| Declarar una abstracción de `application/*/ports/` y no enlazarla     | `npm run check:ports-bound`                        |
