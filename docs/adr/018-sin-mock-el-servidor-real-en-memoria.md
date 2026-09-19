---
numero: 18
titulo: "Sin servidor mock: el servidor real con el perfil en memoria"
estado: aceptada
fecha: 2026-09-17
fuente: sesión (revisión de src/composition/bootstrap.ts con el usuario)
reemplaza: 5
---

# ADR-018 — Sin servidor mock: el servidor real con el perfil en memoria

## Contexto

ADR-005 decidió que el mock fuera "el mismo servidor en modo mock" (`OPE_MOCK=1`): sin
handlers, respondiendo el ejemplo del contrato para cada operación. Tenía sentido cuando el
repo no tenía dominio ni perfil en memoria y era lo único que corría. Desde la 004 el servidor
real arranca con el perfil local (`profiles/local.ts`) sin infraestructura, valida, autentica y responde las tres
operaciones con comportamiento real (dedup, invariantes, `NO_OP` con motivo).

Al revisar el composition root aparecieron los costos del modo: `config.mode` consultado en
tres capas (`config.ts`, `bootstrap.ts`, `build-server.ts`), un merchant con clave conocida
embebido en código, una segunda instancia de openapi-backend sólo para ejemplos, y un
concepto —"responder ejemplos"— que no es un puerto ni una implementación de ninguno: es un
doble de toda la aplicación detrás del borde HTTP, y no encaja en los anillos. Además tiene
**menos** fidelidad que el servidor real: el SDK desarrollando contra el mock no ve un 422 por
invariante ni un duplicado, y sí los ve en producción. La única ventaja que quedaba —servir
una operación declarada y no implementada— ya no existe en `main`: el arranque es fail-closed
(ADR-013, enmienda) y `shape` exige un controller por operación.

## Decisión

1. **No hay servidor mock.** `npm run contract:mock`, `OPE_MOCK`, `ServerMode` y el merchant
   embebido se retiran. El servidor real con el perfil en memoria es lo que el SDK y el portal
   usan para desarrollar contra el contrato (SC-006 de la 004 se cumple con `npm run dev`).
2. **`npm run dev` recibe un merchant de desarrollo por archivo**
   (`OPE_MERCHANTS_FILE=config/dev-merchants.json`), explícito en el script. Nunca un default
   en código: un servidor real sin merchants configurados no autentica a nadie (fail-closed).
3. **Contract-first dentro de una rama**: si el contrato llega antes que el caso de uso, el
   módulo cablea un controller stub tipado por el contrato que devuelve el ejemplo, y la misma
   feature lo reemplaza. Es visible en el diff y no necesita un modo.
4. **El servidor no conoce modos**: una operación sin handler es 501 (FR-044 de la 001) y el
   composition root no arranca si el contrato declara una que ningún módulo sirve.
5. Regla de forma `no-config-branch-in-root` (`scripts/shape-rules.mjs`, regla 5): en
   `composition/` nadie decide sobre un campo de configuración; leer un campo para pasarlo
   (`config.port`) sí, `config.ts` parsea y está exento.

## Consecuencias

- Reemplaza a ADR-005. ADR-001 sigue valiendo para el servidor real (el mock ya no existe).
- El perfil en memoria (`profiles/local.ts`) no es un perfil para tráfico: sus ledgers
  (decisiones, asignaciones, exposiciones, órdenes, corroboraciones) no podan porque
  sustituyen al ledger durable de 01 §9; sólo el estado caliente (dedup, sesión, visitante)
  tiene ventana. La feature de persistencia del mapa trae el perfil real (2026-09-19,
  auditoría 014 F-047).
- Desaparecen `tests/integration/mock.test.ts` y las pruebas "en modo mock"; la fidelidad que
  probaban (mismo 400, mismo 404) es trivial: es el mismo código.
- `bootstrap(config, { profile?, modules?, ports?, handlers? })`: los cuatro seams de
  inyección los usan las pruebas y las herramientas del contrato (la prueba negativa de
  `test:contract` pasa `handlers`); el producto no los toca.
- Toda respuesta exitosa sigue necesitando ejemplo en el contrato (`ope-success-response-example`):
  lo consumen la documentación y los tipos, no un servidor.
