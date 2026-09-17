---
numero: 20
titulo: Consumidores de la API — autenticación, capacidades, idempotencia y paginación
estado: propuesta
fecha: 2026-09-17
fuente: specs/006-mapa-del-contrato/research.md
---

# ADR-020 — Consumidores de la API: autenticación, capacidades, idempotencia y paginación

## Contexto

El backend tiene cuatro consumidores con confianza distinta y hasta la 005 sólo uno tenía
esquema de seguridad (la credencial pública del SDK, ADR-014). La primera operación de
plataforma (`notifyOrder`), la primera del portal y la primera de administración necesitan
convenciones que, decididas al llegar cada una, producirían tres mecanismos ad hoc. Lo mismo
con el reintento de notificaciones servidor a servidor (01-arquitectura-mvp.md §9 garantiza
idempotencia de orden con `orderId`) y con la paginación de lecturas.

## Decisión

1. **Consumidores y esquemas** (el tag de una operación fija su consumidor; el consumidor fija
   su esquema; regla `ope-consumer-security`):

   | Consumidor | Tags                 | Esquema                                     | Credencial                                                                  | Identifica                   |
   | ---------- | -------------------- | ------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
   | `public`   | `system`             | ninguno (`security: []`)                    | —                                                                           | —                            |
   | `sdk`      | `ingest`, `decision` | `ingestKey` (header `X-OPE-Ingest-Key`)     | pública, en el tag; ≤ 2 activas                                             | merchant (+ origen, ADR-014) |
   | `platform` | `outcomes`           | `platformKey` (header `X-OPE-Platform-Key`) | **secreta**, servidor a servidor sobre TLS; ≤ 2 activas; nunca en navegador | merchant                     |
   | `portal`   | `portal`             | `portalSession` (bearer, PROPUESTO)         | token de sesión de una persona del merchant                                 | persona + merchant           |
   | `admin`    | `admin`              | `adminToken` (bearer, PROPUESTO)            | token de operador de OPE, emitido fuera de banda, auditado                  | operador                     |

   Ausente o inválida ⇒ `401 unauthorized`. Firma HMAC del cuerpo con ventana temporal para
   `platformKey`: PROPUESTO, se decide con el primer adaptador de plataforma (02 §6).

2. **Capacidades** (`x-required-capabilities`): vocabulario cerrado por consumidor, declarado
   en `consumers.<x>.capabilities` del mapa (ADR-019); una capacidad fuera del vocabulario de
   su consumidor falla el lint.
3. **`merchantId` en ruta sólo bajo `admin`**: la credencial de un operador no pertenece a
   ningún merchant, así que el merchant administrado es un recurso de la ruta. Es la única
   excepción a constitución V y queda acotada por `ope-no-merchant-id-in-request` (en query y
   body sigue prohibido para todos; en ruta, para todo consumidor salvo `admin`).
4. **Idempotencia servidor a servidor** (`x-idempotency`, regla `ope-outcomes-idempotency`):
   la clave es la identidad autoritativa de la plataforma (`orderId` para órdenes y
   devoluciones; identificador de snapshot para catálogo), propiedad requerida del cuerpo.
   Primera recepción → `first` (2xx) con el registro; repetida con el mismo contenido →
   `repeat` (2xx distinto) con el mismo registro; misma clave con contenido distinto → `409
idempotency-conflict`, nunca sobrescritura. La igualdad de contenido se define en la feature
   de outcomes (comparación canónica del cuerpo).
5. **Paginación** (`x-collection`, regla `ope-collection-pagination`): cursor opaco (`cursor`),
   `limit` 1..100 (por defecto 50), ventana `from` (inclusivo) / `to` (exclusivo) en RFC 3339,
   orden por instante descendente, envoltorio `<X>Page = { items, nextCursor? }` sin `total`.
   Parámetros y envoltorio base son componentes reutilizables del contrato.

## Consecuencias

- Toda operación futura nace con su esquema, sus capacidades, su idempotencia (si es
  notificación) y su paginación (si es colección) verificados por lint desde el primer commit.
- Los esquemas de portal y admin quedan propuestos hasta sus features; su forma ya está fijada.
- `idempotency-conflict` entra al catálogo de tipos de problema; ninguna operación construida
  lo emite hasta la feature de outcomes.
