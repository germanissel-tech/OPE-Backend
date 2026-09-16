---
es: exposición
en: exposure
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#0.1
---

# exposición -> `exposure`

> **Exposición** — Que una intervención efectivamente se renderizó y fue visible. No es lo mismo que haberla decidido.

La constituye la confirmación del SDK (`POST /v1/exposures`), no la decisión. Estado `EXPOSED` de la cadena de evidencia (01 §5). Una decisión `NO_OP` no puede exponerse.
