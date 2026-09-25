# Eval: controller-instantiates-infra

Fixture: `tests/audit/fixtures/controller-instantiates-infra/src`.

**Defecto**: un controller construye su propia infraestructura (`new Ajv(...)`, un validador de un paquete npm).

**Lo ve un gate**: sí — `shape` (regla 3, `new` de un paquete npm fuera de composición) y `arch`
(`adapters-inward`, si el import fuera de infraestructura propia).

**Qué agrega la revisión cognitiva**: nombrar el puerto que falta (`ExposureLedger`), dónde se
cablea (`composition/deployments`) y la prueba de aislamiento por merchant que el cliente directo
saltea (constitución V).

**Esperado**: `expected.json` (fuente `constitution#I`, severidad `high`).
