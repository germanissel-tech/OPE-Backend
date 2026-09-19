---
es: mecanismo de correlación
en: correlation mechanism
contexto: medicion
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#5.1
uso: disponible
---

# mecanismo de correlación -> `correlation mechanism`

> **Mecanismo A como fuente autoritativa; B como corroboración y disparador; C nunca como autoridad.** — **DECIDIDO**

Cómo se vincula una orden con una sesión de OPE. **A**: la plataforma notifica la orden
servidor a servidor con el identificador de sesión que el storefront le adjuntó al crearla;
único mecanismo que atribuye. **B**: el SDK corrobora desde la página de confirmación;
evidencia, nunca autoridad. **C**: reconciliación diferida por ventana temporal e
identificadores débiles; fuera del MVP, nunca autoritativa. Qué mecanismo puede ofrecer un
merchant determina qué puede afirmar el piloto en él (03 §7 V4).
