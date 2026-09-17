---
es: grupo de control
en: control
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.1
uso: disponible
---

# grupo de control -> `control`

> Un visitante de CONTROL atraviesa todo el pipeline y se registra igual. La única diferencia es que la política siempre resuelve `NO_OP`. Esto permite medir sin sesgo y además detectar si el pipeline se comporta distinto entre brazos, que sería un defecto.

El brazo de referencia: vive la misma semana, la misma promoción y el mismo sitio que TREATMENT, sin intervención. Su `NO_OP` lleva el motivo `control-arm`.
