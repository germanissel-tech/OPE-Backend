---
es: credencial
en: credential
contexto: identidad
estado: aprobado
fuente: docs/adr/029-firma-de-plataforma.md
uso: pendiente
---

# credencial -> `credential`

> Las credenciales se generan del lado de OPE, se entregan una sola vez y ninguna lectura las devuelve. — **DECIDIDO** (2026-09-20, feature 017; ADR-031)

Tres clases por merchant: la **clave de ingesta** (`ingest`, pública, viaja en el tag), la
**clave de plataforma** (`platform`, servidor a servidor) y el **secreto de firma**
(`signing`, HMAC de cada notificación de la plataforma; ADR-029). Las claves se guardan por
**huella** (SHA-256) y no pueden recuperarse; el secreto se conserva protegido porque OPE lo
necesita para verificar la firma, y nunca se expone. Una **rotación** emite una credencial
nueva y da a la anterior una **gracia** declarada (tope de plataforma; por defecto ninguna);
como máximo dos vigentes por clase. Un merchant desactivado no tiene credenciales que valgan.
