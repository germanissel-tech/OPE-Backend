---
numero: 30
titulo: Decisiones de producto D-B, D-C, D-E, D-F y D-G confirmadas
estado: aceptada
fecha: 2026-09-20
fuente: ../04-hoja-de-decisiones.md
---

# ADR-030 — Decisiones de producto D-B, D-C, D-E, D-F y D-G confirmadas

## Contexto

`04-hoja-de-decisiones.md` reúne cinco decisiones de producto con una propuesta cada una y la
casilla "Confirmo / Cambio" en blanco; `03-alcance-mvp.md` §6 dice que "necesitan acuerdo
explícito antes de arrancar". El repo había implementado tres de ellas según la propuesta
(D-B en ADR-027 y la spec 012, que la da por cerrada; D-E como vocabulario cerrado de claims;
D-C como riesgo de devolución por comportamiento de sesión) sin que el documento fuente las
registrara como decididas. La evaluación de los documentos base del 2026-09-20 lo señaló
(decisión 8) y el dueño confirmó las cinco.

## Decisión

Las cinco decisiones quedan **confirmadas por el dueño el 2026-09-20**, tal como `04` las
propone:

| Decisión | Propuesta confirmada                                                                                                                                                                                                                                                     | Consecuencia en el repo                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-E      | La evidencia que sostiene un mensaje es sólo lo verificable del catálogo y de la configuración del merchant (política de cambios, atributos autorizados, datos de calce, precio vigente). Fuera: escasez numérica, agregados de comportamiento, prueba social.           | Vocabulario cerrado de claims del quality gate (ADR-027): `returns-policy`, `fit-data`, `current-price`, `availability` como guardia, `product-attribute`, `incentive`. Un claim nuevo es una feature.    |
| D-F      | Portal con dos planos: salud operativa siempre visible; el resultado sólo en cortes pre-fijados por muestra acumulada (33 %, 66 %, 100 %, con tope de calendario). El tramo en curso se muestra en este orden: veredicto, intervalo, cifras, fecha estimada.             | Da forma a la feature "ITT analysis and merchant portal" del mapa: sus operaciones y el motor de análisis (intervalo, proyección, cortes por muestra). `NOT_AVAILABLE` como valor de primera clase.       |
| D-B      | El abandono de carrito no es una barrera: amplifica la que ya venía detectándose (sube un escalón); el incentivo entra sólo cuando la barrera dominante es precio; sin señal previa, reaseguro.                                                                          | Implementado: `CommercialPolicy` (ADR-027) — `abandonment`, `directIncentiveOnPrice`, incentivo sólo con barrera `price`.                                                                                 |
| D-C      | El historial de devoluciones del cliente es OPCIONAL: se agrega sólo si el merchant lo da con clave anónima y se mide que llegan suficientes visitantes identificados; su ausencia no es incumplimiento. El riesgo de devolución se estima por comportamiento de sesión. | Implementado el riesgo por sesión (condición `returnRisk` de la política comercial); el histórico no existe y no tiene fecha.                                                                             |
| D-G      | Ventana de calibración con tráfico real donde sí se ajusta (sus datos no cuentan); después, configuración congelada; arreglos que restauran lo previsto se permiten con registro; kill switch siempre; un cambio de tratamiento reinicia la ventana de acumulación.      | Da forma a la feature de configuración del mapa: versión de configuración activa y estampada en cada decisión, registro de cambios, corte de la ventana de análisis. Es lo que el principio XI formaliza. |

D-A (activación del carrito) sigue pendiente de la verificación V2 del merchant elegido; D-D
(segunda plataforma) es técnica y está cerrada (verificación documental de VTEX, adaptador
completo fuera del MVP). D1–D6 de `01 §13` siguen como las deja ADR-010.

## Consecuencias

- La spec 012, ADR-027 y el código dejan de implementar una propuesta pendiente: implementan
  una decisión confirmada, citable por este ADR.
- `04-hoja-de-decisiones.md` y `03-alcance-mvp.md` §6 registran la confirmación con la fecha
  (feature 016, historia 3).
- Si el stakeholder cambia alguna de las cinco, este ADR pasa a `reemplazada` y la feature que
  la implementó revisa su alcance.
