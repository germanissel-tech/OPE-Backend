# Eval: profile-picks-gateways

Fixture: `tests/audit/fixtures/profile-picks-gateways/src`.

**Defecto**: un perfil "por entorno" que conoce los gateways de todos los módulos y que "será
reemplazado por el de Postgres cuando llegue". Es el modo a nivel de archivo: un despliegue
mixto (Postgres para ledgers, Redis para dedup) obliga a una segunda copia o a un `if`, y la
decisión de implementación de cada puerto vive lejos de su módulo. Es el `profiles/memory.ts` (hoy `profiles/local.ts`)
anterior a la enmienda de ADR-013 sobre enlaces, condensado.

**Lo ve un gate**: sí — `arch/profiles-compose-modules` (`composition/profiles/` no importa
`interface-adapters/<módulo>/gateways/`). El gate da el archivo; la revisión pone la línea.

**Qué agrega la revisión cognitiva**: que un perfil es un *despliegue*, no un *entorno*: compone
una tabla de enlaces por módulo (`memoryLedgerPorts`, `postgresLedgerPorts(pool)`), cada una
en `composition/modules/<módulo>.ts` junto a lo que el módulo necesita y lo que sirve. Los
puertos son las interfaces; los gateways, las implementaciones; el perfil, la composición.

**Esperado**: `expected.json` (fuente `ADR-013`, severidad `high`, línea 20: la primera
entrada que elige un gateway de otro módulo).
