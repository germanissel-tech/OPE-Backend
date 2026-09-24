# Quickstart — verificar que el backend habla en tasas (022)

Cada fila la decide un comando.

## Antes de empezar

```bash
git log --oneline main..HEAD | wc -l          # las tres ramas encadenadas, si siguen sin mergear
grep -n "x-stability" contracts/openapi.yaml  # tiene que decir building
```

**Si la marca de construcción ya no está, la feature se replantea**: sin ella un cambio
incompatible exige versión mayor y prefijo nuevo, y eso es otra conversación.

## Las garantías

### 1. Ningún campo del contrato habla en porcentajes

```bash
grep -rn "Percent\|percentage" contracts/ --include=*.yaml | grep -v "^contracts/dist"
```

Lo único que puede quedar es la descripción del **tipo** de incentivo, que sigue llamándose así
porque describe la clase de descuento y no la unidad.

```bash
npm run contract:check
```

`contract:diff` **va a reportar cambios incompatibles y los va a aceptar** por la marca de
construcción: eso es lo esperado. Lo que hay que mirar es **cuáles**: los ocho campos y ninguno
más.

### 2. No queda ninguna conversión

```bash
grep -rn "/ 100\|\* 100\|PERCENT" src/ --include=*.ts
grep -rn "isPercent" src/ --include=*.ts      # 0
```

Sólo puede aparecer la granularidad del reparto, **con su nombre nuevo** y su motivo al lado.

### 3. La asignación no se movió

```bash
npx vitest run --project fast tests/unit/domain/experiment
```

La prueba de regresión de la feature 007 tiene que dar exactamente los mismos brazos para los mismos
visitantes. **Es el único lugar donde esta feature puede cambiar comportamiento sin que nadie lo
note. Si cambia, se para** — no se ajusta la prueba.

Se corre **cuando se toca la granularidad**, no al final.

### 4. El vocabulario de estados, una vez

```bash
grep -rn '"calibrating"' src/ --include=*.ts
```

Una sola declaración, en el módulo dueño; el tipo derivado de ella.

## Que nada más se movió

```bash
npm run format:check && npm run quality && npm run typecheck
npm test && npm run test:tools
npm run test:contract        # Schemathesis contra los esquemas nuevos
npm run release-check        # avisa por la marca de construcción; es lo esperado
npm run test:mutation
```

Las pruebas de configuración y de políticas son el juez de que los mensajes de error siguen
nombrando el campo correcto — ahora con el nombre nuevo.

## Los datos versionados

```bash
grep -rn "Percent" config/ tests/**/fixtures/ 2>/dev/null
```

Cero. Y los valores tienen que ser coherentes: lo que era `30` ahora es `0.3`.

**Este es el paso que más fácil se olvida**, y el juez de tasas no lo cubre del todo: atrapa lo que
supera 1, pero **no atrapa el 1**. Un `holdoutPercent: 1` que quede escrito como `holdoutShare: 1`
es un holdout del 100 % que pasa toda la validación. Revisar valor por valor.

## Dónde se toca qué, después de esto

| Si querés cambiar…                    | Se toca                                             |
| ------------------------------------- | --------------------------------------------------- |
| qué es una fracción válida            | el único predicado que queda                        |
| la resolución del reparto             | su propia constante, que ya no se confunde con nada |
| agregar un estado de experimento      | la lista del módulo dueño; el resto se deriva       |
| cómo se muestra un 15 % a una persona | **nada de este repositorio**                        |

## Lo que esto **no** verifica

Que alguien no vuelva a introducir una conversión en un archivo nuevo. No hay gate que lo impida:
lo que hay es que **no queda ninguna a la que copiarle** y que el contrato ya no tiene la otra
unidad. Si con el tiempo reaparecen, el gate se justifica; hoy sería una regla para un problema que
la decisión ya resolvió.

## Estado al cierre de la implementación (2026-09-24)

Histórico y fechado, como pide la convención de documentación viva.

| Verificación                                           | Resultado                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `Percent` en `contracts/*.yaml`                        | 0                                                                    |
| `isPercent` / `PERCENT` / `PERCENT_PER_UNIT` en `src/` | 0                                                                    |
| `Percent` en `config/`                                 | 0                                                                    |
| Campos que reporta `contract:diff`                     | los ocho y ninguno más                                               |
| `contract:diff`                                        | 43 incompatibles, aceptados por `info.x-stability: building` (1.5.0) |
| Regresión de asignación (huella de la 007)             | 5 pruebas, sin tocar una cifra                                       |
| Un reparto de `0.01`                                   | reparte el uno por ciento (prueba nueva)                             |
| Estados de experimento declarados                      | una vez, en `domain/experiment/`; el tipo derivado                   |
| Patrón de `ExperimentId`                               | réplica del contrato, con el motivo escrito y su prueba              |
| `npm test` (`fast`)                                    | 1296                                                                 |
| `test:tools`                                           | 58                                                                   |
| `quality`                                              | 7 gates                                                              |
| `test:contract`                                        | 29/29 operaciones, 10 245 casos                                      |
| `release-check`                                        | OK (avisa por la marca de construcción, es lo esperado)              |

**Aserciones de comportamiento preexistentes modificadas: tres grupos, todos previstos por el
plan.** Las cinco filas que exigían un entero y la fila `[12.5]` de los cortes desaparecen —ser
entero era una propiedad del porcentaje, no de la tasa— y la huella del contenido de
`treatment-defaults.json` se recalcula conservando su versión, porque cambió la representación y no
la política. Todo lo demás cambió de unidad y de nombre de campo, nada más.

**Encontrado de paso**: `scripts/load-test.mjs` sembraba un experimento sin `targetSample`, así que
`npm run test:load` no arrancaba el servidor desde la feature 017. Arreglado y verificado
(1049 lotes/s).
