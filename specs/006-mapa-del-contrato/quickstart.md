# Quickstart — Feature 006: validar el mapa del contrato y las convenciones

## 1. Todo junto

```bash
npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check
```

Esperado: `check:api-map` informa el conteo por estado (construidas, planeadas) y no reporta
problemas; `check:markers` sólo con `PROPUESTO`/`PROPOSED` (esquemas de portal y admin, HMAC
de plataforma, protocolo de decisión).

## 2. El mapa es la única puerta (US1)

```bash
npm run check:api-map
npx vitest run tests/governance/api-map.test.ts
```

Manual: agregar un path `/v1/things` con `operationId: listThings` a `contracts/openapi.yaml`
(y su archivo en `paths/`) → `npm run contract:check` falla en `check:api-map` nombrando
`listThings`. Cambiar en `contracts/api-map.yaml` el `status` de `getSdkConfig` a `built` →
falla: no existe en el contrato. Cambiar el `tag` de `ingestEvents` en el mapa → falla: difiere
del contrato. Revertir.

## 3. Consumidores, esquemas y capacidades (US2)

```bash
npx vitest run tests/contract-rules
```

Cubre, con fixture por regla: `ingest` protegido con `platformKey` → `ope-consumer-security`;
`system` con seguridad → `ope-consumer-security`; `orders:write` bajo `portal` →
`ope-required-capabilities`; `merchantId` en ruta bajo `portal` → `ope-no-merchant-id-in-request`
(bajo `admin`, pasa; en body bajo `admin`, falla).

Manual: `ls contracts/components/securitySchemes/` muestra los cuatro esquemas; sólo
`ingestKey` está referenciado desde `contracts/openapi.yaml`.

## 4. Idempotencia y paginación (US3, US4)

Mismo comando que el punto 3. Fixtures: `outcomes` sin `x-idempotency`, con `key` que no es
propiedad requerida del body, con `first` = `repeat`, sin `409`; `portal` `GET` de colección
sin `x-collection`, con `page`/`offset` propios, con `200` que no es `<X>Page`. Los fixtures
válidos `valid-outcomes.yaml` y `valid-portal.yaml` muestran la forma correcta.

## 5. Ciclo de vida (US5)

`npx vitest run tests/governance/api-map.test.ts` cubre: `deprecated` en el mapa sin
`deprecated: true` en el contrato (y al revés) → falla; `retired` sin `retiredIn` → falla;
`retired` presente en el contrato → falla; estado fuera del conjunto → falla.

## 6. Documentación publicada

```bash
npm run contract:docs
```

`docs/api/index.html` incluye la sección "Planned surface" con la tabla generada desde el
mapa; `contracts/dist/openapi.yaml` no cambia (`git status` limpio salvo `docs/api/`).

## Estado (histórico, fechado)

| Fecha      | Estado                                                    |
| ---------- | --------------------------------------------------------- |
| 2026-09-17 | Plan aprobado; diseño del mapa y convenciones; sin código |
