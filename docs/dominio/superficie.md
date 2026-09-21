---
es: superficie
en: surface
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#14.2
uso: disponible
---

# superficie -> `surface`

> Superficies habilitadas: dónde puede intervenir OPE.

Un tipo de página donde OPE puede intervenir: la de **producto** o el **carrito**
(`Surface`: `product`, `cart`). Es un default de tratamiento que el merchant sobrescribe en
su configuración; el SDK la recibe para saber qué instrumentar (feature 017).
