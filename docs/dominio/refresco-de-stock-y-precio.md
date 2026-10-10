---
es: refresco de stock y precio
en: refresh
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#6
uso: pendiente
---

# refresco de stock y precio -> `refresh`

> Lo común a los tres: refresco parcial de stock y precio con instante por ítem. — **DECIDIDO** (`02 §6`)

El stock y el precio de algunas variantes, cada una con el instante de su dato, sin reenviar el catálogo. Entra
por `push` o lo trae el planificador por lotes. La verdad de una variante es el dato más nuevo entre la foto y su
refresco, y su frescura se mide con ese instante (ADR-047). Cuando la plataforma no da el instante, es el de la
observación de OPE.

No es una foto: no reemplaza el catálogo, no agrega variantes y no tiene clave de idempotencia por pedido.
