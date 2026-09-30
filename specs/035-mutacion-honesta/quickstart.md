# Quickstart — verificar que el gate no informa cifras que no produjo (035)

Cinco pasos. **El paso 4 es el que ningún gate reemplaza**: provocar una corrida caída de verdad y leer la
última línea, que es como se lee el gate cuando tarda doce minutos.

## 1. La regla, sola

```bash
npx vitest run --project tools tests/governance/mutation-diff.test.ts
```

Los tres casos nuevos: código de salida distinto de 0 (el archivo no se mira), reporte con fecha anterior al
arranque con código 0, y el reporte de esta corrida, que se lee. Más el borde de FR-005: **la misma fecha
que el arranque cuenta como de esta corrida**, que es el sesgo seguro.

## 2. El camino feliz no cambió de texto

```bash
npm run test:mutation
```

Sobre un árbol limpio el gate se saltea con su motivo; con un cambio en `src/` corre y termina en
`test:mutation — every mutant died.` o en la lista de supervivientes con `archivo:línea: mensaje`. **Esa
línea es la que quien lee el gate todos los días reconoce**, y FR-007 dice que es idéntica a la de antes.

## 3. La forma para máquinas, que es la que consume la auditoría

```bash
node scripts/mutation-diff.mjs --json
```

Un objeto con `gate`, `mode`, `status`, `findings` y, cuando no hay veredicto, `error`. El adaptador
`scripts/audit/gate-mutation.mjs` ya hace `fail(parsed.error)`, así que el motivo llega al reporte de
auditoría sin que nada más cambie — se puede ver corriendo la skill de auditoría con `--diff`.

## 4. Una corrida caída de verdad

Éste es el paso que encontró el defecto en la feature 034, y la forma de reproducirlo es la que lo
encontró: **hacer que Stryker no llegue a juzgar**, con un reporte anterior en disco.

```bash
# 1. Una corrida que sí termina, para que quede un reporte con cifras.
npm run test:mutation

# 2. Una corrida que no puede terminar: un tiempo de espera imposible para la corrida inicial.
npx stryker run stryker.config.json --dryRunTimeoutMinutes 0.05
```

Con eso Stryker sale distinto de 0. Corriendo el gate en esa condición —la forma directa es dejar el
tiempo de espera imposible en la configuración por un momento y correr `npm run test:mutation`— lo que
tiene que verse es:

```
test:mutation — the mutation run did not finish (exit code N); nothing on disk is its verdict.
```

y **ninguna** línea de supervivientes. Antes de esta feature, ahí aparecían las cifras de la corrida del
paso 1.

> **Lo que se está comprobando no es que Stryker se caiga**, que es fácil, sino que el gate **no rellene**
> el hueco con lo que había antes. La última línea es el criterio (SC-002): a los doce minutos nadie lee el
> medio de la salida.

## 5. El modo que revisa el último reporte sigue funcionando

```bash
npm run check:mutation-report
npm run release-check
```

`--check-report` mira el **último** reporte a propósito: no corre Stryker y la frescura no le aplica
(research R-01). Es la parte del diseño más fácil de romper sin darse cuenta, porque el fallo aparecería al
final de la cadena y no acá — por eso se corre en el quickstart.

---

## Lo que este quickstart **no** puede mostrar

- **Que ninguna otra forma de corrida caída informe cifras.** Se verifican las dos que se vieron —un tiempo
  de espera y un hook que pasa su tiempo— y la regla cubre la clase por el código de salida, pero «toda
  forma en que Stryker puede fallar» no es una lista que nadie tenga.
- **Que el reporte nunca quede con una fecha engañosa** por algo del sistema de archivos. La comparación
  elige el sesgo seguro (FR-005), y lo que eso cede es el caso extremo de un reporte escrito en el mismo
  milisegundo que el arranque de la corrida siguiente, que en una corrida de minutos no ocurre.
- **Por qué se cayó la corrida.** Lo dice Stryker en su propia salida, que se hereda en la terminal; el
  gate no la repite (research R-05) y no va a explicarla.
