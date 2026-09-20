<!--
Sync Impact Report (1.4.2, 2026-09-20)
- Version change: 1.4.1 → 1.4.2 (PATCH: el gate del plan admite lo que ADR-003 ya precisa).
- Modified sections: §Flujo de trabajo, Constitution Check, gate de superficie HTTP — un cambio
  incompatible del contrato es compatible hacia atrás, declara la versión mayor **o** entra
  bajo la marca `info.x-stability: building` (ningún merchant consume el contrato; ADR-003,
  precisión del 2026-09-20; `contract:diff` lo reporta y lo acepta, `release-check` avisa).
  Decisión del dueño en la feature 016: en construcción no se salta de versión mayor.
- Templates: sin cambios.

Sync Impact Report (1.4.1, 2026-09-20)
- Version change: 1.4.0 → 1.4.1 (PATCH: redacción; ningún principio cambia de sentido).
- Modified sections: X — las cuatro operaciones del puerto de plataforma se nombran con
  identificadores en inglés (`fetchCatalog`, `fetchStockAndPrice`, `onOrderConfirmed`,
  `onReturnRegistered`) en lugar de los nombres en español de 02 §6.1: el código y el
  contrato son en inglés (ADR-015) y el gate `check:identifiers` (feature 016, decisión 12 de
  la evaluación) los detectó como identificadores inexistentes. El mapa del contrato
  (feature 019) los nombra; 02 §6.1 se alinea en la historia 3 de la feature 016.
- Templates: sin cambios.

Sync Impact Report (1.4.0, 2026-09-20)
- Version change: 1.3.0 → 1.4.0 (MINOR: principio nuevo XI "Ninguna política vive en el
  código"; acumula un PATCH de redacción en "Contrato de datos e identidad").
- Added sections: XI (tres niveles de configuración —plataforma, default de tratamiento,
  merchant—, orden de resolución, lo que queda en el código, lo que se estampa y congela).
  Fuente: decisión 6 de docs/auditoria/2026-09-20-evaluacion-docs-base-vs-repo.md (§2.2),
  aprobada por el dueño el 2026-09-20; 01 §14.2 (flags) y 03 §4.10 (congelamiento).
- Modified sections: "Contrato de datos e identidad" — las barreras se nombran con los
  identificadores del contrato (`fit`, `price`, `returns`; ADR-015) y el nombre de 03 §4.2 como
  prosa (decisión 12 de la evaluación; el gate `check:identifiers` lo verifica). VII: la nota
  transitoria de la 1.3.0 sobre 01 §10.3 se cierra cuando la feature 016 edite ese documento
  (siete campos); hasta entonces sigue vigente.
- Templates: sin cambios. Los Constitution Check evalúan los once principios y citan la versión.

Sync Impact Report (1.3.0, 2026-09-19)
- Version change: 1.2.0 → 1.3.0 (MINOR: el principio VII amplía en un elemento la lista del
  conector de órdenes; ningún otro principio cambia).
- Modified sections: VII (el incentivo aplicado —clase y valor— entra en la lista cerrada del
  conector de órdenes: OPE lo concedió y no identifica al comprador). Fuente: ADR-028 §5–6 y el
  hallazgo F-062 de la auditoría 014 (docs/auditoria/2026-09-19-informe-auditoria-integral.md);
  decisión del dueño del 2026-09-19 (specs/015-correcciones-auditoria/spec.md). Nota: 01 §10.3
  (documento del MVP, fuera del repo) sigue listando seis campos; la enmienda es una extensión
  que el documento fuente no contradice en su intención (no aceptar datos del comprador) y que
  ADR-028 deja anotada hasta que 01 se actualice.
- Templates: sin cambios. Los Constitution Check de los planes evalúan los diez principios y
  citan la versión (specs/015 en adelante).

Sync Impact Report (1.2.0, 2026-09-17)
- Version change: 1.1.0 → 1.2.0 (MINOR: una excepción acotada al principio V para el
  consumidor `admin`, verificada por lint; ningún otro principio cambia).
- Modified sections: V (merchantId en la ruta sólo bajo operaciones de administración,
  ADR-020). Fuente: specs/006-mapa-del-contrato, aprobada por el usuario el 2026-09-17.
- Templates: sin cambios.

Sync Impact Report (1.1.0, 2026-09-16)
- Version change: 1.0.0 → 1.1.0 (MINOR: dos gates nuevos en el Constitution Check y la
  verificación ejecutable de principios que ya existían; ningún principio cambia).
- Modified sections: Flujo de desarrollo (gates de invariantes y de glosario; capas y
  marcadores verificados). Fuente: specs/002-gobernanza-contrato-codigo, ADR-006..ADR-009.
- Templates: sin cambios; el plan-template lee los gates de esta sección en runtime.

Sync Impact Report (1.0.0)
- Version change: (template) → 1.0.0
- Modified principles: n/a (creación inicial)
- Added sections: Principios I–X, Contrato de datos e identidad, Stack y restricciones
  técnicas, Flujo de desarrollo (API-first + spec-kit), Gobernanza
- Removed sections: n/a
- Templates: plan-template.md / spec-template.md / tasks-template.md se leen en runtime; el
  Constitution Check del plan debe verificar los gates de la sección "Flujo de desarrollo".
- Follow-up TODOs: ninguno. D1 y D2 quedaron cerrados en esta ratificación.
- Fuente: ../01-arquitectura-mvp.md, ../02-integracion-ecommerce.md, ../03-alcance-mvp.md
-->

# Constitución de OPE-Backend

Este documento gobierna el backend del MVP de OPE (Zona B de `01-arquitectura-mvp.md`).
Deriva de los documentos del MVP en `../` y **no los reemplaza**: ante conflicto, se corrige
la constitución o el documento, nunca se deja la contradicción. Cada regla marcada como
MUST es verificable en revisión de código o por prueba automática.

Tesis que ordena todo el alcance:

> El MVP es el sistema más chico capaz de producir una medición creíble de contribución
> incremental en un merchant real. **El aparato de medición tiene que ser más confiable que
> la lógica de intervención.**

## Core Principles

### I. Separación de autoridades

Cada motor decide una sola cosa y nadie decide dos veces lo mismo. Las autoridades del plano
de decisión son, en orden fijo: asignación experimental → inferencia de barrera → evidencia de
producto → selección + quality gate → política comercial. Reglas:

- Cada autoridad MUST vivir en su propio módulo, con una interfaz explícita y sin dependencia
  de las demás salvo por el contrato de entrada/salida que el orquestador transporta.
- El orquestador MUST limitarse a armar el contexto e invocar las autoridades en orden. MUST NOT
  inferir barreras, rankear candidatos ni elegir mensajes.
- La política comercial es la única autoridad que emite el veredicto final (intervenir o
  `NO_OP`). Ninguna otra autoridad MUST forzar una intervención.
- Existe un **composition root único** donde se instancian y cablean las dependencias.
  Ningún módulo MUST instanciar sus propias dependencias de infraestructura (Redis, Postgres,
  HTTP) ni importar clientes concretos fuera de ese root.

Fundamento: la POC perdió esta propiedad (orquestador de 5.429 líneas, 93 rutas en un
archivo, `require('ioredis')` repetido en diez lugares). Es el defecto estructural que el MVP
existe para no repetir.

### II. Fail-closed: `NO_OP` es el estado por defecto

Ante dato ambiguo, evidencia insuficiente, configuración ausente o correlación incompleta, el
sistema restringe la acción y el claim. Lo que no se sabe no se convierte en promesa.

- Todo paso del pipeline MUST poder terminar en `NO_OP` con motivo explícito y registrado.
  `NO_OP` es un resultado correcto, no una excepción ni un error.
- El stock es **guardia, no claim**: se usa para no recomendar una variante agotada; MUST NOT
  usarse para afirmar disponibilidad ni cantidades.
- Un solo claim inventado o contradictorio invalida el mensaje entero (`UNACCEPTABLE` es un
  tipo de falla, no un puntaje bajo). El quality gate es una función pura y MUST NOT relajarse
  para mejorar métricas.
- Si la configuración de margen está ausente, la política MUST bloquear todo candidato con
  componente económico. Si el ledger no está disponible, la intervención MUST suprimirse.
- El perfil de datos del merchant se **mide, no se declara**: el nivel efectivo es el mínimo
  entre lo configurado y lo observado, y degrada solo cuando la sincronización se rompe.

### III. La medición precede y no se contamina

- La asignación CONTROL/TREATMENT MUST ser determinista y estable por `visitorId`, sin
  consultar estado compartido, y MUST registrarse en el ledger en el momento de asignar, no
  cuando hay exposición.
- Un visitante de CONTROL MUST atravesar el mismo pipeline de observación; la política resuelve
  siempre `NO_OP`. Cualquier diferencia de comportamiento del pipeline entre brazos es un defecto.
- El aprendizaje MUST NOT realimentar la decisión durante el experimento. Aprender significa
  registrar evidencia; el punto de reconexión se diseña explícitamente y queda desconectado.
- La asignación experimental **no es un feature flag**. Los flags definen qué puede hacer OPE
  para un merchant; el experimento define a quién. MUST NOT compartir mecanismo.
- La configuración del merchant se versiona y cada decisión del ledger MUST estampar la
  versión con la que se tomó.
- La observabilidad es un observador puro: MUST NOT modificar una decisión.
- Los cinco estados de la cadena de evidencia (`ASSIGNED`, `EXPOSED`, `VERIFIED_ORDER`,
  `ATTRIBUTED_ORDER`, `RETURNED`) son explícitos; ninguno MUST inferirse del anterior. El
  resultado causal no es un estado: surge del análisis ITT entre grupos. Cuando no se sabe, el
  sistema dice `PENDING_CORRELATION` o `NOT_AVAILABLE`, nunca cero.

### IV. Dos caminos, dos garantías

- **Plano de decisión**: síncrono, acotado, **sin I/O de red saliente y sin escrituras
  bloqueantes** en el camino crítico. Objetivo de diseño: < 150 ms desde que el evento llega
  hasta que sale la decisión (p50/p95/p99 medidos; no es SLA hasta medirlo bajo tráfico real).
  Catálogo y configuración se sirven desde caché caliente, nunca desde la plataforma del merchant.
- **Plano de medición**: asíncrono, durable, auditable. Compra, outcome y aprendizaje MUST NOT
  compartir el presupuesto de latencia del plano de decisión.
- Redis es estado caliente de sesión, acotado y con expiración; MUST NOT ser fuente de verdad
  durable. PostgreSQL es la fuente durable de ledger, órdenes, atribuciones, asignaciones,
  catálogo y configuración.
- El MVP corre en **una sola instancia** del plano de decisión. Multi-instancia y exactly-once
  distribuido quedan fuera; las garantías se declaran como de instancia única y no se
  sobreprometen (ver §9 de `01-arquitectura-mvp.md`).

### V. Aislamiento por merchant como invariante

- `merchantId` MUST derivarse siempre de la credencial autenticada. MUST NOT tomarse del body,
  la query ni el path, **salvo en las operaciones del consumidor `admin`** (ADR-020): su
  credencial es de un operador de OPE, no de un merchant, y el merchant administrado es un
  recurso de la ruta. La excepción está acotada por lint: en query y body sigue prohibido para
  todos; en la ruta, para todo consumidor que no sea `admin`.
- `merchantId` MUST formar parte de toda frontera de datos: cada consulta y cada escritura a
  Redis y a PostgreSQL lo incluye en la clave o en el predicado.
- Clave de ingesta por merchant, rotable y distinta de las credenciales del portal.
- Cada feature que toque persistencia o API MUST incluir pruebas de contaminación cruzada
  entre merchants; su ausencia bloquea el merge.
- No hay estado global compartido entre merchants en proceso.

### VI. Identidad explícita, idempotencia explícita

Cuatro identidades, cuatro propósitos. Colapsarlas es la fuente de errores más cara del sistema.

| Identidad | Propósito único |
|---|---|
| `eventId` | Deduplicación de ingesta ante reintento y replay. |
| `sessionId` | Agrupar la secuencia de comportamiento de una visita. Expira. |
| `visitorId` | Estabilidad de la asignación experimental y memoria entre sesiones. |
| `orderId` | Identidad de compra e idempotencia de outcome. Proviene de la plataforma. |

- `orderId` es la **única** identidad válida para idempotencia de compra. `eventId` MUST NOT
  usarse como identidad de compra.
- El chequeo y el registro de una orden ya procesada MUST ocurrir sin operación asíncrona
  intermedia (misma transacción), para no abrir la condición de carrera que la POC sufrió.
- La pérdida de `visitorId` produce un visitante nuevo: se cuantifica y se reporta, no se
  compensa con inferencias.

### VII. OPE observa comportamiento, no personas

- El contrato de evento es una **lista blanca**. La API de ingesta MUST rechazar (no limpiar)
  eventos con campos no declarados, con error ruidoso.
- MUST NOT registrarse nunca: nombre, email, teléfono, dirección, contenido de formularios,
  datos de pago, documentos, grabación de sesión, dirección IP persistida, huella de
  dispositivo identificatoria. Sólo clase de dispositivo para layout.
- El contrato del conector de órdenes MUST acotarse a: identificador de orden, monto, moneda,
  ítems con SKU y cantidad, fecha, el identificador de OPE y el incentivo aplicado (clase y
  valor: lo concedió OPE, no es un dato del comprador; v1.3.0, ADR-028). Campos adicionales se
  rechazan.
- El historial de devoluciones por cliente sólo entra con clave seudónima provista por el
  merchant. El principio gana sobre la funcionalidad.
- La frase autorizada es "OPE no almacena información identificatoria". MUST NOT afirmarse en
  código, docs ni API que "no maneja datos personales".
- Retención configurable por merchant; plazos exactos pendientes de D5.

### VIII. Cero modelos de lenguaje en runtime

En el runtime del MVP un modelo de lenguaje MUST NOT intervenir en ninguna decisión ni generar
texto que vea un visitante. Cero llamadas en el camino crítico. Los mensajes son **curados y
versionados**; el runtime los lee de un almacén. Los usos offline (redacción del catálogo de
mensajes, normalización de catálogo, pre-generación de variantes) corren fuera del plano de
decisión y sus salidas se revisan y versionan antes de servirse.

### IX. Nada entra al reporte sin trazabilidad

Toda cifra que ve el merchant MUST poder reconstruirse desde el ledger hasta el evento que la
originó. El ledger es durable e inmutable (append-only); la entidad `Decision` guarda barrera
inferida, evidencia consultada, candidatos, veredicto de política, brazo experimental, versión
de configuración y resultado. El titular económico es **Incremental Contribution**, por ITT,
con intervalo de confianza, tamaño de grupos y estado de acumulación; nunca "profit" ni "ROI".

### X. Puertos en los dos bordes

- El **puerto de plataforma** tiene exactamente cuatro operaciones: `fetchCatalog`,
  `fetchStockAndPrice`, `onOrderConfirmed`, `onReturnRegistered`. El núcleo depende del
  puerto y MUST NOT saber si del otro lado hay Magento, VTEX o un adaptador de prueba.
- El **adaptador genérico** (catálogo por REST/archivo + notificación HTTP de orden) y el
  **adaptador de prueba** existen desde el día uno; Magento 2 es el primer adaptador real;
  VTEX sólo se verifica documentalmente durante el diseño del puerto.
- Lo que varía por merchant es **configuración versionada, no código** (perfil de datos,
  mapa de anclajes, flags, catálogo de mensajes).
- Mecanismo A (server-to-server con identificador propagado) es la única fuente autoritativa
  de atribución; B corrobora; C nunca es autoridad.

### XI. Ninguna política vive en el código

Todo valor que gobierna el comportamiento de OPE es **configuración**, en tres niveles y con
este orden de resolución: lo que define el **merchant** → si no lo define, el **default global
de tratamiento** de OPE → nunca una constante del código. El código conserva sólo las
**invariantes** (qué valores son válidos: tasas 0–1, escalera creciente, techo ≥ escalón) y los
**algoritmos** (asignación, inferencia), no los valores.

- **Nivel plataforma**: reglas de OPE que el contrato publica o de las que depende la seguridad
  (ventana de deduplicación, tolerancia de reloj, TTL de sesión y visitante, límites de cuerpo).
  Configuración global del despliegue, versionada; nunca por merchant.
- **Nivel default de tratamiento**: políticas de decisión y comercial, presupuesto de frescura,
  umbrales del nivel de sincronización, estrategia de sincronización por flujo. Datos cargados
  al arrancar, versionados.
- **Nivel merchant**: lo que un merchant sobrescribe del nivel anterior, por flujo cuando
  corresponda.

Lo que está en los niveles default y merchant es **parte del tratamiento**: se versiona, se
estampa en cada decisión del ledger y se congela durante el piloto (`03-alcance-mvp.md` §4.10).
Una constante nueva en `src/` que gobierne comportamiento MUST ir a uno de los tres niveles;
el gate de números mágicos la detecta. La feature que saca del código las políticas actuales
es la de configuración del mapa del contrato.

## Contrato de datos e identidad

- **Escalas**: las superficies visibles al merchant expresan porcentajes en 0–100; los motores
  internos trabajan con tasas 0–1. La normalización ocurre **una sola vez, en el borde** (capa
  de API / DTO). Un tipo interno MUST NOT recibir un porcentaje 0–100.
- **Frescura por merchant**: el presupuesto de frescura de catálogo, stock y precio se configura
  por merchant y se mide. Un dato más viejo que su presupuesto se trata como ausente.
- **Barreras del MVP**: exactamente tres — `fit` (talle y calce), `price` (precio y valor),
  `returns` (cambios y devoluciones), con los identificadores del contrato. Agregar una barrera
  es cambio de alcance, no feature.
- **Superficies**: ficha de producto entra; carrito es capacidad construida con activación
  pendiente (D-A); home, listado y checkout quedan fuera.
- **Estados de desconocimiento**: `PENDING_CORRELATION` y `NOT_AVAILABLE` son valores de primera
  clase en el modelo y en la API; MUST NOT representarse como `null` ni `0`.

## Stack y restricciones técnicas

Decisiones D1 y D2 cerradas al ratificar esta constitución:

- **Lenguaje**: Node.js LTS + TypeScript con `strict: true`. Sin `any` implícito ni explícito
  salvo en fronteras con librerías sin tipos, y siempre encapsulado.
- **Persistencia**: PostgreSQL (durable) + Redis (sesión caliente). Migraciones versionadas en
  el repo; el esquema físico deriva del modelo conceptual de `01-arquitectura-mvp.md` §7.
- **Estructura**: un módulo por autoridad, inyección de dependencias explícita, composition
  root único. Sin singletons de infraestructura.
- **Contratos**: OpenAPI 3.1 en `contracts/openapi.yaml` como fuente de verdad de toda
  superficie HTTP; esquemas de evento como lista blanca en `contracts/`. Tipos y validadores
  de runtime se **generan** desde el contrato, nunca se escriben a mano en paralelo.
- **Observabilidad**: logs estructurados con `merchantId`, `sessionId`, `decisionId`; latencia
  del camino crítico por percentil; tasa y motivo de `NO_OP`; salud de ingesta de catálogo;
  latencia y completitud de correlación de órdenes.
- **Hosting**: Render hoy, AWS previsto (D3 abierto). Nada del código MUST asumir un proveedor.
- **Kill switch global** por merchant, efectivo sin deploy.

## Flujo de desarrollo

**API-first + spec-driven.** El orden es parte de la regla:

1. `/speckit-specify` produce la especificación de la feature en `specs/NNN-nombre/spec.md`,
   escrita en términos de comportamiento y criterios de aceptación, sin decisiones de
   implementación.
2. `/speckit-plan` MUST pasar el **Constitution Check** con estos gates explícitos:
   - ¿La feature toca una superficie HTTP? → el cambio a `contracts/openapi.yaml` se diseña en
     `specs/NNN/contracts/` **antes** de cualquier tarea de código, y es compatible hacia atrás,
     declara la versión mayor, o entra bajo la marca `info.x-stability: building` mientras
     ningún merchant consuma el contrato (ADR-003; la marca se quita antes del primer piloto).
   - ¿Toca persistencia o API? → hay tareas de prueba de aislamiento por merchant.
   - ¿Toca el plano de decisión? → no introduce I/O de red ni escritura bloqueante en el camino
     crítico, y toda salida puede ser `NO_OP` con motivo.
   - ¿Toca el ledger o la cadena de evidencia? → cada estado se registra explícitamente y es
     reconstruible.
   - ¿Introduce un campo nuevo de evento u orden? → está en la lista blanca del contrato y no
     es PII.
   - ¿Introduce una llamada a un modelo de lenguaje en runtime? → rechazado.
   - ¿Introduce una regla de negocio que el esquema no puede expresar (aritmética entre
     campos, unicidad, estado de otro recurso)? → se declara en `x-invariants` con su tipo
     propio de Problem Details y tiene una prueba nombrada por ese tipo (ADR-007).
   - ¿Introduce un sustantivo nuevo en el contrato? → tiene su nota en `docs/dominio/` con
     fuente antes de escribirse (ADR-008).
   - ¿Toca `src/`? → respeta la dirección de dependencias entre capas (`domain` → `ports` →
     `adapters`/`handlers` → `main.ts`), verificada por `npm run arch` (ADR-006).
3. `/speckit-tasks` genera tareas; las de contrato y pruebas preceden a las de implementación.
4. `/speckit-implement` ejecuta. Toda unidad de trabajo termina con pruebas verdes ejecutables.

**Pruebas.** Cada autoridad tiene pruebas unitarias como función pura. Cada endpoint tiene
pruebas de contrato contra el OpenAPI. Existe una prueba end-to-end que ejercita el circuito
completo (evento → decisión → exposición → orden → atribución) usando el adaptador de prueba.
Las pruebas de contaminación cruzada entre merchants corren en cada build.

**Estado epistémico.** Documentación, specs y reportes marcan cada afirmación como `DECIDIDO`,
`PROPUESTO` o `ABIERTO`, y el estado del sistema como BUILT / CONNECTED / ACTIVE / TESTED. Nada se
afirma como funcionando sin evidencia ejecutable. Los marcadores `ABIERTO`, `PROPUESTO` y
`PLACEHOLDER` son contables (`npm run check:markers`) y `release-check` no pasa con uno
bloqueante (ADR-009). Las decisiones transversales se registran en `docs/adr/` y se citan como
`ADR-NNN`; no se escriben cifras de estado en prosa viva.

**Alcance.** Lo que `03-alcance-mvp.md` §5 lista como fuera del MVP MUST NOT entrar por una
feature; requiere cambio de alcance documentado. Preparar la arquitectura no es entregar la
capacidad.

## Governance

- Esta constitución prevalece sobre cualquier práctica, plantilla o costumbre del repositorio.
  Cuando un plan o una tarea la contradice, se corrige el plan o se enmienda la constitución;
  no se ignora.
- **Enmiendas**: se proponen por PR que modifica este archivo, con justificación y, si cambia
  un principio, con el impacto sobre specs y código existentes. Los principios derivados de una
  decisión DECIDIDO en los documentos del MVP sólo se enmiendan si el documento fuente cambia.
- **Versionado semántico**: MAJOR para remover o redefinir principios de forma incompatible;
  MINOR para agregar principios o secciones o ampliar guía materialmente; PATCH para
  aclaraciones y redacción.
- **Revisión de cumplimiento**: todo PR MUST declarar en su descripción qué gates del
  Constitution Check aplican y cómo se verificaron. La complejidad añadida MUST justificarse
  frente a la tesis del MVP (¿contribuye a producir un número confiable de contribución
  incremental?). Si no, queda fuera.
- Decisiones abiertas que esta constitución no cierra: D3 (hosting), D4 (merchant piloto),
  D5 (régimen de datos personales), D6 (tamaño de muestra y duración). Se registran en los
  documentos del MVP y se incorporan aquí cuando se cierren.

**Version**: 1.4.2 | **Ratified**: 2026-09-16 | **Last Amended**: 2026-09-20
