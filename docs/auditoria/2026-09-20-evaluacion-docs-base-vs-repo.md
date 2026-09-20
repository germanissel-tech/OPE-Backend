# Evaluación: documentos base del MVP frente al repositorio

**Fecha**: 2026-09-20 · **Estado**: decisiones tomadas por el dueño; trabajo derivado pendiente de spec.
**Base evaluada**: `../README.md`, `../01-arquitectura-mvp.md` (v0.1, 13/09), `../02-integracion-ecommerce.md` (v0.1, 13/09), `../03-alcance-mvp.md` (v0.4, 13/09), `../04-hoja-de-decisiones.md` y `../diagramas/` (tres fuentes `archify`).
**Repositorio evaluado**: `main` tras la 015 (`.specify/memory/constitution.md` v1.3.0, `docs/adr/`, `docs/dominio/`, `contracts/`, `src/`, `CLAUDE.md`), en el estado de la PR #24.

## 1. Alcance y método

Se leyeron los cinco documentos y las tres fuentes de los diagramas enteros y se cotejaron, afirmación por afirmación, con la constitución, los ADR, el glosario, el mapa del contrato y el código. Cada diferencia se discutió con el dueño y terminó en una decisión registrada abajo con su fundamento. No hay puntuaciones; cada afirmación lleva su cita.

El criterio de negocio que ordenó las decisiones, fijado por el dueño en esta evaluación:

> OPE se conecta a cada merchant con la **menor fricción posible para su plataforma**: el trabajo vive en OPE, los adaptadores por plataforma están desacoplados del núcleo y agregar una plataforma es agregar un adaptador. Cuantos más merchants en funcionamiento, mejor.

## 2. Diferencias y decisiones

| #   | Diferencia                                        | Base                                                                                          | Repo                                                                                                     | Decisión                                                                                                           |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Cómo llega el catálogo, el stock/precio, la orden | Pull: OPE consulta (`02 §4`, `§6.1`); genérico por push (`02 §6.2`)                           | Sólo push: `PUT /v1/catalog` snapshot completo, `POST /v1/orders`, `POST /v1/returns` (ADR-025, ADR-028) | **Estrategia por merchant y por flujo, negociada**: `push`, `pull`, `subscribe`; un puerto, adaptadores en OPE     |
| 2   | Adaptador genérico y de prueba "desde el día uno" | Entran en el MVP (`02 §6.2`, `§6.4`; `03 §4.13`); verificación documental contra VTEX entra   | Push existe (es el genérico); no hay puerto saliente ni adaptador de prueba; VTEX sin verificar          | Push cuenta como genérico; adaptador de prueba con el puerto; **verificación documental Magento 2 + VTEX antes**   |
| 3   | Campos del conector de órdenes                    | Seis (`01 §10.3`)                                                                             | Siete: más `incentive` aplicado (constitución v1.3.0, ADR-028)                                           | `01 §10.3` pasa a siete: el incentivo es dato de OPE, no del comprador                                             |
| 4   | Persistencia                                      | Redis + relacional; garantías de durabilidad (`01 §3.2`, `§9`); D2 cerrada en la constitución | Todo en memoria (ADR-018); un reinicio borra todo                                                        | **Memoria mientras se construye**; persistencia cuando funcione; el piloto la requiere                             |
| 5   | Registro en el ledger                             | Asíncrono, sin escritura bloqueante (`01 §4.6`, P9; constitución IV)                          | El caso de uso espera la escritura (F-045 de la 014)                                                     | Núcleo agnóstico (ya, por puertos); aceptación del registro desacoplada de la latencia del ledger, en la 019       |
| 6   | Frescura y perfil de datos                        | Por merchant, medido, mínimo entre declarado y observado (`01 §8`, `§14.1`; `03 §4.6`)        | Constantes globales (36 h, 15 min); sólo el nivel observado                                              | **Principio XI**: ninguna política vive en el código; tres niveles (plataforma, default, merchant), por flujo      |
| 7   | Estados de la cadena de evidencia                 | `VERIFIED_ORDER → ATTRIBUTED_ORDER → RETURNED`; `NOT_AVAILABLE` (`01 §5`, `§5.2`)             | `status: ATTRIBUTED_ORDER \| PENDING_CORRELATION`, `RETURNED`; sin `NOT_AVAILABLE`                       | **El contrato adopta la cadena de la base** (versión mayor); `correlation` aparte; `NOT_AVAILABLE` con el portal   |
| 8   | Decisiones de producto D-B, D-C, D-E, D-F, D-G    | Sin confirmar (`04`; `03 §6`)                                                                 | D-B, D-C y D-E implementadas según la propuesta (ADR-027, spec 012); D-F y D-G pendientes (016, 018)     | **Las cinco confirmadas** el 2026-09-20 por el dueño                                                               |
| 9   | Idioma de los mensajes                            | No lo menciona                                                                                | No lo contempla                                                                                          | **Dimensión del catálogo de mensajes**: `locale` en el request, idiomas del merchant en configuración, fail-closed |
| 10  | Diagramas                                         | Pull puro, "token", persistencia presente, sin idioma                                         | —                                                                                                        | Se actualizan con `01`/`02` en la misma pasada                                                                     |
| 11  | Estado de la base frente al repo                  | `README`: D1 abierta, arquitectura borrador, validación pendiente (13/09)                     | D1/D2 cerradas, trece features, 29 ADR, decisiones que la base no conoce; V1–V6 no se hicieron           | **La base sigue siendo la fuente y se actualiza**; V1–V6 con su estado                                             |
| 12  | Ajustes internos del repo                         | —                                                                                             | Constitución cita `talle_calce`, `precio_valor`, `cambios_devoluciones`; ADR-010 remite D3–D6 a `04`     | PATCH de la constitución (`fit`, `price`, `returns`) + gate `check:identifiers`; ADR-030; ADR-010 corregido        |

### 2.1 Estrategia de sincronización por flujo (decisiones 1 y 2)

El puerto de plataforma define **qué entra** (catálogo, stock/precio, orden, devolución), no quién inicia. Los cuatro flujos ya convergen en la misma escritura interna (`CatalogStore.replace`, `OrderLedger.record`, `recordReturn`), así que push, pull y subscribe son tres formas de llegar al mismo puerto; el núcleo no se entera de cuál fue (`01 §3.1.1`: lo que varía por merchant es configuración, no código).

| Flujo          | Modos                                                                    | Existe hoy    |
| -------------- | ------------------------------------------------------------------------ | ------------- |
| Catálogo       | `push` (snapshot completo) · `pull:magento2` · `pull:vtex` · `pull:rest` | `push`        |
| Stock y precio | `in-snapshot` · `push-partial` · `pull:<adaptador>` · `subscribe`        | `in-snapshot` |
| Órdenes        | `push` (webhook firmado, ADR-029) · `pull:<adaptador>` · `subscribe`     | `push`        |
| Devoluciones   | `push` · `pull:<adaptador>` · `subscribe`                                | `push`        |

Perfiles por plataforma como valores por defecto (Magento 2: pull; genérico: push); la combinación se negocia con cada merchant. Diseño previo común a los tres modos: refresco parcial de stock/precio con instante por ítem (idempotente por variante + instante; una variante desconocida se ignora con motivo), contrato de datos compartido (los cuerpos de los mensajes reutilizan los esquemas del contrato: lista blanca y prohibición de datos personales valen igual, constitución VII), autenticación por mensaje, y planificador y consumidor **fuera del camino de decisión** (`01 §4.6`). El perfil de datos se mide por flujo y el nivel efectivo sale del mínimo; con `subscribe` el nivel 3 deja de ser inalcanzable. La estrategia es configuración congelada durante el piloto (`03 §4.10`) y se estampa en la versión de configuración.

`subscribe` se diseña ahora y se construye después de pull: sólo reduce fricción cuando la plataforma ya publica eventos (VTEX: feed de órdenes y hooks; Magento 2: sus colas no se exponen, haría falta una extensión). La huella inevitable del lado del merchant sigue siendo una: adjuntar el identificador de OPE a la orden al crearla (`02 §6.3`); ningún modo la evita.

### 2.2 Principio XI (decisión 6), texto propuesto para la constitución

> ### XI. Ninguna política vive en el código
>
> Todo valor que gobierna el comportamiento de OPE es **configuración**, en tres niveles y con este orden de resolución: lo que define el **merchant** → si no lo define, el **default global de tratamiento** de OPE → nunca una constante del código. El código conserva sólo las **invariantes** (qué valores son válidos: tasas 0–1, escalera creciente, techo ≥ escalón) y los **algoritmos** (asignación, inferencia), no los valores.
>
> - **Nivel plataforma**: reglas de OPE que el contrato publica o de las que depende la seguridad (ventana de deduplicación, tolerancia de reloj, TTL de sesión y visitante, límites de cuerpo). Configuración global del despliegue, versionada; nunca por merchant.
> - **Nivel default de tratamiento**: políticas de decisión y comercial, presupuesto de frescura, umbrales del nivel de sincronización, estrategia de sincronización por flujo. Datos cargados al arrancar, versionados.
> - **Nivel merchant**: lo que un merchant sobrescribe del nivel anterior, por flujo cuando corresponda.
>
> Lo que está en los niveles default y merchant es **parte del tratamiento**: se versiona, se estampa en cada decisión del ledger y se congela durante el piloto (`03 §4.10`). Una constante nueva en `src/` que gobierne comportamiento MUST ir a uno de los tres niveles; el gate de números mágicos la detecta.

Inventario que lo motiva (estado al 2026-09-20): frescura (`application/catalog/policies/freshness.ts`, 36 h / 15 min) y umbrales del nivel de sincronización (`sync-level.ts`) son globales fijos y deberían ser default + merchant por flujo; ventana de deduplicación (`dedup-window.ts`), tolerancia de reloj (`shared-kernel/time.ts`) y TTL de sesión/visitante son nivel plataforma (dos de ellas publicadas en el contrato: no pueden variar por merchant); las políticas de decisión (`default-1`) y comercial (`commercial-default-1`) ya siguen el patrón merchant → default y son el modelo a extender; los buckets de asignación y FNV-1a son algoritmo, no política.

### 2.3 Idioma (decisión 9)

| Parte                        | Dónde va                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Idiomas soportados y default | Configuración del merchant (feature de configuración)                                         |
| Idioma de esta página        | `PageContext.locale` (BCP 47), leído por el SDK de la página; contexto, no dato personal      |
| Texto por idioma             | Catálogo de mensajes: entrada por familia × idioma, cada una versionada                       |
| Quién resuelve el texto      | El backend (`01 P2`): la decisión sale con el mensaje resuelto y el ledger sabe qué se mostró |

Reglas: sin texto para el idioma de la página, la familia no es candidata (`NO_OP` `message-unavailable`), salvo fallback declarado por el merchant; el idioma es característica del visitante, no un tratamiento distinto, pero el ledger registra familia, idioma y versión (`messageVersionId` identifica el texto concreto); `locale` entra al contrato de evento como campo de la lista blanca.

### 2.4 Cadena de evidencia en el contrato (decisión 7)

`status` de la orden: `VERIFIED_ORDER` (confirmada por la plataforma, sin vínculo) → `ATTRIBUTED_ORDER` (correlación por mecanismo A) → `RETURNED`; `correlation: PENDING_CORRELATION | ATTRIBUTED` aparte; `NOT_AVAILABLE` como valor de primera clase donde un dato no está instrumentado (portal). Cambio incompatible ⇒ versión mayor `/v2/`, a hacer junto con el resto de cambios de contrato de esta evaluación (`locale`), en una sola versión mayor. Sin merchants conectados, el costo es sólo interno.

## 3. Coincidencias verificadas

Señales de `03 §4.1` una por una, incluidas las cuatro de salida (`inactivity`, `tab_hidden`, `back_navigation`, `exit_intent`); tres barreras (`03 §4.2`); escalera de cinco escalones (`03 §4.8`); reglas del quality gate (`01 §4.4`, ADR-027); mecanismos A/B/C con A como única autoridad (`02 §5.2`, ADR-028); idempotencia por `orderId` sin operación asíncrona intermedia (`01 §6`); stock como guardia, no claim (`01 §4.3`); nivel 3 sin ganancia sobre el 2 para los claims (`01 §14.1`); P12 — lista blanca, IP no persistida, dispositivo sólo como clase (`01 §10.2`, `§10.3`); P13; abandono como amplificador (D-B); `merchantId` sólo desde la credencial (`01 §10.7`); ledger no disponible ⇒ sin intervención (`01 §4.7`, `NO_OP` `ledger-unavailable`); cero modelos de lenguaje en runtime (`01 §4.8`).

De los once criterios de aceptación de `03 §10`, hoy se cumplen el 2, el 3, el 6 y el 11, y el 4 parcialmente (tres barreras sí; latencia como gate informativo, no medida bajo tráfico real); el 1 y el 5 dependen del SDK (Zona A, fuera del repo); el 7, 8, 9 y 10 quedan en las features del roadmap.

## 4. Hallazgo sobre la auditoría 014

La afirmación A-041 ("exactamente tres barreras", `docs/auditoria/trabajo/afirmaciones.md`) se marcó probada cotejando conteo y significado, sin cotejar los identificadores: la constitución cita `talle_calce`, `precio_valor`, `cambios_devoluciones` donde el contrato y el código dicen `fit`, `price`, `returns`. Un identificador citado entre comillas de código en un documento debe existir con ese nombre exacto en el contrato o en `src/`; de ahí el gate `check:identifiers` (decisión 12).

## 5. Trabajo derivado

Se ejecuta como una feature nueva (spec, plan, tareas); nada de esto se implementa antes.

### 5.1 Base (`../`, documentos y diagramas)

- `README.md`: estado real y fecha (D1/D2 cerradas; features construidas y planificadas remiten al mapa del contrato); V1–V6 con su estado (pendientes, o cubiertos por la verificación documental de la decisión 2).
- `01`: `§3.2`/`§9` nota de estado (memoria durante la construcción; garantías con la feature de persistencia); `§3.1.1` `PageContext.locale`; `§4.4` mensajes curados, versionados y por idioma; `§10.3` siete campos; `§14.2` idiomas del merchant; `§14.1` nivel 3 alcanzable con suscripción.
- `02`: `§4`/`§6` estrategia por merchant y por flujo con tres modos; `§6.2` push como el genérico ya construido.
- `03`: `§4.13` adaptador de prueba y verificación documental "con la feature del puerto"; `§6` decisiones confirmadas con fecha.
- `04`: las cinco decisiones marcadas como confirmadas el 2026-09-20.
- `diagramas/`: adaptadores con tres modos; clave de ingesta y clave de plataforma con firma en vez de "token"; persistencia marcada como feature; `locale` en el contexto de página.

### 5.2 Repo

- Constitución: principio XI (MINOR); PATCH de barreras a `fit`, `price`, `returns`; cierre de la nota transitoria de VII cuando `01 §10.3` se edite.
- ADR-025 revisado (push es un modo, no el caso base); ADR-030 "Decisiones de producto confirmadas" (D-B, D-C, D-E, D-F, D-G); ADR-010 corregido (D3–D6 → `01 §13`).
- Mapa del contrato: roadmap reordenado — configuración → persistencia → puerto, estrategia por flujo y adaptadores → catálogo de mensajes → portal → observabilidad; descripciones ampliadas: configuración (tres niveles, idiomas, congelamiento y versión de configuración estampada), catálogo de mensajes (dimensión idioma, `message-unavailable`), persistencia (aceptación del registro desacoplada; los tres hallazgos de diseño de la 014), puerto (refresco parcial, planificador, consumidor, adaptador Magento 2, adaptador de prueba). Una sola renumeración, que también absorbe el número de la feature nueva.
- Contrato v2: `status` con la cadena de la base y `correlation`; `locale` en `PageContext`; tipos, controllers, pruebas y glosario (`orden-verificada`, `orden-atribuida`, `correlacion-pendiente`).
- Gate `check:identifiers` con fixture y prueba; en `contract:check`.
- Glosario: `estrategia-de-sincronizacion`, `idioma` (o `locale`), y las notas que cambian.
- Tarea previa a la feature del puerto: verificación documental de Magento 2 y VTEX (catálogo, stock y órdenes por API; cómo se adjunta y recupera el identificador de OPE en la orden; qué eventos publica cada plataforma).

### 5.3 Fuera de esta feature

Implementar los tres modos, el refresco parcial, la persistencia, el catálogo por idioma y el portal: cada uno en su feature del roadmap, con su spec.
