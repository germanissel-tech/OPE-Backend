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
