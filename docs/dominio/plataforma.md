---
es: plataforma del merchant
en: platform
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#6
uso: pendiente
---

# plataforma del merchant -> `platform`

> Los conectores viven del lado de OPE, no en la plataforma del merchant. — **DECIDIDO** (`02 §6`)

El ecommerce del merchant (Magento 2, VTEX o uno propio; Zona C), del que OPE recibe catálogo,
stock y precio, órdenes y devoluciones por la estrategia de sincronización negociada, y que
autentica servidor a servidor con la clave de plataforma y el secreto de firma. En el contrato
nombra esas credenciales (`platform-keys`, `platform-secrets`) y el esquema `platformKey`.
