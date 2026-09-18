---
es: instantánea
en: snapshot
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#4
---

# instantánea -> `snapshot`

> **Cómo llega — PROPUESTO:** ingesta periódica del catálogo completo, más refresco de alta frecuencia para stock y precio.

La foto completa del catálogo de un merchant en un instante: `capturedAt`, que declara la
plataforma, y `receivedAt`, que registra OPE. Reemplaza a la anterior sin fusión; una más vieja
que la vigente se rechaza. La frescura de cada dato se mide desde `capturedAt`; la cadencia de
recepciones da el nivel de sincronización observado (perfil de datos).
