---
numero: 10
titulo: Decisiones del MVP todavía sin cerrar (D3–D6)
estado: abierta
fecha: 2026-09-16
fuente: ../04-hoja-de-decisiones.md
---

# ADR-010 — Decisiones del MVP todavía sin cerrar (D3–D6)

## Contexto

La constitución v1.0.0 cierra D1 (Node LTS + TypeScript estricto) y D2 (PostgreSQL + Redis) y
deja cuatro decisiones en los documentos del MVP.

## Decisión

Sin decisión todavía. Se registran acá para que sean citables y para que `release-check`
no las confunda con marcadores del contrato:

| Decisión | Qué falta | Impacto en el backend |
|---|---|---|
| D3 · Hosting | Render hoy, AWS previsto | Nada del código asume proveedor (constitución, Stack) |
| D4 · Merchant piloto | Elegir el merchant | Primer adaptador real de plataforma (Magento 2) |
| D5 · Régimen de datos personales | Plazos de retención | Configuración de retención por merchant |
| D6 · Tamaño de muestra y duración | Regla de decisión pre-registrada | Análisis ITT; no toca el plano de decisión |

Cada una se cierra en `04-hoja-de-decisiones.md` de los documentos del MVP; al cerrarse, este
ADR pasa a `reemplazada` por uno nuevo con la decisión.

## Consecuencias

- Ninguna feature puede asumir una respuesta a D3–D6; si la necesita, lo dice en su spec y
  la marca como `PROPUESTO`.
