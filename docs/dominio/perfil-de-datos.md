---
es: perfil de datos
en: data-profile
contexto: plataforma
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#14.1
uso: disponible
---

# perfil de datos -> `data-profile`

> **El perfil se mide, no se declara.** El nivel efectivo es el **mínimo entre lo configurado y lo observado**.

Nivel de sincronización de stock del merchant: 0 sin datos, 1 volcado diario, 2 actualización
en minutos, 3 notificación por cambio. OPE deriva el nivel **observado** de la cadencia de
instantáneas y la edad de la vigente (`observedSyncLevel`), y degrada solo cuando la cadencia se
rompe; 3 no se alcanza con instantáneas completas. Lo que cada nivel habilita y el mínimo con
lo configurado llegan con la feature de configuración por API.
