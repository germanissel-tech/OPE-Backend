---
es: diagnóstico de anclajes
en: diagnostics
contexto: ingesta
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#3.1.1
uso: pendiente
---

# diagnóstico de anclajes -> `diagnostics`

> El SDK verifica que cada anclaje del perfil efectivamente resuelva, y reporta cuando deja de hacerlo. Sin esto, un rediseño del tema degrada el sistema en silencio. — **DECIDIDO** (`01 §3.1.1`)

Lo que el SDK reporta (`POST /v1/sdk/diagnostics`) cuando un anclaje del mapa del merchant no
resuelve en una página: anclaje y tipo de página, más la versión de configuración que tenía
cargada. Nada de la persona, ni URL, ni producto. OPE conserva por merchant el último instante
y un contador por `(anchor, pageType, version)`, con tope de plataforma (se descarta lo más
viejo), y el operador lo consulta (`GET …/anchor-diagnostics`) para corregir el perfil sin
publicar el SDK ni tocar el sitio.
