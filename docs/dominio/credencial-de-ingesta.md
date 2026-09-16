---
es: credencial de ingesta
en: ingest-key
contexto: identidad
estado: aprobado
fuente: constitucion#V
uso: disponible
---

# credencial de ingesta -> `ingest-key`

> `merchantId` MUST derivarse siempre de la credencial autenticada. MUST NOT tomarse del body, la query ni el path.

Clave **pública** por merchant que viaja en el tag (`X-OPE-Ingest-Key`): identifica al merchant, no autentica al visitante. Hasta dos activas para rotar. Distinta de las credenciales del portal. Se usa como header, no como sustantivo del contrato.
