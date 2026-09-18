---
es: producto
en: product
contexto: ingesta
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#7
uso: disponible
---

# producto -> `product`

> Merchant ── Product ── Variant ── StockSnapshot

Identificado por `productId` tal como lo expone la plataforma del merchant. La ficha de producto (PDP) es la única superficie de intervención del MVP (03 §4.3).

En el catálogo (ADR-025): nombre, atributos nombre/valor sin normalizar y sus variantes, dentro de la instantánea del merchant.
