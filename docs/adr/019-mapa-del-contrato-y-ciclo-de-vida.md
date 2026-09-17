---
numero: 19
titulo: Mapa del contrato y ciclo de vida de una operación
estado: aceptada
fecha: 2026-09-17
fuente: specs/006-mapa-del-contrato/research.md
---

# ADR-019 — Mapa del contrato y ciclo de vida de una operación

## Contexto

Hasta la 005 el contrato (`contracts/openapi.yaml`) declaraba sólo las operaciones construidas,
y "contract-first" significaba diseñar cada operación un paso antes de su código. Los
documentos del MVP implican una superficie mucho mayor (SDK, plataforma del merchant, portal,
administración) cuyas convenciones nadie había decidido. Declarar las operaciones planeadas
dentro de `openapi.yaml` engaña a todas las herramientas que lo consumen: el servidor las
serviría con `501`, los tipos generados las incluirían, Schemathesis las probaría y oasdiff
contaría quitar una como cambio incompatible (research R-01).

## Decisión

1. **`contracts/api-map.yaml` es el mapa del contrato**: una entrada por operación que el
   backend expone o va a exponer, con `operationId`, método, ruta, consumidor, tag, capacidades,
   feature que la construye, estado y fuente en los documentos del MVP. `openapi.yaml` describe
   lo que existe; el mapa, lo que existe y lo que va a existir. **Nada entra al contrato sin
   estar antes en el mapa.**
2. **`check:api-map`** (dentro de `contract:check`) compara mapa y contrato en los dos sentidos
   y campo por campo para las construidas: una operación en el contrato sin entrada, una entrada
   `built` sin operación, o una diferencia de método, ruta, tag, seguridad o capacidades, falla
   el build. Las planeadas se validan contra consumidores, roadmap y fuentes.
3. **Ciclo de vida** con estados cerrados: `planned` (sólo en el mapa) → `built` (en el
   contrato) → `deprecated` (`deprecated: true` en la operación; sigue sirviéndose; la
   descripción anuncia el retiro) → `retired` (fuera del contrato; sube la versión mayor,
   ADR-003; el mapa conserva la entrada con `retiredIn`). Renombrar una `planned` es editar
   el mapa; renombrar una `built` es retirar y crear.
4. **Los componentes propuestos viven como archivos sin referencia**: esquemas de seguridad,
   parámetros y envoltorios que ninguna operación construida usa existen en `components/` y el
   mapa los verifica, pero la raíz no los referencia (Redocly rechaza componentes sin uso, y
   con razón). Pasar la primera operación de un consumidor a `built` incluye referenciar su
   esquema desde la raíz.
5. **La documentación publicada muestra la superficie planeada** generada desde el mapa al
   construirla (`contract:docs`), separada de la construida y sin tocar el contrato.

## Consecuencias

- API-first deja de ser una intención: el mapa es la única puerta y el chequeo la cuida.
- El paso 0 del flujo HTTP en `CLAUDE.md` es "la operación existe en el mapa como `planned`".
- Un integrador ve, en un solo documento, qué existe hoy, qué viene y con qué feature.
- El roadmap (`features:` del mapa) queda versionado con el contrato y se verifica.
