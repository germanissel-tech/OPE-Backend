---
es: grupo de tratamiento
en: treatment
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#0.1
uso: disponible
---

# grupo de tratamiento -> `treatment`

> **CONTROL / TREATMENT** — Los dos grupos del experimento. CONTROL nunca recibe intervención; TREATMENT puede recibirla.

El brazo que puede recibir intervención cuando exista el plano de decisión. Hasta entonces resuelve `NO_OP` con los motivos de la 004 (`decision-plane-unavailable`, `page-context-incomplete`).
