---
es: política de decisión
en: decision policy
contexto: decision
estado: aprobado
fuente: docs/adr/026-politica-de-decision-por-merchant.md
uso: disponible
---

# política de decisión -> `decision policy`

> La política de decisión es un dato del merchant, no código.

Lo que un merchant declara en `OPE_MERCHANTS[i].decisionPolicy`: reglas «cuando ⟨condición⟩
entonces ⟨barrera, fuerza⟩» sobre el vocabulario cerrado de hechos, umbral, segundos de lectura,
prioridad, criterio de alta intención, respuesta al abandono, intervenciones por sesión y
evidencia exigida por barrera. Versionada: cambiarla con un experimento activo es un experimento
nuevo, y cada decisión estampa `policyVersion`. Sin política, la por defecto (`default-1`).
No es la **política comercial** de 01 §4.5 (techo, margen, cooldown), que llega con la 012.
