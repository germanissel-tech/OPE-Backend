# Quickstart — verificar el contrato para consumidores (040)

Cómo se comprueba de punta a punta. Las cifras de estado no van acá: las informan los comandos.

## 1. El contrato cambia de forma compatible

```sh
npm run contract:check
# lint (las tres reglas con sus fixtures nuevas), bundle, diff contra main: «No incompatible changes»
# con la versión en 1.12.0; api-map con getOperator built; invariant-tests con los punteros nombrados.
npm run contract:types && npm run contract:types:check
# deja generated/contract/ y confirma que lo commiteado es lo que el generador produce.
```

## 2. El servidor hace lo que el contrato dice

```sh
npm run dev
TOKEN=ope_dev_admin_token
curl -si -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/admin/operator
# 200 · X-Request-Id: req-N · { "operatorId": "dev-operator", "displayName": "Operador de desarrollo", "scope": "*" }
curl -si -H "Authorization: Bearer nope" http://localhost:3000/v1/admin/operator
# 401 · X-Request-Id · { ..., "requestId": "req-N" }
curl -si -H "Authorization: Bearer $TOKEN" -H "X-Request-Id: pegado" http://localhost:3000/v1/admin/operator
# X-Request-Id ≠ pegado: el identificador es del servidor.
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"origins":["https://nueva.example","https://tienda.example"],"signature":false}' \
  http://localhost:3000/v1/admin/merchants
# 422 origin-already-registered · errors: [{ pointer: "/body/origins/1", message }]
#   (si https://tienda.example no existe en tu almacén, crealo antes)
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"graceSeconds":999999999}' http://localhost:3000/v1/admin/merchants/<id>/ingest-keys
# 422 rotation-grace-too-long · errors: [{ pointer: "/body/graceSeconds", message }]
```

Y en el registro del servidor (`npm run dev` lo escribe a la consola), cada línea de esos pedidos lleva
`reqId` igual al `X-Request-Id` devuelto.

## 3. El consumidor copia tal cual

```sh
# en ope/mvp/web, con el backend al lado en ../backend
npm run contract:sync
# «copiado generated/contract/…» para los ocho archivos; nada «emitido».
npx ope-check
# conformity: identidad y módulo coinciden; todas las operaciones admin; esquemas de pedido; en verde.
```

`contracts/ope/README.md` de OPE-Web dice «copiado de `generated/contract/` del backend (feature
040)» en las dos filas. Si `conformity` falla por `getOperator` sin capacidad, es la línea de OPE-Web
que el plan anuncia (R-04): se arregla allá y se vuelve a correr.

## 4. La consola lo muestra sin tocarla

Con la consola levantada (`npm run dev` en OPE-Web) y entrando con `?dev.bearer=1`:

- La barra dice «Operador de desarrollo · Todos los merchants» en vez de `operator` (cuando OPE-Web
  reemplace la sonda por `getOperator`; hasta entonces, sigue diciendo `operator` y el dato ya está).
- Un alta con un origen repetido en el segundo renglón marca **ese** renglón.
- Una rotación con gracia excesiva marca el campo.
- Todo aviso de error muestra `Identificador del pedido: req-N`.

## 5. Romper una garantía y ver quién lo atrapa

| qué se rompe                                     | cómo                                             | quién lo dice                                                              |
| ------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------- |
| una operación `admin` sin capacidad y sin marca  | quitar `x-identifies-principal` de `getOperator` | `contract:lint`, `ope-required-capabilities`                               |
| `displayName` en otro esquema                    | agregarlo a `MerchantCreate.yaml`                | `contract:lint`, `ope-no-pii`                                              |
| `pointer` en un invariante de operación          | agregarlo a uno de `admin-experiments.yaml`      | `contract:lint`, `ope-invariants`                                          |
| la prueba del invariante no nombra el puntero    | borrar `/body/origins/` de la prueba             | `check:invariant-tests`                                                    |
| `generated/contract/` viejo                      | tocar una capacidad en `capabilities.js`         | `contract:types:check`                                                     |
| el puntero sin `/body`                           | quitar el prefijo en `toProblem`                 | la prueba del invariante, y la conformidad de OPE-Web no (es del servidor) |
| un `requestId` que no coincide con el encabezado | devolver otro valor en `send()`                  | la prueba de integración de Problem Details                                |
| un mutante en lo nuevo de `src/`                 | `npm run test:mutation`                          | el gate de mutación (ADR-016)                                              |

Dejar todo como estaba después de cada una.

## 6. El cierre

`npm run format:check && npm run quality && npm run typecheck && npm test`, y antes de cerrar
`npm run contract:check`, `npm run test:durability`, `npm run test:mutation`, `npm run test:contract`
y `npm run release-check` (la constitución en 1.5.0 y sin `ABIERTO`).

## Lo corrido

_(se completa al implementar, con fecha)_
