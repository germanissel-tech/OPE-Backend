---
es: variante
en: variant
contexto: ingesta
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#0.1
uso: disponible
---

# variante -> `variant`

> **Variante** — La combinación exacta de atributos que define un artículo vendible — en indumentaria, talle y color. Es el nivel donde vive la verdad de stock, y por lo tanto el único nivel en el que OPE puede afirmar disponibilidad.

En el catálogo (ADR-025): `variantId`, los atributos que la distinguen de sus hermanas,
disponibilidad (booleano, guardia) y precio vigente; pertenece a un producto de la misma instantánea.

Los atributos son los mismos pares clave/valor que declara el producto, tal como la plataforma los
expone: una prenda manda talle y color, una heladera capacidad y terminación, y OPE no necesita saber
cuál es cuál. Lo que identifica una variante es su `variantId`; los atributos dicen **qué la
distingue**, así que una variante única puede no declarar ninguno.
