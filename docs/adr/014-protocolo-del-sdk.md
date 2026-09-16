---
numero: 14
titulo: Protocolo del SDK — credencial pública, orígenes, decisión inline y esquema de eventos
estado: aceptada
fecha: 2026-09-16
fuente: specs/004-protocolo-sdk-ingesta/research.md
---

# ADR-014 — Protocolo del SDK

## Contexto

El SDK corre en el navegador del visitante, dentro de la tienda del merchant
(02-integracion-ecommerce.md §3). Todo lo que lleva es público; no hay secreto posible del lado
del cliente. El backend tiene que identificar al merchant, rechazar lo que no es su tienda,
validar una lista blanca cerrada de señales (03-alcance-mvp.md §4.1) y responder siempre una
decisión (constitución II), todo sin datos personales (01-arquitectura-mvp.md §10.2).

## Decisión

1. **Credencial de ingesta pública** (`X-OPE-Ingest-Key`, `securitySchemes.ingestKey`,
   `apiKey` en header): identifica al merchant, no autentica al visitante. Hasta dos claves
   activas por merchant para rotar. Distinta de las credenciales del portal. `merchantId` se
   deriva de ella y nunca viaja en el request (constitución V). El security handler de
   openapi-backend la resuelve antes del handler; ausente o desconocida → `401`.
2. **El par credencial + origen registrado es el control**: el preflight CORS (que no trae la
   credencial) acepta cualquier origen registrado por algún merchant; el request real exige que
   el `Origin`, si viene, pertenezca al merchant de la credencial → `403 origin-not-allowed`.
   Requests sin `Origin` (servidor a servidor, pruebas) se procesan con normalidad.
3. **Decisión inline por lote** (PROPUESTO hasta que el equipo del SDK lo valide): la respuesta
   de `POST /v1/events` trae `decision` `{ decisionId, sessionId, outcome, reason, intervention? }`.
   `reason` es un **string** con patrón y catálogo en `contracts/no-op-reasons.yaml`, no un
   enum: agregar un motivo no es cambio incompatible (ADR-003). `intervention` es el lugar
   reservado para el plano de decisión.
4. **La exposición la confirma el SDK** (`POST /v1/exposures`): sólo entonces hay `EXPOSED`
   en la cadena de evidencia (01 §5). Decisión inexistente y decisión de otro merchant reciben
   la misma respuesta (`exposure-decision-unknown`): no se revela existencia.
5. **Esquema de eventos**: `Event` es `oneOf` de un esquema por tipo con
   `discriminator { propertyName: type, mapping }` explícito y `type: { enum: [valor] }` en cada
   rama (sin `const`: openapi-backend valida contra el meta-esquema 3.0). El `mapping` es
   necesario para que openapi-typescript genere el valor de cable y no el nombre del esquema;
   Ajv lo rechaza, así que el adaptador HTTP lo quita del documento en memoria antes de
   compilar los validadores (`stripDiscriminatorMappings`). Es la única transformación que se
   hace al contrato en runtime y tiene prueba propia.
6. **Importes como string decimal** (`^\d+(\.\d{1,2})?$` + moneda ISO 4217): sin redondeo
   binario; misma convención para los montos verificados de outcomes.
7. **Excepción a "sin `components` en la raíz"**: `security` referencia esquemas por nombre,
   así que `openapi.yaml` declara únicamente `components.securitySchemes` (con `$ref` a su
   archivo). Todo lo demás sigue promoviéndose por el bundle.

## Consecuencias

- Un merchant no puede impedir que otro copie su clave, pero sí que la use: sin su origen
  registrado no pasa. Es el nivel de garantía que admite un tag en el navegador.
- La deduplicación por `eventId` por merchant hace idempotentes reintentos y replays; no es un
  error, es un resultado (`duplicate`).
- Regla para todo el contrato: sólo el subconjunto de JSON Schema que OpenAPI 3.0 admite.
- El protocolo de decisión inline queda marcado `PROPUESTO` en el contrato hasta la validación
  con el SDK; `release-check` no lo bloquea.
