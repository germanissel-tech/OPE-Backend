---
es: incentivo
en: incentive
contexto: decision
estado: aprobado
fuente: mvp:03-alcance-mvp.md#4.8
---

# incentivo -> `incentive`

> Resolver la barrera con el menor costo de margen posible: **información → reaseguro → reducción de incertidumbre → evidencia → incentivo.**

El último escalón de la escalera: un porcentaje que la política comercial del merchant concede
sólo cuando la barrera es precio, dentro de su techo y sus escalones, con margen configurado y
sin riesgo de devolución alto (ADR-027). Viaja al SDK en `intervention.incentive`
(`{ kind: "percent", value }`); cómo se canjea (cupón, checkout) es de la plataforma.
