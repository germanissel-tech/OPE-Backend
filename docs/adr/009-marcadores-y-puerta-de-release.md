---
numero: 9
titulo: Marcadores de estado epistémico y puerta de release
estado: aceptada
fecha: 2026-09-16
fuente: specs/002-gobernanza-contrato-codigo/research.md
---

# ADR-009 — Marcadores de estado epistémico y puerta de release

## Contexto

La constitución pide marcar afirmaciones como decididas, propuestas o abiertas; nadie las
contaba. Una duda escrita en prosa se pierde entre veinte archivos.

## Decisión

Los tokens `ABIERTO`, `PROPUESTO` y `PLACEHOLDER` (en mayúsculas, fuera de backticks) se
escriben dentro del texto al que pertenecen, en `contracts/` y `docs/`. `check:markers` los
lista con archivo y línea; `release-check` falla si queda un `ABIERTO` o `PLACEHOLDER` y avisa
con `PROPUESTO`. `DECIDIDO` no es marcador. Las decisiones transversales se registran acá, en
`docs/adr/`, y se citan como `ADR-NNN`; `check:adrs` falla ante una cita rota.

## Consecuencias

- Lo abierto del MVP (D3–D6) se registra como ADR en estado `abierta` (ADR-010), no como
  marcador del contrato: no bloquea lo ya escrito.
- No se escriben cifras de estado en prosa viva; las informan los comandos.
