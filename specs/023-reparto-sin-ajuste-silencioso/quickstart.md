# Quickstart — verificar que el reparto no se ajusta en silencio (023)

Cada fila la decide un comando.

## Antes de empezar

```bash
grep -n "x-stability" contracts/openapi.yaml   # tiene que decir building
```

**Si la marca de construcción ya no está, la feature se replantea**: sin ella, estrechar lo que la
operación acepta exige versión mayor y prefijo nuevo, y eso es otra conversación.

## Las garantías

### 1. El reparto declarado es el que ocurre

```bash
npx vitest run --project fast tests/unit/domain/experiment tests/integration/admin-experiments.test.ts
```

La prueba que importa recorre **los 101** valores de dos decimales y los acepta, y rechaza los cinco
de la spec. Si alguno de los 101 se rechaza, el juicio se está haciendo por división y no contra el
balde — es el error que esta feature existe para no cometer.

```bash
node -e 'for (const s of [0.07,0.14,0.28,0.29,0.47,0.56]) console.log(s, s/0.01)'
```

Los seis dan un número que **no** es entero. Ninguno de los seis puede rechazarse.

### 2. La huella de la asignación no se movió

```bash
npx vitest run --project fast tests/unit/domain/experiment/assignment-regression.test.ts
```

Los mismos visitantes, los mismos brazos. **Es el único lugar donde esta feature puede cambiar
comportamiento sin que nadie lo note. Si cambia, se para** — no se ajusta la prueba.

### 3. Un solo lugar sabe en cuántos baldes se divide la población

```bash
grep -rn "ASSIGNMENT_BUCKETS\|= 100\b" src/ --include=*.ts
```

Sólo `domain/experiment/experiment.ts`. Si aparece un segundo lugar —un epsilon, un `0.01`, un
`100` en otro módulo— la regla dejó de seguir a la resolución y FR-010 no se cumple.

### 4. El holdout se juzga igual

```bash
npx vitest run --project fast tests/unit/domain/configuration tests/unit/composition/config.test.ts
```

Y el arranque, que es el camino que no pasa por HTTP:

```bash
OPE_TREATMENT_DEFAULTS=/tmp/holdout-fino.json npm run dev
```

Con un holdout de `0.004` el servidor **no arranca** y dice `treatmentDefaults.holdoutShare`.

### 5. La feature no se derramó

```bash
grep -rn "marginShare\|incentiveLadderShare\|cuts" src/domain/commercial src/domain/experiment --include=*.ts | grep -i "bucket\|declarable"
```

Cero. Un margen de `0.375` y un corte de `0.125` siguen siendo válidos, y hay una prueba que lo dice
(SC-007). Si alguno se rechaza, la regla se aplicó donde no hay nada que cuantizar.

## Que nada más se movió

```bash
npm run format:check && npm run quality && npm run typecheck
npm test && npm run test:tools
npm run contract:check       # reporta incompatibles y los acepta por la marca; es lo esperado
npm run test:contract
npm run release-check        # avisa por la marca de construcción; es lo esperado
npm run test:mutation
```

En `contract:check` se mira **cuáles** cambios reporta, no cuántos: la descripción de
`treatmentShare`, la invariante nueva y el ejemplo de la `422`. Ningún campo agregado, quitado ni
renombrado. Si aparece un cuarto, se para.

## Dónde se toca qué, después de esto

| Si querés cambiar…                            | Se toca                                        |
| --------------------------------------------- | ---------------------------------------------- |
| la resolución del reparto (cuántos baldes)    | una constante; la regla la sigue sola          |
| qué tasa es declarable                        | el método estático que la juzga, un solo lugar |
| qué dice el rechazo                           | la clase del error y el título del catálogo    |
| si una tasa **nueva** queda sujeta a la regla | sólo si algo la cuantiza; si no, no            |
| cómo se muestra un reparto a una persona      | **nada de este repositorio**                   |

## Lo que esto **no** verifica

Que alguien no agregue mañana una tasa cuantizada sin sujetarla a la regla. No hay gate que lo
impida: hay un solo lugar que cuantiza y está a la vista. Si aparece un segundo consumidor de
`bucketsOf`, ahí se justifica una regla; hoy sería maquinaria para un caso que no existe.
