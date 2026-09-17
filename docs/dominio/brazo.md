---
es: brazo
en: arm
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#0.1
uso: disponible
---

# brazo -> `arm`

> **CONTROL / TREATMENT** — Los dos grupos del experimento. CONTROL nunca recibe intervención; TREATMENT puede recibirla.

Cada uno de los dos grupos de un experimento controlado (como los brazos de una balanza). Un visitante pertenece a un solo brazo por experimento. Ver [grupo de control](grupo-de-control.md) y [grupo de tratamiento](grupo-de-tratamiento.md). El brazo nunca viaja como campo en el contrato; sólo el motivo del `NO_OP` (`control-arm`) lo deja ver.
