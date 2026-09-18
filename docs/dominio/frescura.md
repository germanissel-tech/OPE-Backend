---
es: frescura
en: freshness
contexto: plataforma
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#8
uso: disponible
---

# frescura -> `freshness`

> **El presupuesto de frescura se fija por merchant (§14.1), no de forma única para el sistema.**

Edad de un dato respecto de `capturedAt` de la instantánea, juzgada por clase: catálogo y
variantes en el orden de un día (36 h); disponibilidad y precio en el orden de minutos (15 min).
Más viejo que su presupuesto, el dato no sostiene claims: fail-closed. Los presupuestos son
políticas de aplicación publicadas en el contrato; pasan a configuración por merchant (014).
