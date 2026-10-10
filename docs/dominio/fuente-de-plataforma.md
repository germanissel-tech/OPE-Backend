---
es: fuente de plataforma
en: platform-source
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#6.1
---

# fuente de plataforma -> `platform source`

> OPE define una sola interfaz de plataforma —el puerto— y cada plataforma tiene su adaptador, que traduce el dialecto de esa plataforma al vocabulario de OPE. — **DECIDIDO** (`02 §6.1`)

Lo que OPE lee de la plataforma del merchant en los modos `pull` y `subscribe`: el catálogo, el stock y el precio
de un lote de variantes, los cambios de órdenes y de devoluciones, y el detalle que sigue a un aviso. Cada
plataforma tiene la suya (`generic`, que no lee nada porque todo le llega por `push`; `test`, la de prueba;
`magento2`, después) y declara qué modos soporta por flujo. Qué fuente usa un merchant es configuración.

No es el puerto: el puerto son las cuatro operaciones por las que lo leído entra al núcleo (ADR-047).
