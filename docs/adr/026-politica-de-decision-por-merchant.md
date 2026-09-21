---
numero: 26
titulo: Política de decisión por merchant como reglas tipadas sobre un vocabulario cerrado
estado: aceptada
fecha: 2026-09-18
fuente: specs/011-plano-de-decision-i/research.md
---

# ADR-026 — Política de decisión por merchant como reglas tipadas sobre un vocabulario cerrado

## Contexto

El plano de decisión (01 §4) infiere una de tres barreras (03 §4.2) a partir de lo que el
visitante hizo y decide intervenir o callarse. Cada merchant es un comercio con su propio
experimento: una tienda deportiva y una de moda femenina no reaccionan a las mismas señales ni
con los mismos umbrales, y los umbrales concretos son decisiones del stakeholder que se
recalibran con datos del piloto. Codificarlos en el código obligaría a un despliegue por
merchant y por ajuste; un motor de reglas genérico (json-rules-engine, rulepilot) abriría el
vocabulario (cualquier ruta de cualquier objeto), evaluaría con `any` y metería una
dependencia npm en el dominio (prohibido por `arch`, ADR-013).

La constitución I exige una autoridad por módulo y un orquestador que sólo transporte el
contexto; la III, que ambos brazos atraviesen la misma inferencia y que cada decisión estampe
la versión de configuración con la que se tomó; la IX, que el ledger conserve barrera,
evidencia y veredicto.

## Decisión

1. **La política de decisión es un dato del merchant, no código.** `OPE_MERCHANTS[i].decisionPolicy`
   (opcional; sin ella, `DEFAULT_DECISION_POLICY`, versión `default-1`) declara reglas
   `cuando ⟨condición⟩ entonces ⟨barrera, fuerza⟩`, umbral de confianza, segundos de lectura,
   pesos por fuerza, prioridad ante empate, criterio de alta intención, respuesta al abandono
   sin señal, intervenciones por sesión y evidencia exigida por barrera. Se construye por
   fábrica (`BarrierRules.of`, `DecisionPolicy.of`): una política inválida impide el arranque
   nombrando el campo (ADR-024).
2. **El vocabulario de hechos es cerrado y lo fija OPE.** Predicados sobre lo que la ingesta ya
   captura (conteo por tipo y subtipo de evento, permanencia por bloque, secuencia de dos
   eventos, retorno a un producto, atributo del producto, disponibilidad de la variante, estado
   de la sesión) combinados con `all`/`any`/`not`. Un merchant combina hechos; no agrega hechos
   ni barreras por configuración: eso es alcance de producto (contrato, glosario, SDK).
3. **Motor propio en el dominio, puro.** `Signals` agrega una secuencia de eventos (monoide: el
   lote se funde con la sesión) y `BarrierRules.infer(signals, product)` devuelve la confianza
   de **cada** barrera y las reglas cumplidas; sin reloj, sin puertos, sin aleatoriedad. La
   elección de la dominante, el umbral y la evidencia son del veredicto (`DecisionPolicy.verdict`).
4. **Dos módulos.** `barrier` es la autoridad de inferencia (vocabulario, álgebra, reglas,
   puerto `BarrierInference`); `decision` es el orquestador (`DecisionService`: asignación →
   inferencia → evidencia → veredicto → ledger) y el veredicto. La ingesta no conoce al plano:
   declara el puerto `DecisionPlane` y la composición lo enlaza (inversión de dependencia, sin
   ciclo en el mapa de contextos). El veredicto de la 011 fue la semilla de la política
   comercial (01 §4.5); la 012 la separó en su módulo (`commercial`, ADR-027), junto con la
   selección y el quality gate (`selection`): `DecisionPolicy` conserva sólo la inferencia.
5. **La política es parte del experimento.** Cambiarla con un experimento activo es un
   experimento nuevo (misma regla que la semilla y el reparto, ADR-022); `version` cambia y
   cada decisión del ledger registra `policyVersion`, las confianzas de las tres barreras, las
   reglas cumplidas, la barrera elegida, el disparador y la evidencia consultada.
6. **Criterio de revisión.** Se adopta un motor de reglas genérico (o un DSL propio con parser)
   cuando un merchant necesite un hecho fuera del vocabulario que OPE no quiera incorporar como
   producto, o cuando la autoría de políticas pase al portal (feature "ITT analysis and merchant portal") y requiera un editor. Hasta
   entonces, cada hecho nuevo es una feature.

## Consecuencias

- El stakeholder decide umbrales y reglas sin despliegue: edita la política del merchant y
  versiona. Los valores iniciales son los propuestos en la 011 (una señal fuerte más una de
  apoyo; 5 s; devoluciones → talle → precio; alta intención desde checkout; abandono sin señal
  ⇒ reaseguro de devoluciones; una intervención por sesión).
- Las intervenciones son comparables sólo dentro de una misma `policyVersion`; el análisis ITT
  (feature del portal) segmenta por ella.
- El estado de sesión vive en memoria con la ventana de la deduplicación (24 h / 100 000 por
  merchant) hasta la feature de persistencia; una sesión olvidada vuelve a empezar.
- **Holdout — DECIDIDO (stakeholder, 2026-09-18)**: un merchant conserva siempre un grupo de
  control mínimo, el _holdout_, como parámetro de su configuración (`holdoutPercent`, 5 % por
  defecto); el reparto a TREATMENT no puede superar `100 − holdout`, y pedir el 100 % da 95 con
  una advertencia. Sin holdout OPE dejaría de poder atribuir (01 §5). Se implementa con la
  configuración por API (feature "Configuration, flags, kill switch and administration"); hasta entonces, `treatmentPercent` sigue sin tope
  (los merchants de desarrollo y prueba usan 100 para observar el plano).
- Precisión (feature 017, 2026-09-20; ADR-031): `default-1` deja de ser una constante del
  código y es el contenido inicial del nivel **defaults de tratamiento**
  (`config/treatment-defaults.json`); un merchant la sobrescribe publicando una versión de
  configuración por API, y cada decisión estampa la terna de versiones (constitución XI).
