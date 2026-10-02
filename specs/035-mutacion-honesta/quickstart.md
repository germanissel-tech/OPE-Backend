# Quickstart — verificar que el gate no informa cifras que no produjo (035)

Cinco pasos. **El paso 4 es el que ningún gate reemplaza**: provocar una corrida caída de verdad y leer la
última línea, que es como se lee el gate cuando tarda doce minutos.

## 1. La regla, sola

```bash
npx vitest run --project fast tests/governance/mutation-diff.test.ts
```

Dos grupos. **La regla**, con valores: código de salida distinto de 0 (el archivo no se mira ni para
descartarlo), código 0 sin reporte, código 0 con reporte anterior al arranque, el reporte de esta corrida, y
el borde de FR-005 —la misma fecha que el arranque cuenta como de esta corrida, que es el sesgo seguro—. Y
**la fecha de un archivo de verdad**, que es la mitad que ninguna prueba con números alcanza: que
`mtimeMs` sea comparable con el reloj. Un `Date` o segundos ahí harían ver todo reporte como ajeno, y el
gate se negaría a informar un veredicto que sí tenía.

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
# 1. Una corrida que sí termina, para que quede un reporte con cifras. **Con `--files` y no a secas**:
#    `npm run test:mutation` se saltea cuando el diff no toca `src/`, que es justo el caso de un cambio
#    de herramienta como éste, y entonces no deja ningún reporte que confundir después.
node scripts/mutation-diff.mjs --files src/domain/shared-kernel/rate.ts:1-20

# 2. Un tiempo de espera imposible para la corrida inicial, en la configuración, y el mismo comando.
#    Stryker sale distinto de 0 sin juzgar nada, con el reporte del paso 1 todavía en disco.
```

Con eso Stryker sale distinto de 0. Lo que tiene que verse, **en las dos rutas** —el gate y la barrida
informativa (`--all`), que es la que salía con éxito— es:

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

## La corrida del 2026-09-30 (histórica y fechada)

Los cinco pasos en esta máquina. Lo que encontró está corregido arriba, en el paso al que pertenece.

| Paso                       | Resultado                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1 · la regla sola          | 21 pruebas en el archivo de gobernanza, 9 de ellas nuevas                                            |
| 2 · el camino feliz        | `every mutant died.` en 14 min 20 s sobre `rate.ts`; con este diff, se saltea con su motivo          |
| 3 · la forma para máquinas | `{"gate":"mutation","mode":"blocking","status":"pass","findings":[]}`                                |
| 4 · la corrida caída       | `the mutation run did not finish (exit code 1); nothing on disk is its verdict`, exit 1, cero cifras |
| 5 · el último reporte      | `check:mutation-report` y `release-check: OK`                                                        |

Dos cosas que sólo aparecieron acá:

1. **El primer comando del paso 4 no producía ningún reporte**: `npm run test:mutation` se saltea cuando
   el diff no toca `src/`, que es exactamente el caso de un cambio de herramienta como éste. Sin reporte
   en disco no hay nada que el paso 4 pueda confundir, así que el paso no probaba lo que dice. Corregido a
   `--files`, que es cómo se consiguió el reporte de verdad.
2. **El modo informativo salía 0 con una corrida caída**, no sólo informaba cifras viejas. Estaba escrito
   en la spec como hipótesis de la fase 0 y acá se vio: ahora sale 1.

Y lo que confirmó: en las dos rutas, la condición que en la feature 034 imprimía cifras de otra corrida
ahora imprime por qué no hay veredicto, como **última línea** y sin ninguna cifra.

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
