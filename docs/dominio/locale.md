---
es: idioma de la página
en: locale
contexto: ingesta
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#3.1.1
uso: disponible
---

# idioma de la página -> `locale`

> `PageContext` es lo que el adaptador del SDK produce sobre la página: tipo, producto, variante, precio, disponibilidad — y el idioma en que está escrita. — **DECIDIDO** (2026-09-20, evaluación de los documentos base, decisión 9)

Etiqueta BCP 47 (`es-AR`, `en`, `pt-BR`) que el SDK lee de la página (`<html lang>`, la
vista de tienda de la plataforma) y viaja en el contexto de página de cada evento; se valida
por forma, no contra una lista. Es contexto de la interacción, no un dato de la persona (01
§10.2). Se registra en cada decisión del ledger para que el catálogo de mensajes por idioma
elija el texto y el análisis pueda leerlo como característica del visitante, no como un
tratamiento distinto. Sin texto para el idioma de la página, la familia no es candidata
(`NO_OP`), salvo fallback declarado por el merchant; los idiomas que un merchant soporta son
configuración suya.
