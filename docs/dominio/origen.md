---
es: origen
en: origin
contexto: identidad
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#10.7
uso: disponible
---

# origen -> `origin`

> Aislamiento entre merchants

Origen del navegador (`scheme://host[:port]`, header `Origin`) desde el que la tienda del merchant llama al backend. Sólo los orígenes registrados del merchant pasan CORS; el par credencial + origen es el control de acceso (ADR-014).
