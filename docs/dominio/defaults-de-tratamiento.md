---
es: defaults de tratamiento
en: treatment-defaults
contexto: plataforma
estado: aprobado
fuente: constitucion#XI
uso: pendiente
---

# defaults de tratamiento -> `treatment-defaults`

> Nivel default de tratamiento: políticas de decisión y comercial, presupuesto de frescura, umbrales del nivel de sincronización, estrategia de sincronización por flujo. Datos cargados al arrancar, versionados. — **DECIDIDO** (constitución XI)

El segundo nivel: lo que rige para todo merchant que no declaró el valor. Vive en
`config/treatment-defaults.json` con su `version` (la primera, "defaults-1", contiene las políticas
`default-1` y `commercial-default-1`, la frescura de 36 h / 15 min y `push` en los cuatro
flujos: lo que hasta la feature 017 eran constantes del código). Viaja con el release; una
prueba de la construcción verifica que cada valor resuelve al vocabulario del código
(barreras, candidatos, claims, motivos, modos). Se lee por `GET /v1/admin/treatment-defaults`.
Es parte del tratamiento: su versión se estampa en cada decisión. Qué es cada campo lo dice el
contrato (`TreatmentDefaults`) y su esquema generado (`generated/schemas/treatment-defaults.schema.json`,
referenciado en `$schema`); quién lo lee y cuándo, `config/README.md`.
