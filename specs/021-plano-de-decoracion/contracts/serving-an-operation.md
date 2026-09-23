# Contrato — cómo un módulo declara lo que sirve

Lo que un módulo de composición puede escribir y lo que tiene que respetar, después de esta feature.
Extiende el contrato del grafo de la 020 (`specs/020-grafo-de-composicion/contracts/composition-graph.md`),
que sigue vigente en todo lo demás.

## 1. Servir una operación

```ts
serves: {
  handlers: {
    getMerchant: served(
      { scoped: ScopedMerchantPort, clock: ClockPort },
      { name: "getMerchant", build: ({ scoped }) => new GetMerchantUseCase({ scoped }) },
      (useCase, { clock }) => makeGetMerchant(useCase, clock),
    ),
  },
}
```

- La **clave es el `operationId`** y el compilador la verifica contra el tipo generado del contrato
  (igual que hoy).
- El primer argumento es lo que el handler necesita del grafo, **por nombre** (igual que hoy).
- El segundo declara el **caso de uso**: el nombre con que se registra en el log y cómo se
  construye a partir de lo que pidió.
- El tercero declara el **controller**, que recibe el caso de uso **ya envuelto**.
- **No hay ningún lugar donde elegir** entre registrar y auditar.

### El nombre del log es el del caso de uso

```ts
ingestEvents: served(
  { … },
  { name: "ingestBatch", build: (d) => new IngestBatchUseCase(d) },   // ← no es el operationId
  (useCase) => makeIngestEvents(useCase),
),
```

Se declara **siempre**, no sólo cuando difiere. En 27 de 29 coincide con el `operationId`, pero
esconderlas detrás de un default obliga al lector a saber la convención para entender las dos que
no coinciden (`ingestEvents` → `ingestBatch`, `getHealth` → `getServiceHealth`).

### Un caso de uso que el grafo ya resolvió

Las tres rotaciones comparten un caso de uso y cada una lo audita bajo su propio nombre:

```ts
rotateIngestKey: served(
  { rotate: RotateCredentialPort },
  { name: "rotateCredential", build: ({ rotate }) => rotate },
  (useCase) => makeRotateIngestKey(useCase),
),
```

La misma forma cubre construirlo y recibirlo: es una función de lo que el handler pidió.

## 2. Lo que la auditoría lee de una operación

Cinco de las diez operaciones auditadas necesitan datos que sólo ellas conocen:

```ts
createMerchant: served(
  { … },
  { name: "createMerchant", build: (d) => new CreateMerchantUseCase(d) },
  (useCase, { clock }) => makeCreateMerchant(useCase, clock),
  { merchantId: (r) => (r.ok ? r.value.merchant.merchantId : undefined) },
),
```

- Es el cuarto argumento, y es **opcional**.
- **No** es el marcador de que la operación se audita: eso lo dice el contrato. Las otras cinco
  auditadas no lo escriben.
- Declararlo en una operación que no se audita **no compila**: sería un dato que nadie va a leer.

## 3. Lo que el compilador rechaza

Una operación que el contrato manda auditar, servida por un caso de uso cuyo request no lleva
operador:

```
TS2345: … is not assignable to parameter of type '… & CannotAudit<"setKillSwitch">'
```

Es la única forma de equivocarse que queda en pie: la elección ya no se toma a mano, así que no hay
nada que olvidar; lo que la plataforma no puede verificar sola es que el caso de uso que se le dio
sirva para auditar.

Lo demás sigue igual que en la 020: un `operationId` que el contrato no declara, una operación sin
handler (`Unwired<…>`) y un componente sin proveedor (`Missing<…>`).

## 4. Lo que ya no se escribe

| Antes                                                           | Ahora                              |
| --------------------------------------------------------------- | ---------------------------------- |
| `deco: DecoratorsPort` en las dependencias de los 29 handlers   | no existe                          |
| `deco.logged(operation, …)` / `deco.administered(operation, …)` | no existe: lo aplica la plataforma |
| el `operationId` escrito como string además de ser la clave     | sólo la clave                      |

## 5. La semilla del arranque

Los tres casos de uso que se auditan sin loguearse **no** pasan por acá: no son operaciones del
contrato. Se siguen declarando donde se declaran hoy —en el enlace de su puerto— y con el nombre de
la acción del sistema.

## 6. Cuándo se verifica el registro

Toda acción administrativa pregunta al registro si acepta escrituras **antes** de ejecutarse:

|           |                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------- |
| acepta    | la acción se ejecuta y queda registrada, como hoy                                                 |
| no acepta | la acción **no se ejecuta**; la operación responde `503` con el problema de almacén no disponible |

Fallar después de actuar le diría al operador que no pasó algo que sí pasó. Queda abierta la
ventana en que el registro se cae **durante** la acción; se cierra con la transacción del hito de
persistencia.

## 7. Lo que la forma prohíbe

| Prohibido                                                                     | Lo reporta                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Elegir entre registrar y auditar                                              | no existe la API                                   |
| Dar el caso de uso sin envolver al controller                                 | no existe la API: el controller lo recibe envuelto |
| Servir una escritura administrativa con un caso de uso que no puede auditarse | `typecheck`                                        |
| Declarar lecturas de auditoría en una operación que no se audita              | `typecheck`                                        |
| Editar el vocabulario generado de operaciones auditadas                       | `contract:types:check`                             |
| Exportar de un módulo de composición algo que no sean sus componentes         | regla de forma `composition-module-shape` (020)    |
