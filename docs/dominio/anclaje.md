---
es: anclaje
en: anchor
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#3.1
---

# anclaje -> `anchor`

> Renderizado — Inserta la intervención en el punto de anclaje semántico que indica el backend (junto al selector de variante, bajo el precio, junto al CTA).

Punto semántico, no selector CSS: el mapa de anclajes del merchant lo resuelve al DOM (01 §3.1.1).
Valores del contrato: `variant_selector`, `price`, `cta`, `policies`.

Son cuatro y la fuente enumera cinco lugares, porque `variant_selector` cubre los dos selectores que
`01 §3` listaba por separado —el de talle y el de color— y que son el mismo control: el que elige
variante.
