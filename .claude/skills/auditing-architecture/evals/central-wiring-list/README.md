# Eval: central-wiring-list

Fixture: `tests/audit/fixtures/central-wiring-list/src`.

**Defecto**: el composition root enumera en dos mapas centrales (`buildUseCases`,
`wireControllers`) todos los casos de uso y todos los controllers del sistema. Hoy son tres
entradas; con diez módulos y cien operaciones es el archivo de 93 rutas de la POC
(constitución I): cada operación nueva de cualquier módulo edita este archivo. Es el
`bootstrap.ts` posterior al primer refactor de la 005, condensado.

**Lo ve un gate**: sí — `arch/composition-wires-by-module` (`composition/` fuera de `modules/`
no importa controllers, security handlers ni casos de uso). El gate no da línea: la revisión
la pone.

**Qué agrega la revisión cognitiva**: que "son tres" no refuta nada (la lista crece con cada
operación, no con cada módulo) y la forma correcta: cada módulo se cablea solo en
`composition/modules/<módulo>.ts` y el root sólo conserva la lista de módulos (`MODULES`),
como `CONTEXT_MAP` (ADR-013, enmienda).

**Esperado**: `expected.json` (fuente `ADR-013`, severidad `high`). La línea es la primera
entrada del mapa de controllers; un hallazgo equivalente sobre `buildUseCases` (línea 22) es
correcto pero opcional.
