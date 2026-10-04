---
es: capa de texto
en: layer
contexto: decision
estado: aprobado
uso: disponible
fuente: specs/038-textos-por-api/spec.md#Lo decidido antes de la spec
---

# capa de texto -> `layer`

> Dos capas. La **base**, cerrada en familias y completa en cada idioma soportado; y la **del
> merchant**, dispersa, por idioma, que se resuelve antes que la base dentro del mismo idioma.

De quién es un texto: de todos (la base, que escribe OPE para cada familia e idioma soportado) o de
un merchant (su capa, con sólo las claves que quiso decir distinto). La clave de un texto —familia,
valor de atributo, idioma— es la misma en las dos; la capa es parte de la publicación, no de la
clave. **El idioma manda sobre la capa**: un merchant que personalizó su texto en un idioma muestra
la base en los demás.

Reemplaza a la voz (feature 038): con una capa por merchant, una voz por idioma por merchant no
nombraba nada distinto de la capa. Lo que la voz quería decir —un registro compartido entre tiendas
del mismo rubro— no existe hoy y, si vuelve a hacer falta, es otro concepto.
