# Quickstart — verificar el porcentaje como valor (022)

Cada fila la decide un comando.

## Antes de empezar

La feature sale de `021-plano-de-decoracion`, que sale de `020-grafo-de-composicion`. Ninguna está
en `main`:

```bash
git log --oneline main..HEAD | wc -l    # 0 si ya están mergeadas
```

## Las garantías

### 1. Un porcentaje no puede pasar por una tasa

```bash
npx vitest run --project fast tests/typecheck
```

El fixture de esta feature tiene que fallar nombrando el tipo, junto a los de la 020 y la 021.

Y la comprobación que da nombre a todo esto:

```bash
npx vitest run --project fast tests/unit/domain/shared-kernel
```

| Entrada                                                | Qué tiene que pasar             |
| ------------------------------------------------------ | ------------------------------- |
| `Percent.of(1).rate()`                                 | **0,01** — nunca 1              |
| `Percent.of(0).rate()`                                 | 0                               |
| `Percent.of(100).rate()`                               | 1                               |
| `Percent.of(101)`, `Percent.of(-1)`, `Percent.of(0.5)` | rechazado, nombrando el campo   |
| `Percent.fromRate(0.005).value`                        | el redondeo de hoy, sin cambios |

Los casos **0 y 1** no son cortesía: son los dos valores donde un porcentaje también es una tasa
válida, y por eso la confusión era invisible.

### 2. Una sola conversión en todo el repositorio

```bash
grep -rn "/ 100\|\* 100\|PERCENT_PER_UNIT" src/ --include=*.ts
```

Sólo lo que esté dentro del valor. La granularidad del reparto aparece con **su nombre nuevo**, que
dice lo que es.

```bash
grep -rn "isPercent" src/ --include=*.ts      # 0 fuera del kernel
```

### 3. El vocabulario de estados, una vez

```bash
grep -rn '"calibrating"' src/ --include=*.ts
```

Una sola declaración, en el módulo dueño; el tipo derivado de ella.

### 4. La asignación no se movió

```bash
npx vitest run --project fast tests/unit/domain/experiment
```

El fingerprint de regresión de la feature 007 tiene que dar exactamente lo mismo. **Si cambia, algo
tocó el reparto en cubetas y hay que parar**: es el único lugar donde esta feature podría alterar
comportamiento sin que nadie lo note.

## Que nada más se movió

```bash
npm run contract:check      # contract:diff en cero
npm test                    # sin tocar una aserción preexistente
npm run test:tools
npm run quality
npm run test:mutation
```

Las pruebas de configuración (42 aserciones sobre rutas de campo) y las de políticas son el juez de
que los mensajes de error y los campos que nombran quedaron iguales.

## Dónde se toca qué, después de esto

| Si querés cambiar…               | Se toca                                                  |
| -------------------------------- | -------------------------------------------------------- |
| qué es un porcentaje válido      | el valor, una vez                                        |
| el redondeo de salida            | el valor, una vez                                        |
| la granularidad del reparto      | su propia constante, que ya no se confunde con el factor |
| agregar un estado de experimento | el array del módulo dueño; el resto se deriva            |

## Lo que esto **no** verifica

Que alguien no vuelva a escribir un `/ 100` en un archivo nuevo. No hay gate que lo impida: lo que
hay es que **ya no queda ninguno al que copiarle**, y que el tipo del valor hace que la conversión
manual no tenga a dónde ir. Si con el tiempo aparecen otra vez, el gate se justifica; hoy sería una
regla para un problema que el tipo ya resuelve.
