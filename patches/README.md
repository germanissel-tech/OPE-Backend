# patches/ — parches a dependencias, con fecha de vencimiento

`patch-package` aplica en `postinstall` cada `<paquete>+<versión>.patch` de este directorio sobre
`node_modules/`. Un parche existe sólo mientras el upstream no publica el arreglo: es la forma de
**no degradar** una herramienta (la política del repositorio es la última versión de cada una:
parchear o convivencia oficial, nunca bajar de versión; ADR-016, ADR-017).

Cada parche declara en sus comentarios iniciales dos líneas que `tests/docs` exige:

- `# Fix: <qué arregla y la referencia al upstream>` (issue o PR).
- `# Retire: <condición para retirarlo>`.

## Cómo se retira un parche

1. Cuando el upstream publica el arreglo, subir la versión del paquete en `package.json`.
2. Borrar el archivo `.patch`.
3. `npm install`: `patch-package` falla si un parche ya no aplica, así que un bump de versión
   no puede dejar un parche viejo aplicándose en silencio.

## Inventario

| Entrada                                       | Qué es                                                                                                                                                                        | Fuente o derivado | Quién lo lee                          | Verificación                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `@stryker-mutator+vitest-runner+10.0.0.patch` | Arreglo de stryker-js#6210: el runner de Vitest construía ids de test que no coincidían con `testNamePattern`, y todo mutante cubierto se reportaba como sobreviviente (cambio de la PR #6214 aplicado al compilado). | fuente            | `patch-package` (`postinstall`)       | `tests/hooks/patches.test.ts`; `tests/docs` (`# Fix:` y `# Retire:`) |
