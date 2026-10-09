---
numero: 31
titulo: Merchants operados, tres niveles de configuración y administración
estado: aceptada
fecha: 2026-09-20
fuente: specs/017-merchants-y-configuracion/research.md
---

# ADR-031 — Merchants operados, tres niveles de configuración y administración

## Contexto

OPE es una plataforma con un solo código y N merchants: los datos de cada uno están aislados y
su comportamiento lo gobierna su configuración (constitución I y XI). Somos nosotros quienes
la operamos. Hasta la feature 016 un merchant era una entrada de `OPE_MERCHANTS` leída al
arrancar —darlo de alta, rotarle una clave, cambiarle una política o apagarle OPE era editar un
JSON y reiniciar— y las políticas de comportamiento (frescura, nivel de sincronización,
ventanas, memoria de sesión y de visitante) eran constantes del código. El consumidor `admin`
existía en el mapa sin ninguna operación construida y con su esquema `PROPUESTO` (ADR-020).
Los documentos base exigen que sumar un merchant sea onboarding y no desarrollo (`01 §3.1.1`),
que el kill switch se opere sin deploy (`01 §14.2`) y que la configuración se versione, se
estampe en cada decisión y se congele durante el piloto tras una calibración (`01 §14.2`,
`03 §4.10`, D-G en ADR-030). El dueño fijó la forma el 2026-09-20 (sesión de la 016;
`specs/017-merchants-y-configuracion/research.md`).

## Decisión

1. **Ninguna operación sobre un merchant requiere reinicio.** Alta, credenciales,
   configuración, experimentos e interruptor son operaciones en caliente por la API de
   administración y valen desde la siguiente solicitud. El servidor se reinicia sólo con un
   deploy nuevo, que hace falta sólo cuando cambia el código o lo que viaja con él.
2. **Una fuente de verdad detrás de puertos por intención.** Tres agregados con vidas
   distintas, cada uno con su puerto de escritura en su módulo: `Merchant` (`MerchantStore`:
   identidad acuñada por OPE, estado `active | off | deactivated`, orígenes, credenciales),
   `MerchantConfigurationVersion` (`ConfigurationStore`, módulo nuevo `configuration`) y
   `Experiment` (`ExperimentStore`). Los puertos y las operaciones nombran intenciones (`createMerchant`,
   `rotateIngestKey`, `publishMerchantConfiguration`, `activateExperiment`), devuelven `Result` y no
   suponen motor. Los puertos de lectura existentes (`MerchantDirectory`,
   `ExperimentDirectory`, `PolicyDirectory`) se implementan sobre los stores; el gateway en
   memoria es el de hoy y la persistencia (018) agrega otro sin tocar el núcleo. `OPE_MERCHANTS`
   deja de ser fuente de verdad: es una semilla que se importa, por los mismos casos de uso y a
   nombre del operador `system`, sólo cuando el store está vacío. No existe borrado: un merchant
   se desactiva y sus registros se conservan.
3. **Tres niveles de configuración, resueltos valor por valor** (constitución XI): nivel
   plataforma y defaults de tratamiento son **archivos del release** (`config/platform.json`,
   `config/treatment-defaults.json`) con versión declarada, cargados por un puerto, validados en
   la construcción contra el vocabulario del código y legibles por API, nunca modificables en
   caliente (su radio es multitenant: un cambio contaminaría todos los experimentos); el nivel
   merchant se publica por API como versiones numeradas e inmutables. La configuración efectiva
   se calcula al publicar y se sirve desde memoria (el camino crítico sigue sin I/O); cada
   decisión estampa la terna `{ platform, defaults, merchant? }`. El módulo `configuration` es
   dueño de los niveles y de la resolución y nadie lo importa: cada consumidor define su puerto
   de lectura y la composición enlaza. Las constantes de comportamiento salen de `src/`; quedan
   invariantes y algoritmos.
4. **Credenciales.** Las claves (ingesta, plataforma) se acuñan del lado de OPE, se entregan
   una sola vez y se guardan por huella (SHA-256); el secreto de firma se conserva protegido
   porque el HMAC lo necesita, y nunca se devuelve. Rotación con gracia declarada (tope de
   plataforma; por defecto ninguna), hasta dos vigentes por clase.
5. **Operadores con alcance y registro.** El esquema `adminToken` (bearer) queda decidido:
   tokens por operador (nunca compartidos), emitidos fuera de banda con huella en
   `OPE_ADMIN_OPERATORS`, rotables, con alcance `*` o lista de merchants. El alcance se juzga
   en cada caso de uso de administración (`AdminScopeService`) antes de tocar el store y sin
   revelar si el merchant existe; toda acción —aceptada, rechazada o denegada— queda en el
   registro de administración con actor, instante, operación, merchant, resultado y versión
   resultante, sin datos personales (`AuditedUseCase`).
6. **Kill switch por merchant**: apaga la decisión, no la medición. Apagado, toda decisión es
   `NO_OP merchant-off` antes de asignar; catálogo, órdenes y devoluciones se siguen aceptando.
7. **Experimento**: nace en calibración (decisiones marcadas y excluidas del análisis), se
   activa (empieza la ventana y congela la configuración: `configuration-frozen`, salvo versión
   correctiva con motivo que reinicia la ventana y queda registrada) y se cierra (terminal). Uno
   abierto por merchant. El interruptor no cambia su estado.

## Consecuencias

- Dos módulos nuevos (`configuration`, `admin`) en el mapa de contextos; ~20 operaciones del
  consumidor `admin` y dos del `sdk` (`getSdkConfig`, `reportAnchorDiagnostics`); nueve tipos
  de problema y el motivo `merchant-off`.
- Hasta la persistencia, un reinicio por deploy pierde lo creado por API y el arranque vuelve
  a importar la semilla: por eso la 018 precede al puerto de plataforma y a cualquier piloto.
- ADR-020: `adminToken` deja de ser `PROPUESTO`. ADR-022: los estados del experimento son
  `calibrating → active → closed`; el holdout se aplica al abrir un experimento por API.
  ADR-026 y ADR-027: `default-1` y `commercial-default-1` son el contenido inicial del nivel
  defaults de tratamiento. ADR-025/ADR-028/ADR-029: las claves y secretos ya no vienen de
  `OPE_MERCHANTS` sino del merchant creado por API (o de la semilla importada).
- Multi-instancia e invalidación de caché de la configuración efectiva quedan fuera (`01 §9`:
  una instancia).

## Enmienda (registrada 2026-09-24, feature 024) — la forma que esta decisión tomó al construirse

Lo que la implementación fijó y sólo estaba escrito en las instrucciones de los agentes:

- **El agregado y sus reglas.** `Merchant` lleva `status` (`active | off | deactivated`) y
  `credentials: Credential[]` (`kind` `ingest | platform | signing`, huella SHA-256 del valor,
  `issuedAt`, `expiresAt`; **sólo la de firma conserva el secreto**). Las reglas viven en el
  agregado y se invocan por su nombre: `owns(fingerprint, now)`, `ownsPlatformKey`,
  `signingSecrets(now)`, `requiresSignature(now)`, `rotated(credential, grace, now)` —la anterior
  sigue valiendo durante la gracia, acotada por un máximo—, `switched(on)`, `deactivated()`
  (irreversible; `409 merchant-deactivated`) y `Merchant.judgeOrigins`.
- **Las credenciales se ven una vez.** Los valores los acuña el puerto `CredentialMinter`
  (`ope_ik_ | ope_pk_ | ope_ps_` + base64url) y viajan **sólo** en la respuesta que los emite; el
  store guarda huellas y resuelve por `MerchantDirectory.byFingerprint`.
- **El kill switch corta antes de asignar** (01 §14.2): `switched(false)` ⇒ la decisión responde
  `NO_OP` `merchant-off` **antes** de la asignación, para no contaminar la medición
  (`MerchantPolicies.enabled`, leído del store por `switchAwarePolicyDirectory` en los gateways del
  módulo `configuration`). Ingesta, outcomes y catálogo siguen funcionando.
- **Los operadores** llegan por `OPE_ADMIN_OPERATORS` (JSON) o `OPE_ADMIN_OPERATORS_FILE`
  (`operatorId`, huellas de sus tokens, `scope: "*" | [merchantId]`). `adminToken` es bearer;
  `AdminTokenResolver` lo resuelve por huella (`401 operator-unknown`) y entrega
  `OperatorPrincipal`. Un merchant fuera del alcance responde `403 merchant-out-of-scope` con el
  mismo cuerpo que uno inexistente **sólo cuando el operador no lo alcanza**: la diferencia entre
  «no existe» y «no es tuyo» no se filtra.
- **Toda operación `admin` se audita** (ADR-034): el registro (`AdminLog`, `AdminEntry`: operador,
  operación, merchant, resultado `accepted | rejected | failed`, motivo) se escribe pase o falle, y
  se lee paginado por `GET /v1/admin/log` y `GET /v1/admin/merchants/{merchantId}/log`.
- **Herramientas**: `node scripts/mint-admin-token.mjs` acuña un token y su huella, y
  `config/dev-operators.json` lleva el operador de desarrollo.
- **Qué contiene cada nivel, y cómo llega a quien lo usa.** El detalle que sólo estaba escrito en
  las instrucciones de los agentes (mudado acá por la feature 026, deuda D-07):
  - **Plataforma** (`config/platform.json`): ventana de deduplicación, tolerancia de reloj, memoria
    de sesión y de visitante, ventana de firma, gracia máxima de rotación, tope de diagnósticos.
  - **Default de tratamiento** (`config/treatment-defaults.json`): frescura, umbrales del nivel de
    sincronización, `holdoutShare`, las tres políticas, superficies, barreras, estrategia de
    sincronización, idiomas.
  - **Merchant**: las versiones que publica `publishMerchantConfiguration`, más el mapa de anclajes.
  - `EffectiveConfiguration` resuelve **valor por valor** entre los tres, `ConfigurationService` lo
    sirve desde memoria, y cada decisión estampa la terna en `DecisionFacts.configuration`.
  - Un consumidor **nunca lee un nivel**: recibe el valor por su puerto (`ClockTolerance`,
    `SignatureWindow`, `CatalogPolicies`, `PolicyDirectory`, `VisitorWindow`) o en su construcción
    —los stores en memoria reciben su ventana—, enlazado en `composition/modules/`.
- **Cómo entra la semilla, y qué no pisa.** También mudado desde las instrucciones de los agentes
  por la feature 026 (deuda D-09): `OPE_MERCHANTS` (JSON) u `OPE_MERCHANTS_FILE` los importa
  `bootstrap` por `ImportMerchantsUseCase` como el operador `system`, y **sólo si el store arranca
  vacío**: con merchants ya registrados no pisa nada. Sin semilla y sin store poblado, nadie
  autentica. Junto a los campos del merchant admite todo lo que `MerchantConfigurationDeclared`
  admite (`decisionPolicy`, `commercialPolicy`, `evidenceProfile`, `holdoutShare`, `freshness`, …),
  que `ImportMerchantConfigurationUseCase` publica como la versión 1 **sólo si el merchant no tiene
  versiones**. Los dos niveles del release los lee `readConfig` por los lectores de forma del módulo
  `configuration` (`readPlatformConfiguration`, `readTreatmentDefaults`) y los juzgan las fábricas
  del dominio (`PlatformConfiguration.of`, `TreatmentDefaults.of`): un valor fuera de rango es un
  `ConfigError` que nombra `platform.<campo>` o `treatmentDefaults.<campo>`.
- **Nada de lo que un operador hace a un merchant requiere reiniciar** —crear, rotar, apagar, dar de
  baja—: se lee del store en la siguiente request.

## Enmienda (2026-10-01, feature 036) — los niveles 1 y 2 también se publican por API

El punto 3 de la decisión dijo que el nivel plataforma y los defaults de tratamiento son archivos del
release, «legibles por API, **nunca modificables en caliente** (su radio es multitenant: un cambio
contaminaría todos los experimentos)». Decisión del dueño (2026-09-30): **todo se configura desde el panel
de administración**, esos dos niveles incluidos.

**El motivo del ADR era real y su protección no existía**, y eso es lo que hace que esto sea una enmienda y
no una conveniencia. El ADR nunca comparó contra la alternativa que dejó en pie: hasta esta feature el único
camino para cambiar esos valores era un **deploy**, que hace el mismo daño, peor y en silencio.

|                                             | Antes, por deploy                                                                                                 | Después, por API                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Contamina experimentos activos              | sí                                                                                                                | sí, y **exige un motivo declarado**  |
| Reinicia el servidor con merchants operando | sí                                                                                                                | no                                   |
| Queda versionado                            | sólo si alguien recuerda cambiar el `version` del archivo; una huella lo obligaba en **2 de 22** campos           | siempre: numerada e inmutable        |
| Queda en el registro de administración      | **no**, de ninguna forma                                                                                          | sí: actor, instante, motivo, versión |
| Avisa que hay medición en curso             | no                                                                                                                | sí (`409 configuration-frozen`)      |
| Reinicia la ventana de medición             | **no**: el experimento seguía corriendo partido en dos tratamientos y su número dejaba de significar lo que decía | sí, y registra qué versión lo causó  |

Lo que se decide, entonces:

1. **Los dos niveles se publican por la API de administración** como versiones numeradas e inmutables, con
   el mismo molde que el nivel merchant. Los archivos del release pasan a ser **semilla**: se importan una
   sola vez, sobre un almacén vacío, a nombre del operador `system`, y el arranque dice qué hizo. Desde el
   segundo arranque, editar el archivo no hace nada.
2. **El congelamiento del nivel merchant, escalado**: con experimentos activos **alcanzados** por el cambio
   se exige una versión correctiva con su motivo, y se reinicia la ventana de medición de cada uno. El motivo
   es dónde queda registrada la conciencia del operador sobre lo que su cambio implica; no es un supuesto, es
   un campo obligatorio.
3. **Alcanzado se calcula por hoja, no por campo.** Seis de los diez campos de tratamiento se mezclan clave
   por clave, así que un merchant puede declarar `decisionPolicy.threshold` y no `readingSeconds`: queda
   alcanzado igual, porque para la segunda hoja sigue ganando el nivel. Leerlo por campo dejaría ventanas
   corriendo sobre un tratamiento que cambió, que es el error más caro que esta feature podía cometer.
4. **El cambio alcanza a todos los merchants, así que exige un operador de alcance total**
   (`operator-scope-too-narrow`, 403). Un alcance que hoy nombra a todos sigue siendo una lista, y un nivel
   se sirve también a los merchants que todavía no existen.
5. **La versión la acuña OPE y el nombre se mina del número** (`defaults-3`), y **un archivo del release no
   nombra ninguna**. Antes cada archivo traía su `version` y nada obligaba a cambiarlo cuando el contenido
   cambiaba, así que dos tratamientos podían compartir nombre.

   Quitar el campo no es cosmético: mientras estuvo, el string del archivo (`platform-2`) **podía chocar** con
   el que la segunda publicación acuña para otro contenido, y un nombre que significa dos tratamientos es
   exactamente lo que numerar vino a impedir. Hoy no hay decisión estampada que eso rompa —no hay piloto— así
   que el hueco se cerró por construcción en vez de quedar anotado: los dos archivos declaran valores y nada
   más, validan contra su esquema `…Content`, y lo que el arranque le pone a lo que lee es `platform-seed` /
   `defaults-seed`, un nombre que ninguna publicación puede acuñar. Si aparece en una decisión o en lo que el
   SDK recibe, algo sirvió el archivo en vez del nivel vigente, y se ve.

6. **Un nivel se lee, no se hornea al arrancar.** Es la idea que la feature agrega al principio XI: no
   alcanza con que un valor viva en configuración si el proceso lo convierte en constante al construirse.
   El nivel de plataforma se le entregaba a once componentes en su construcción; pasa a llegarles por un
   lector que consultan al usar, en memoria y sin I/O.
7. **Invalidar alcanza.** Una publicación de nivel tira los niveles memoizados y la configuración efectiva
   por merchant, y no recalcula nada: la resolución de cada merchant es perezosa, así que el costo de un
   cambio es el de un arranque en frío —una lectura por merchant en su próximo pedido—, que ya existía.

Lo que **no** cambia: qué valores existen, el orden de resolución de los tres niveles, la terna que cada
decisión estampa, y que la configuración efectiva se sirva desde memoria para que el camino de decisión no
gane I/O. Y la frontera sigue siendo la del hito: la unidad es del **proceso** y una instancia (**D-21**);
con dos, un cambio no alcanzaría al otro.

---

**Nota del 2026-10-09 (feature 040, ADR-044).** El operador tiene nombre para mostrar: `displayName`,
opcional en `OPE_ADMIN_OPERATORS` y en `config/dev-operators.json`, validado al arrancar (no vacío, sin
espacios en los bordes, hasta 80 caracteres) y servido **sólo a él** por `getOperator`. El registro de
administración sigue indexado por `operatorId` y no lo lleva; la constitución VII (1.5.0) acota su
protección a las personas observadas y deja al operador como persona identificada y auditada.

**Nota del 2026-10-09 (feature 041, ADR-045).** El merchant tiene identidad para personas: nombre
para mostrar (obligatorio al crear por la API, opcional en la semilla), URL de la tienda, persona de
contacto y notas del operador, como **valor del agregado** que viaja en su documento y se reemplaza
entero con `updateMerchantProfile`. Lo operativo de este ADR —estado, orígenes, credenciales y sus
operaciones— no cambia; la identidad no entra en el registro de administración ni en ninguna decisión.
