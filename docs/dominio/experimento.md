---
es: experimento
en: experiment
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#14.2
uso: disponible
---

# experimento -> `experiment`

> Experimento — muestra objetivo, cortes, tope de calendario

Un experimento por merchant (como máximo uno abierto): identificador, reparto TREATMENT/CONTROL, semilla, muestra objetivo, cortes, estado e instantes. Semilla y reparto son inmutables: cambiarlos es un experimento nuevo (ADR-022). No es una bandera de configuración: nadie cambia la asignación de un visitante.

Estados (feature 017, D-G): nace en **calibración** (`calibrating`: se asigna y se decide, nada
cuenta), se **activa** (`active`: empieza la ventana de acumulación y la configuración queda
congelada; una versión correctiva la reinicia y queda registrada) y se **cierra** (`closed`,
terminal: no se asignan visitantes nuevos, lo registrado se conserva). Lo abre, activa y
cierra un operador por la API de administración; el interruptor del merchant no cambia su
estado.
