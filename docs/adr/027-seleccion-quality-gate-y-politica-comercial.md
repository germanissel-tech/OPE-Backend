---
numero: 27
titulo: Selección con quality gate y política comercial como autoridades propias
estado: aceptada
fecha: 2026-09-19
fuente: specs/012-plano-de-decision-ii/research.md
---

# ADR-027 — Selección con quality gate y política comercial como autoridades propias

## Contexto

La 011 (ADR-026) dejó el plano de decisión con tres de sus cinco autoridades (01 §4):
asignación, inferencia de barrera y evidencia de producto, y un veredicto mínimo dentro del
módulo `decision`. Faltaban **selección y quality gate** (01 §4.4) y la **política comercial**
(01 §4.5), que la constitución I nombra como autoridades distintas: el gate valida que cada
mensaje pueda sostenerse con evidencia real y "no se relaja nunca para mejorar métricas"; la
política comercial es la única que emite el veredicto y gobierna el margen del merchant
(techo, escalera del incentivo, riesgo de devolución, cooldown y fatiga; 03 §4.8). ADR-026
dejó escrito que la 012 decidiría si la política comercial se separaba de `decision`.

## Decisión

1. **Dos módulos de dominio, sin capa de aplicación.** `selection` (candidatos, claims,
   perfil de evidencia del merchant, `QualityGate.judge`) y `commercial` (`CommercialPolicy`
   y su `verdict`). `selection` no conoce techo ni margen: un gate que conociera la política
   podría relajarse por configuración. `commercial` recibe candidatos ya juzgados y reutiliza
   el álgebra de condiciones de `barrier` para el riesgo de devolución. El orquestador
   (`DecisionService`) transporta el contexto e invoca en orden fijo.
2. **Candidatos y claims son vocabulario cerrado de OPE.** Un candidato declara barrera,
   escalón de la escalera (`information | reassurance | uncertainty | evidence | incentive`),
   anclaje y las clases de afirmación que hace (`returns-policy`, `fit-data`, `current-price`,
   `availability` como guardia, `incentive`, `product-attribute:<clave>`). Escasez numérica y
   prueba social no existen como claim (03 §4.5). Un merchant declara qué evidencia provee
   (`evidenceProfile`: política de devoluciones, dato de calce, atributos autorizados), nunca
   candidatos nuevos: eso llega con la feature del catálogo de mensajes.
3. **El gate es una función pura y `UNACCEPTABLE` es un tipo de falla.** Cada claim sin
   evidencia de su clase rechaza el candidato entero con un motivo cerrado; sin candidato
   aceptable, `NO_OP no-acceptable-candidate`. Ninguna configuración puede aceptar un claim
   sin evidencia.
4. **La política comercial es un dato del merchant, versionada, y la única que decide.**
   Techo, escalones, margen, riesgo de devolución, alta intención, abandono, presupuesto por
   sesión, cooldown y fatiga por visitante viven en `OPE_MERCHANTS[i].commercialPolicy`, se
   construyen por fábrica y cada decisión estampa `commercialPolicyVersion`. Lo comercial que
   la 011 tenía en `DecisionPolicy` (alta intención, abandono, presupuesto) se muda aquí con
   los mismos valores por defecto. Bloqueos en orden fijo y fail-closed: sin margen no sale
   nada con componente económico.
5. **El incentivo entra sólo por la escalera o por barrera de precio (D-B).** Se elige el
   primer candidato aceptable del escalón más bajo; el abandono de carrito, cuando confirma
   una barrera inferida, habilita el escalón siguiente; con barrera de precio y la política
   habilitándolo, el incentivo entra directo. Nunca hay incentivo para otra barrera. El valor
   es el primer escalón de la escalera, dentro del techo por invariante, y viaja al SDK como
   `intervention.incentive`; la redención (cupón, checkout) es de la plataforma (013/014).
6. **Estado por visitante entre sesiones** para la fatiga, en memoria y con ventana de un
   día, detrás de un puerto; sólo cuentan las intervenciones que el ledger aceptó.

## Consecuencias

- El ledger explica cada decisión hasta el candidato: qué se consideró, por qué se rechazó,
  qué se eligió, qué bloqueó la política y con qué versión (constitución IX).
- El piloto puede abrir el incentivo merchant por merchant configurando `marginPercent`; sin
  configurarlo, OPE nunca gasta margen.
- Los `messageVersionId` placeholder llevan el escalón (`msg_<barrera>_<anclaje>_<escalón>_v0`);
  la feature del catálogo de mensajes los reemplaza por versiones reales del catálogo sin tocar la selección.
- El escalón `uncertainty` existe en el vocabulario y no tiene candidatos hasta el catálogo de mensajes.
