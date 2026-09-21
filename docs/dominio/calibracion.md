---
es: calibración
en: calibration
contexto: medicion
estado: aprobado
fuente: mvp:03-alcance-mvp.md#4.10
uso: disponible
---

# calibración -> `calibration`

> Antes de congelar hay una ventana de calibración donde sí se ajusta: OPE corriendo en la tienda real, con tráfico real. Lo que pase en esa ventana no cuenta para el experimento. — **DECIDIDO** (D-G, 2026-09-20; ADR-030)

Primer estado de un experimento (`calibrating`): los visitantes se asignan y OPE decide e
interviene, pero cada decisión queda marcada (`phase: calibration`) y se excluye del análisis;
la configuración todavía se puede publicar. **Activar** el experimento (`active`) fija el
inicio de la ventana de acumulación y **congela** la configuración; desde entonces sólo entra
una versión correctiva con motivo, que reinicia la ventana y queda registrada. Cerrar
(`closed`) es terminal.
