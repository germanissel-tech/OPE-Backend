---
es: sin correspondencia
en: unmapped
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#3.1.1
---

# sin correspondencia -> `unmapped`

> El SDK verifica que cada anclaje del perfil efectivamente resuelva, y reporta cuando deja de hacerlo. Sin esto, un rediseño del tema degrada el sistema en silencio. — **DECIDIDO** (`01 §3.1.1`)

Dicho de una etiqueta del catálogo de un merchant que su [correspondencia de
valores](correspondencia-de-valores.md) no traduce a ningún [valor de atributo](valor-de-atributo.md)
del vocabulario de OPE. No es un error del merchant ni del catálogo: los productos que la traen
simplemente no hablan de ese atributo, igual que cuando el dato no está.

La cita es del diagnóstico de anclajes, y es la misma razón: **lo que degrada en silencio hay que
reportarlo**. Por eso OPE conserva por merchant qué etiquetas aparecieron sin correspondencia, desde
cuándo y a cuántos productos afectan, y el operador lo lee
(`GET …/unmapped-attribute-values`). Mapear la etiqueta la saca del reporte sin republicar el
catálogo.
