---
es: configuración de plataforma
en: platform-configuration
contexto: plataforma
estado: aprobado
fuente: constitucion#XI
uso: pendiente
---

# configuración de plataforma -> `platform-configuration`

> Nivel plataforma: reglas de OPE que el contrato publica o de las que depende la seguridad. Configuración global del despliegue, versionada; nunca por merchant. — **DECIDIDO** (constitución XI)

El primer nivel: ventana de deduplicación, tolerancia de reloj, memoria de sesión y de
visitante, ventana de la firma, gracia máxima de una rotación, tope de diagnósticos por
merchant. Vive en `config/platform.json`, **viaja con el release** (cambiarlo es un deploy,
no una operación), declara su `version`, se valida al construir el release y se lee por
`GET /v1/admin/platform-configuration`. No existe operación para modificarlo en caliente. Qué es
cada campo lo dice el contrato (`PlatformConfiguration`) y su esquema generado
(`generated/schemas/platform-configuration.schema.json`, que el archivo referencia en `$schema`);
quién lo lee y cuándo, `config/README.md`.
