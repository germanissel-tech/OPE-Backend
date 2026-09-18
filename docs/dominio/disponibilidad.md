---
es: disponibilidad
en: availability
contexto: plataforma
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.3
uso: disponible
---

# disponibilidad -> `availability`

> **El stock es guardia, no claim — DECIDIDO.** OPE no afirma disponibilidad: el front del merchant ya la muestra, y más actualizada que nosotros (P13). El stock se usa para **no recomendar una variante agotada**.

Booleano por variante (`available`). Ninguna cantidad entra ni sale: la escasez numérica queda
fuera del MVP. Un dato viejo hace que OPE se calle, no que diga algo falso: por eso tolera
minutos de desactualización (frescura) y no exige tiempo real.
