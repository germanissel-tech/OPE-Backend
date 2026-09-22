# Contrato — la API del grafo de composición

Lo que un módulo de composición puede usar y lo que tiene que respetar. Las firmas de acá se
compilaron en el spike de la fase 0 (research R-04) con el compilador del repositorio; los mensajes
de error citados son los que emitió.

## 1. Declarar un puerto

```ts
export const MerchantStorePort = port("merchant.store")<MerchantStore>();
```

- La forma es currificada para que la etiqueta se infiera como literal y el tipo servido se dé
  explícito.
- La etiqueta lleva el prefijo del módulo dueño y **no se repite en ningún otro lugar**: no es un
  identificador de resolución, es lo que el compilador y el arranque imprimen.
- El módulo dueño exporta la constante; quien la necesita la importa. **No hay `get("nombre")`.**

## 2. Enlazar

```ts
bind(Puerto, [Dep1, Dep2], (d1, d2) => valor);
```

- Los tipos de `d1`, `d2` salen de `Dep1`, `Dep2`. Un orden cambiado no compila.
- El builder es el **único** lugar donde puede instanciarse un adaptador o escribirse un objeto que
  haga de implementación de puerto (regla de forma, ver `ports-bound-gate.md` § 2).

```ts
derive(Vista, Fuente);
```

- Declara "una instancia, dos vistas". `Fuente` tiene que satisfacer `Vista`:

  ```
  TS2379: Argument of type 'Port<Clock, "clock">' is not assignable to parameter of type
  'Port<Directory, "clock">' … Property 'get' is missing in type 'Clock'
  ```

## 3. Una tabla por tecnología

```ts
const MERCHANT_PORTS = [MerchantStorePort, MerchantDirectoryPort, CredentialMinterPort] as const;

export const merchant = compositionModule({
  ports: MERCHANT_PORTS,
  technologies: {
    memory: technology(MERCHANT_PORTS, [
      bind(MerchantStorePort, [], () => memoryMerchantStore()),
      derive(MerchantDirectoryPort, MerchantStorePort),
      bind(CredentialMinterPort, [], () => nodeCredentialMinter),
    ]),
  },
  exposes: [bind(ScopedMerchantsPort, [MerchantStorePort], (m) => new DefaultScopedMerchantService({ merchants: m }))],
  serves: { … },
});
```

Si la tabla no sirve alguno de los puertos declarados:

```
TS2345: … is not assignable to parameter of type '… & Unserved<"merchant.directory">'
```

## 4. Servir operaciones

```ts
serves: operations({
  getMerchant: handler([ScopedMerchantsPort], (op, scoped) =>
    makeGetMerchant(op.logged(new GetMerchantUseCase({ scoped })))),
  createMerchant: handler([MerchantStorePort, CredentialMinterPort, ClockPort], (op, merchants, minter, clock) =>
    makeCreateMerchant(op.admin(new CreateMerchantUseCase({ merchants, minter, clock }), {
      merchantId: (r) => (r.ok ? r.value.merchant.merchantId : undefined),
    }))),
}),
```

- La **clave es el `operationId`** y el compilador la verifica contra el tipo generado del contrato.
- `op` lleva el nombre de la operación ya atado: `op.logged(useCase)` y `op.admin(useCase, readers?)`
  reemplazan los 21 literales de hoy (`logged("getMerchant", …)`) y el `auditedWiring(ports)` que
  cada módulo repetía (FR-022).
- Un módulo que no sirve nada **omite la clave**.

También por acá van los esquemas de seguridad y la política de CORS:

```ts
serves: { security: { … }, cors: … }
```

Dos módulos que reclaman la misma operación, el mismo esquema o la política de CORS siguen siendo un
error de cableado que falla al arrancar, como hoy.

## 5. Componer el despliegue

```ts
export const localDeployment = deployment([
  kernel.with("system"),
  merchant.with("memory"),
  access.with("platform"),
  ledger.with("memory"),
  …
]);
```

- `with` toma una clave de las `technologies` **del propio módulo**: un nombre inexistente no
  compila.
- La lista **no tiene orden significativo**.
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
| `graph.resolve(P)`   | El valor del puerto, tipado. Construido a lo sumo una vez por arranque.               |
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
  puerto se envuelve en un proxy que delega en el grafo vigente (research R-09).

## 8. Lo que la forma prohíbe

| Prohibido                                                             | Lo reporta                                         |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| Exportar de un módulo de composición algo que no sean sus tres partes | regla de forma `composition-module-shape`          |
| Resolver por texto                                                    | no existe la API; `ope/no-magic-strings`           |
| Heredar los puertos de otro módulo                                    | revisión + `CONTEXT_MAP` en composición            |
| Importar un módulo que el mapa de contextos no permite                | `npm run arch`                                     |
| Instanciar una implementación de puerto fuera de un `bind`            | regla de forma `port-implementations-only-in-bind` |
| Declarar una abstracción de `application/*/ports/` y no enlazarla     | `npm run check:ports-bound`                        |
