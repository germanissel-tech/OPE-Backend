# Quickstart — verificar el merchant con identidad (041)

Cómo se comprueba de punta a punta. Las cifras de estado no van acá: las informan los comandos.

## 1. El contrato cambia, y `contract:diff` dice qué

```sh
npm run contract:check
# lint (las fixtures nuevas de ope-no-pii), bundle, diff contra main: reporta `displayName` required en
# MerchantCreate como incompatible y lo ACEPTA por la marca building (ADR-003), versión 1.13.0;
# api-map con updateMerchantProfile built; invariant-tests con invalid-merchant-profile nombrando /body/displayName.
npm run contract:types && npm run contract:types:check
# generated/contract/ trae MerchantContact y MerchantProfileInput en CONSTRAINTS y updateMerchantProfile en OPERATIONS.
```

## 2. El servidor hace lo que el contrato dice

```sh
npm run dev
TOKEN=ope_dev_admin_token
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/admin/merchants/dev-merchant
# { ..., "displayName": "Tienda de desarrollo", "storeUrl": "http://localhost:3000" }   (de la semilla)
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"origins":["https://norte.example"],"signature":false,"displayName":"Tienda Norte","storeUrl":"https://www.norte.example"}' \
  http://localhost:3000/v1/admin/merchants
# 201 · merchant.displayName y merchant.storeUrl tal cual
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"origins":["https://sur.example"],"signature":false}' http://localhost:3000/v1/admin/merchants
# 400 · errors: [{ pointer: "/body", message: "... displayName ..." }]   (required, del validador)
curl -si -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"displayName":"Tienda Norte SA","contact":{"name":"Ana","email":"ana@norte.example","role":"e-commerce"},"notes":"piloto"}' \
  http://localhost:3000/v1/admin/merchants/<id>/profile
# 200 · el merchant con contact y notes, sin storeUrl (ausente es vacío)
curl -si -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"displayName":" Tienda "}' http://localhost:3000/v1/admin/merchants/<id>/profile
# 422 invalid-merchant-profile · errors: [{ pointer: "/body/displayName" }]
curl -si -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"displayName":"X","storeUrl":"https://"}' http://localhost:3000/v1/admin/merchants/<id>/profile
# 422 invalid-merchant-profile · errors: [{ pointer: "/body/storeUrl" }]
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/v1/admin/merchants/<id>/log"
# la entrada updateMerchantProfile con operador y merchant, sin "Ana" ni el email en ninguna parte
```

Con un operador de alcance acotado (`config/dev-operators.json` admite uno con `scope: ["otro"]`):
`PUT .../merchants/<id>/profile` → `403 merchant-out-of-scope`, el mismo cuerpo que para un
identificador inexistente. Y en el registro del servidor (la consola de `npm run dev`), ninguna línea
de esos pedidos lleva el nombre, el email ni el teléfono del contacto.

Reiniciar `npm run dev` y volver a leer `<id>`: la identidad sigue ahí (el documento del almacén la
guarda; R-01).

## 3. El lint protege lo que VII protege

```sh
npm run contract:lint
# pasa: name, email y phone sólo en MerchantContact, con su razón; displayName en los tres esquemas del merchant y en Operator.
npm test -- tests/contract-rules
# las fixtures: email en Order falla; una lista con una entrada sin razón falla; dos excusadas en el contacto pasan.
```

## 4. El consumidor copia tal cual

En OPE-Web, contra este backend:

```sh
npm run contract:sync && npx ope-check
# copia los ocho archivos sin emitir nada; conformity pasa con MerchantContact y MerchantProfileInput entre los esquemas de pedido.
```

Listar por nombre y mostrar la ficha completa es la feature siguiente de OPE-Web, no ésta.

## 5. Romper una garantía y ver quién lo atrapa

| se rompe                                                                               | lo atrapa                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `email` en un esquema de orden o de evento                                             | `ope-no-pii` (fixture `contact-elsewhere`)                                        |
| una entrada de `x-personal-datum` sin razón                                            | `ope-no-pii` (fixture `list-without-reason`)                                      |
| `updateMerchantProfile` sin `[invariant:invalid-merchant-profile]` nombrando `/body/…` | `check:invariant-tests`                                                           |
| un lector de auditoría que meta el contacto en `result`                                | el esquema `AdminResult` (`additionalProperties: false`) y la prueba del registro |
| `withProfile` que mire el estado y rechace un desactivado                              | la prueba de dominio y la de integración (historia 2, escenario 6)                |
| un documento viejo sin `profile` que no rehidrate                                      | `tests/durability/merchant-store.test.ts`                                         |

## 6. El cierre

```sh
npm run release-check && npm run contract:check && npm run test:all
```

## Lo corrido

_(se completa al implementar, con fecha)_
