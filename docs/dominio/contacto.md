---
es: contacto
en: contact
contexto: identidad
estado: aprobado
fuente: docs/adr/045-el-merchant-con-identidad.md
---

# contacto -> `contact`

> La persona de contacto no es una persona observada: es parte del contrato de negocio, como el operador. — **DECIDIDO** (2026-10-09, feature 041; ADR-045; constitución VII 1.5.1)

La persona con la que OPE lleva la relación comercial con un merchant: nombre, email, teléfono
opcional y rol opcional (`MerchantContact`), anotada por un operador como parte de la **identidad
del merchant** (`contact`, junto a `displayName`, `storeUrl` y `notes`) y reemplazada entera con
`updateMerchantProfile`. Es una **persona identificada de la relación comercial**, la segunda del
sistema después del operador: sabe que OPE la tiene registrada y para qué. No es el visitante ni el
comprador, que son las personas que la constitución VII observa y protege.

Sus datos se sirven **sólo** al consumidor `admin` y no entran en ninguna decisión, en lo que ve el
SDK o la plataforma, en el registro de administración (que registra qué cambió y quién, no los
valores) ni en los registros del servidor. El lint de datos personales los prohíbe en todo esquema
del contrato salvo en `MerchantContact`, donde la excepción se declara con nombre y razón por
propiedad. Uno por merchant; la retención y el borrado de sus datos siguen siendo D5 (ADR-010).
