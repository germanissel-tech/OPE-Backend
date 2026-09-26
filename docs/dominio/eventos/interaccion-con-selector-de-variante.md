---
es: interacción con selector de variante
en: variant_selector_interacted
contexto: ingesta
estado: aprobado
fuente: mvp:03-alcance-mvp.md#4.1
---

# interacción con selector de variante -> `variant_selector_interacted`

> interacción con el selector de variante

El control que elige variante, tocado. En indumentaria son el selector de talle y el de color; en
otro rubro es otro control, y el vocabulario no tiene por qué saber cuál: lo que el sistema lee es
que el visitante lo tocó y cuántas veces.

Sin atributos propios, a propósito. Llevaba la etiqueta del talle «tal como la muestra la tienda» y
**ninguna autoridad la leía** (feature 028): era texto libre del merchant viajando dentro de un
vocabulario cerrado. Cuando hace falta la variante concreta, la trae
[selección de variante](seleccion-de-variante.md) con su `selectedVariantId`, que resuelve contra el
catálogo y tiene verdad detrás.
