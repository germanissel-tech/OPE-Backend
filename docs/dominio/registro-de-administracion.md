---
es: registro de administración
en: log
contexto: identidad
estado: aprobado
fuente: docs/adr/020-consumidores-autenticacion-idempotencia-paginacion.md
uso: pendiente
---

# registro de administración -> `log`

> Toda acción de administración se registra: actor, instante, operación, merchant, resultado y versión resultante. — **DECIDIDO** (2026-09-20, feature 017; ADR-031)

Lista, sólo de lectura, de lo que los operadores hicieron o intentaron: cada entrada
(`AdminEntry`) lleva el `operatorId` (o `system` para el import al arrancar), el instante,
el `operationId`, el merchant si lo hay, el resultado (`accepted`, `rejected` con el código
del error, `denied` por alcance), la versión de configuración o el experimento resultante y
el motivo declarado cuando lo hubo. Nunca contiene credenciales ni datos personales. Se lee
por `GET /v1/admin/log` y por merchant. En memoria hasta la feature de persistencia.
