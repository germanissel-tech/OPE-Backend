# Eval: hardcoded-profile

Fixture: `tests/audit/fixtures/hardcoded-profile/src`.

**Defecto**: el composition root elige el perfil con un `if` sobre configuración, resuelve el
override del reloj por su cuenta e infiere el orden de cierre de `Object.values(ports)`. Es el
`bootstrap.ts` anterior a la feature 005, condensado.

**Lo ve un gate**: no. Ningún gate ve un `if` sobre configuración ni un orden inferido.

**Qué agrega la revisión cognitiva**: OCP en el root (ADR-013: perfil como parámetro), el orden
de cierre declarado por quien creó (`closables`), y los overrides resueltos por el perfil.

**Esperado**: `expected.json` (fuente `ADR-013`, severidad `high`). Un segundo hallazgo sobre el
orden de cierre (líneas 22–24) es correcto pero opcional: el esperado es el del perfil.
