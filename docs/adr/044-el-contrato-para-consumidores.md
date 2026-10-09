---
numero: 044
titulo: El contrato para consumidores — artefactos emitidos, identificador de pedido y punteros bajo /body
estado: propuesta
fecha: 2026-10-09
fuente: specs/040-el-contrato-para-consumidores/research.md; lo pedido por OPE-Web en specs/005-la-base-de-ope/plan.md y specs/006-el-merchant-completo/plan.md de ese repositorio
---

# ADR-044 — El contrato para consumidores

## Contexto

El contrato es la única fuente de verdad de la superficie HTTP (constitución, Contrato de datos e
identidad), y hasta la feature 040 el único consumidor que lo leía era el propio servidor: `generated/`
contiene lo que **el servidor** necesita (tipos, catálogo de problemas, operaciones auditadas, esquemas
de configuración). El primer consumidor externo, OPE-Console, se construyó contra ese contrato y
necesitó tres cosas que el backend no daba: un módulo que diga qué exige cada operación (TAN-7 de
Tandilia como referencia), las restricciones de cada cuerpo de pedido para validar localmente, y la
identidad del contrato del que todo eso salió. Las emitió por su cuenta, leyendo el bundle, con un
sincronizador escrito como muleta y con fecha de vencimiento: esta feature.

Además, dos cosas que el servidor ya tenía no llegaban al consumidor: el identificador que acuña por
pedido y escribe en sus registros, y el campo que un rechazo de invariante de esquema señala (el borde
ya lo publicaba para algunos errores, pero sin el prefijo `/body` que el esquema `ProblemDetails`
declara, y no para los dos que el panel más necesita).

## Decisión

1. **`generated/contract/` es lo que un consumidor copia tal cual.** `contract:types` emite, además
   de lo del servidor, una carpeta para consumidores: el bundle, los tipos, el catálogo de problemas,
   el módulo de capacidades (`capabilities.{js,d.ts}`: operación → capacidades e idempotencia;
   vocabulario del consumidor como unión ordenada), las restricciones de cada cuerpo de pedido
   (`constraints.{js,d.ts}`: la capa 1 de validación) y la identidad (`identity.json`: versión y
   `sha256` del bundle). **La forma la publica el consumidor**: es la de `contract-artifact.md` y
   `constraints-artifact.md` de OPE-Web, reproducida en la feature 040. Un consumidor que necesite
   otra cosa la pide; no la emite por su cuenta. Lo emitido es **determinista**: no lleva el commit
   (lo agrega quien copia, leyendo `git`), porque un generado que cambia con `HEAD` no se puede
   verificar contra lo commiteado.
2. **Toda respuesta lleva `X-Request-Id`, y todo Problem Details lleva `requestId`**, con el
   identificador que el servidor acuña y escribe como `reqId` en sus registros. Es el mismo valor en
   los tres lugares, y **es del servidor**: un `X-Request-Id` que venga en el pedido no se adopta,
   para que un valor pegado no se confunda con uno acuñado. Lo pone el transporte, no cada controller.
3. **Un invariante de esquema que señala un campo lo dice**, con `pointer` en su declaración
   (`origins[N]`, `graceSeconds`), y el servidor responde `errors[]` con ese campo como JSON Pointer
   **relativo al pedido** (`/body/origins/1`), que es lo que `ProblemDetails` siempre declaró. El
   campo lo conoce el error de dominio (`details.pointer`); el borde lo traduce y prefija; nada se
   adivina a partir del slug. Un invariante que no señala un campo —los de operación, y los de
   esquema sobre el cuerpo entero— sigue sin `errors[]`. La prueba de cada invariante con `pointer`
   nombra el puntero publicado, y `check:invariant-tests` lo exige.
4. **Identificarse no exige capacidad.** `getOperator` devuelve el operador del principal
   autenticado —`operatorId`, `displayName` si lo tiene, `scope`— y lo puede pedir cualquier
   credencial válida: declara `x-identifies-principal: true` y una lista vacía de capacidades, y la
   regla del contrato que exige capacidades admite **sólo** esa combinación. En el módulo de
   capacidades figura con `[]`; quien quiera distinguirla de una operación olvidada lee la marca en
   el bundle, que tiene al lado.
5. **El operador tiene nombre para mostrar.** `displayName` es opcional en la configuración de
   operadores y se sirve sólo a él, por `getOperator`. La constitución VII se acota a las personas
   observadas (1.5.0): el operador es una persona identificada, autenticada y auditada por su
   identificador, no por el nombre, que no entra en ningún registro. La lista de datos personales
   del contrato **gana** `displayName`, y el lint lleva una sola excepción, con nombre y razón, para
   el esquema del operador bajo `admin`.

## Consecuencias

- OPE-Web saca sus tres muletas —la sonda de identidad, el emisor de capacidades y el de
  restricciones— y su sincronizador copia en vez de emitir. Su comprobación de conformidad es el
  oráculo de lo emitido, y el backend la replica en una prueba de gobernanza propia para no
  depender del otro repositorio en CI.
- Las respuestas `422` de invariantes de configuración y textos que ya llevaban puntero cambian de
  `/declared/...` a `/body/declared/...`. Es compatible: el contrato ya decía `/body`; el servidor no
  cumplía.
- El contrato pasa a `1.12.0` (cambio menor). Dos extensiones nuevas en `contracts/README.md`:
  `x-identifies-principal` y el campo `pointer` de `x-invariants`.
- Un segundo consumidor (`portal`, `sdk`) toma la misma carpeta; el emisor se escribió para `admin`
  sin cerrarse a él, y parametrizarlo es una tarea de ese consumidor.
- Lo que esta decisión **no** da, por decisión ya tomada en OPE-Web: CORS para `admin`, telemetría,
  testigo de concurrencia, capacidades por operador.
