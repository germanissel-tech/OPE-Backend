---
es: firma de plataforma
en: platform signature
contexto: plataforma
estado: aprobado
fuente: docs/adr/029-firma-de-plataforma.md
uso: disponible
---

# firma de plataforma -> `platform signature`

> Con secreto configurado, toda operación con `platformKey` (catálogo, órdenes, devoluciones) exige firma; sin secreto, sólo la clave.

`X-OPE-Timestamp` (segundos Unix) y `X-OPE-Signature` (`v1=` + hex de HMAC-SHA256 con un
secreto del merchant sobre `<timestamp>.<cuerpo crudo>`), verificados por el security handler
de la credencial de plataforma antes de leer el cuerpo, con ventana de ±5 minutos y hasta dos
secretos activos (rotación). Falta (`signature-missing`), no coincide (`signature-invalid`) o
está fuera de ventana (`signature-expired`) ⇒ `401`, y nada se registra. La firma cubre los
bytes exactos que la plataforma envió; los secretos viven en `OPE_MERCHANTS[i].platformSecrets`
y nunca salen en logs ni respuestas.
