---
es: experimento
en: experiment
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#14.2
uso: disponible
---

# experimento -> `experiment`

> Experimento — muestra objetivo, cortes, tope de calendario

Un experimento por merchant (como máximo uno activo): identificador, reparto TREATMENT/CONTROL, semilla, estado y fecha de inicio. Semilla y reparto son inmutables: cambiarlos es un experimento nuevo (ADR-022). No es una bandera de configuración: nadie cambia la asignación de un visitante.
