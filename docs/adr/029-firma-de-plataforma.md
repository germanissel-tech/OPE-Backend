---
numero: 29
titulo: Firma HMAC del cuerpo para la credencial de plataforma
estado: aceptada
fecha: 2026-09-19
fuente: specs/013-outcomes-ordenes-y-devoluciones/research.md
---

# ADR-029 — Firma HMAC del cuerpo para la credencial de plataforma

## Contexto

`platformKey` (ADR-020 §1, ADR-025 §5) es una clave secreta servidor a servidor por merchant,
sobre TLS. ADR-020 dejó PROPUESTA la firma HMAC del cuerpo con ventana temporal, y el
stakeholder decidió (2026-09-18) que entra con el primer adaptador real o con las órdenes
(013), lo que llegue primero. Las órdenes son el primer dato con interés económico en
falsificarse o repetirse: una clave filtrada o un cuerpo capturado bastarían.

## Decisión

1. **Secretos de firma por merchant**, distintos de las claves: `OPE_MERCHANTS[i].platformSecrets`
   (uno o dos, rotación), validados por `Merchant.of` (`invalid-platform-secret`).
2. **Esquema `v1`**: headers `X-OPE-Timestamp` (segundos Unix) y `X-OPE-Signature` (`v1=` +
   hex de `HMAC-SHA256(secret, "<timestamp>.<cuerpo crudo en bytes>")`). El cuerpo se firma
   byte a byte como se envía; ninguna canonicalización.
3. **Ventana** de ±300 s contra el reloj del servidor; comparación en tiempo constante; se
   acepta cualquiera de los secretos activos.
4. **Obligatoria por merchant, para toda la credencial**: con secreto configurado, toda
   operación con `platformKey` (catálogo, órdenes, devoluciones) exige firma; sin secreto,
   sólo la clave (compatibilidad con la 010). Errores `401`: `signature-missing`,
   `signature-invalid`, `signature-expired`.
5. **Antes del cuerpo**: la verifica el security handler de `platformKey` después de resolver
   el merchant y antes de que se valide el body o corra un caso de uso. La infraestructura
   conserva los bytes crudos del JSON para ello. La autenticación sigue siendo un servicio de
   aplicación (`PlatformSignatureVerifier`) con el HMAC detrás de un puerto
   (`MessageAuthenticator`, `node:crypto` en el gateway); el dominio (`PlatformSignature`)
   parsea, compara y juzga la ventana.
6. **Contrato**: los dos headers son parámetros reutilizables declarados en toda operación
   de plataforma (regla `ope-platform-signature-headers`); `platformKey.yaml` describe el
   esquema; los headers de firma se redactan en logs como toda credencial.

## Consecuencias

- Un adaptador de plataforma implementa la firma con una función de su lenguaje (ejemplo en
  `specs/013-outcomes-ordenes-y-devoluciones/contracts/platform-signature.md`); el script
  `scripts/sign-platform-request.mjs` la produce para curl e Insomnia.
- Un JSON sintácticamente inválido falla `400` antes que la firma: no revela nada y no cambia
  el resultado para un remitente legítimo.
- Cambiar el esquema de firma es un `v2=` nuevo aceptado junto al `v1=` durante la
  transición, no un cambio incompatible del contrato.
