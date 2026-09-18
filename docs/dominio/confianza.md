---
es: confianza
en: confidence
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.2
uso: disponible
---

# confianza -> `confidence`

> Si ninguna barrera supera el umbral de confianza, el resultado es `NO_OP` por evidencia insuficiente.

Un número 0–1 por barrera: la suma, acotada a 1, de los pesos de las reglas de la política que
se cumplieron. La política fija el umbral y el orden de prioridad ante empate. Nunca viaja al
SDK: vive en el ledger (`inference.confidences`, las tres barreras). No es una probabilidad.
