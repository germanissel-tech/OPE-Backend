---
es: estrategia de sincronización
en: sync-strategy
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#6
uso: pendiente
---

# estrategia de sincronización -> `sync strategy`

> OPE se conecta a cada merchant con la menor fricción posible para su plataforma: la forma en que cada flujo llega se **negocia**, y agregar una plataforma es agregar un adaptador. — **DECIDIDO** (2026-09-20, evaluación de los documentos base, decisión 1)

Para cada flujo del puerto de plataforma (catálogo, stock y precio, órdenes, devoluciones) el
merchant y OPE eligen uno de tres modos: `push` (el merchant envía: `PUT /v1/catalog`,
`POST /v1/orders`, `POST /v1/returns`, con firma), `pull` (OPE consulta la API de la
plataforma con credenciales del merchant, a la cadencia que aguante) o `subscribe` (OPE
consume una cola en la que la plataforma publica cada cambio). Se mezclan por flujo. Los tres
llegan al mismo puerto y el núcleo no sabe quién inició; los adaptadores viven en OPE (ADR-025).
La estrategia es configuración del merchant (feature 017: el campo de estrategia de su versión
de configuración, con el default `push` en los cuatro flujos), congelada durante el piloto, y se
estampa en la versión de configuración. Un modo que ninguna fuente ejecuta para ese flujo no se publica, y la
entrada por un modo que no rige se rechaza; `subscribe` existe sólo para órdenes y devoluciones (ADR-047, feature
044).
