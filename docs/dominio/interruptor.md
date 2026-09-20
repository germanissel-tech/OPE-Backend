---
es: interruptor
en: kill-switch
contexto: plataforma
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#14.2
uso: pendiente
---

# interruptor -> `kill-switch`

> Kill switch global. OPE se apaga sin deploy y sin tocar el sitio del merchant. Es condición de entrada para cualquier retailer serio y no es negociable. — **DECIDIDO** (`01 §14.2`)

Por merchant, operado por la API de administración (`PUT …/kill-switch`), con efecto en la
siguiente solicitud. Apagado (`status: off`), **OPE deja de decidir, no de medir**: toda
decisión del merchant es `NO_OP` con motivo `merchant-off` antes de asignar (no consume
experimento ni presupuestos), ninguna intervención se emite, el SDK sigue recibiendo
respuestas válidas y calla; catálogo, órdenes y devoluciones de la plataforma se siguen
aceptando para no cortar la cadena de evidencia. No cambia el estado del experimento.
Distinto de desactivar (`deactivated`), que es terminal.
