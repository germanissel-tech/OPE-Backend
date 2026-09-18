---
es: catálogo
en: catalog
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#4
---

# catálogo -> `catalog`

> **Lo que necesitamos:** la verdad a nivel de la variante exacta, no del producto. Talle + color + stock real + precio vigente.

Productos, atributos y variantes del merchant tal como los expone su plataforma (Zona C). OPE lo
recibe como una instantánea completa por `PUT /v1/catalog` (adaptador genérico, 02 §6.2) y lo
sirve desde caché caliente: nunca consulta a la plataforma en el camino crítico (01 §4.6). Es la
fuente de verdad de producto del plano de decisión (ADR-025).
