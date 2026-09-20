---
es: operador
en: operator
contexto: identidad
estado: aprobado
fuente: docs/adr/020-consumidores-autenticacion-idempotencia-paginacion.md
uso: pendiente
---

# operador -> `operator`

> Somos nosotros los que operamos OPE: damos de alta merchants, los configuramos, rotamos credenciales, abrimos y cerramos experimentos y apagamos OPE en un merchant sin deploy. — **DECIDIDO** (2026-09-20, feature 017; ADR-031)

Persona de OPE que administra la plataforma con un **token propio** (`adminToken`, bearer),
emitido fuera de banda (`scripts/mint-admin-token.mjs`) y rotable (hasta dos vigentes), con un
identificador que no es un dato personal (`operatorId`) y un **alcance** explícito: todos los
merchants (`*`) o una lista. Una operación sobre un merchant fuera del alcance se rechaza
como `merchant-out-of-scope` sin revelar si el merchant existe, y queda en el registro de
administración. No es el merchant (que no se administra a sí mismo en el MVP) ni una persona
del portal.
