---
es: correspondencia de valores
en: attribute labels
contexto: decision
estado: aprobado
uso: disponible
fuente: mvp:01-arquitectura-mvp.md#14.2
---

# correspondencia de valores -> `attribute labels`

> Todo lo configurable por merchant vive en banderas con parámetros.

La traducción que declara un merchant entre **sus** etiquetas y los valores del vocabulario de OPE:
`Algodón Peinado 24/1` y `peinado` pueden apuntar las dos al mismo valor, y OPE escribe **una** frase
que sirve para las dos tiendas.

Es el mismo mecanismo que el mapa de anclajes: OPE fija el vocabulario chico y cada tienda mapea su
mundo sobre él. Varias etiquetas pueden corresponder a un valor; una etiqueta corresponde a uno solo,
o no se sabría qué decir de un producto que la trae.
