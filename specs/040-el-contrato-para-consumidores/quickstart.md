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

### 2026-10-09 — tramos 1 y 2 (contrato y servidor)

Lo que difirió del plan, y por qué:

- **La excepción de `ope-no-pii` no vive en el ruleset** (`functionOptions.allow`, como decía el plan)
  sino en el esquema que lleva el dato: `x-personal-datum: { property, reason }` en `Operator.yaml`.
  Spectral recorre el documento resuelto, donde el esquema del operador aparece copiado bajo cada
  operación que lo responde; una lista en el ruleset habría tenido que nombrar cada copia, y la
  marca sobre el esquema viaja con él. La regla la exige con `property` y `reason`, y con que la
  propiedad exista en ese esquema.
- **Los dos tramos van en un solo commit.** Con `getOperator` en el contrato y sin handler, el
  arranque se niega (ADR-013) y `npm test` queda rojo; un commit del contrato solo habría violado
  «no commitear sin que las pruebas pasen».
- **`invalid-operator-display-name` sí entra al catálogo** (`status: 500`, como
  `invalid-operator-scope`): la prueba de réplica exige que todo código de dominio tenga su entrada.
  No sale al contrato: lo ve la configuración al arrancar y lo convierte en `ConfigError` con el
  campo `operators[N].displayName`.
- **El caso de uso vive en `application/access`**, que es el módulo que resuelve el token y sirve
  `adminToken`; no hay módulo `operator` en el mapa de contextos y abrir uno por una operación que no
  tiene regla no se justificaba. Como no puede fallar, `execute` devuelve el `Operator` directo
  (ADR-023), no un `Result`.
- **`check:invariant-tests` exige el campo** (T011): un invariante con `pointer` pasa sólo si alguna
  prueba que lo nombra contiene `/body/<primer segmento>`. Hoy: 28 declarados, 28 con prueba, 4 que
  nombran el campo.
- **Los ejemplos de las `422`** de configuración, niveles, textos y defaults pasaron a `/body/...`
  junto con las aserciones que los afirmaban; `toProblem` publica el prefijo una sola vez.

§2 corrido contra `npm run dev` (el watcher de `tsx` recargó el código solo): `getOperator` →
`200`, `X-Request-Id: req-2`, `{ operatorId: "dev-operator", displayName: "Operador de desarrollo", scope: "*" }`;
token desconocido → `401 operator-unknown` con `requestId` igual al encabezado; `X-Request-Id: pegado`
→ el servidor devuelve el suyo; origen repetido → `422 origin-already-registered` con
`errors: [{ pointer: "/body/origins/1" }]`; gracia excesiva → `422 rotation-grace-too-long` con
`/body/graceSeconds`; y cada `reqId` del registro coincide con el `X-Request-Id` de su respuesta.

Gates: `format:check`, `quality` (8 gates), `typecheck`, `npm test`, `arch`, `contract:check`,
`test:contract` (schemathesis, 0 fallos) en verde. Mutación del diff: 72 mutantes en 9 archivos, uno sobrevivió
—la guarda `res.body === null` antes del spread de `requestId`, que no hacía nada porque un `null` se
esparce a nada— y se borró; re-juzgado el archivo, todo mutante muere.
