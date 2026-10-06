# Quickstart — verificar que la durabilidad se verifica (039)

Cinco pasos. **El paso 4 es el que ningún gate reemplaza**: romper a propósito una garantía que sólo se ve
cruzando un reinicio y comprobar que lo que la atrapa nombra la durabilidad.

## 1. Las dos categorías cubren todo, y la declaración no miente

```bash
npm run check:suite-coverage
npx vitest run --project fast tests/governance/suite-coverage.test.ts
```

La verificación sobre el repositorio de verdad y sobre sus fixtures: un archivo de durabilidad sin clasificar
falla nombrándolo, y una medición declarada que ya no existe también.

## 2. Lo que decide corre, y corre solo

```bash
npm run test:durability
```

Las 20 de comportamiento, un archivo a la vez. **No** tiene que correr ninguna de las tres mediciones: si la
duración se parece a los 207 s de antes de la feature en vez de a ~165 s, están entrando.

## 3. Las mediciones se pueden correr cuando alguien quiere el número

```bash
npm run test:measures
```

Las tres de durabilidad, con sus cifras. Es lo que no existía: hacía tres features que no se ejecutaban
fuera de la máquina de quien las escribió.

**Las cifras se imprimen con `console.info` y el reporter por defecto las esconde**, así que para leerlas hay
que pedirlas:

```bash
npx vitest run --project measures --silent=false --reporter=verbose
```

Lo que dieron el **2026-10-06** en esta máquina, que es la primera vez que se corren desde la feature 034:

| Medición                                                     | Cifra                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Escritura durable en el camino crítico                       | memoria p95 **1,63 ms**, sqlite p95 **7,13 ms**, delta **5,50 ms**                                           |
| Lo mismo con 20 merchants, resolviendo el último             | memoria p95 **1,19 ms**, sqlite p95 **5,90 ms**, delta **4,71 ms**                                           |
| Lo que cuesta reconstruir una sesión                         | reconstruida p95 **29,33 ms**, de memoria p95 **27,68 ms**, delta p95 **1,65 ms**                            |
| Lo que una acción de administración le cuesta a una decisión | quieto p95 **6,91 ms**, bajo 130 lecturas **13,32 ms**, bajo 66 acciones **18,41 ms**; turno p95 **5,08 ms** |

Las cuatro pasan sus techos. Anotarlas acá es la mitad que hace que la categoría sirva: una medición que
nadie corre no mide nada, y una que corre y nadie anota tampoco.

## 4. Romper una garantía y ver quién lo atrapa

Éste es el paso que ningún gate reemplaza.

```bash
# Que una entidad vuelva del almacén como registro plano, que es el defecto que la 037 cerró:
#   en un gateway durable, reemplazar `Entidad.rehydrate(registro)` por el registro crudo.
npm run test:durability
```

Lo que tiene que pasar: **falla**, y lo que informa nombra el proyecto de durabilidad. Antes de la feature,
ese mismo cambio llegaba a CI y lo atrapaba el **arranque del job de mutación** — el mismo rojo que aparece
cuando Stryker se queda sin tiempo o sin memoria, que es el peor lugar donde buscar.

Después, en CI, el rojo es un job con nombre propio.

**Corrido el 2026-10-06** (T009), reemplazando `Order.rehydrate(...)` por el registro crudo en
`sqlite-order-ledger.ts`. Lo atraparon **tres** pruebas de `tests/durability/outcomes.test.ts`, y las tres
dicen qué se rompió:

- «reads the order back with its money, its lines and its instants»
- «calls the same notification a repeat, and a different one a conflict, after the restart»
- «records a return after the restart, and calls a repeated one a repeat»

Ninguna prueba del proyecto `fast` se enteró, que es el motivo por el que esta suite es la única cobertura de
esos gateways.

## 5. El workflow lo dice, y la cadena entera sigue verde

```bash
npx vitest run --project fast tests/hooks/ci.test.ts
npm run quality
npm run test:all
npm run contract:check && npm run release-check
```

`test:all` tiene que seguir corriendo **todo**, mediciones incluidas: el comando local de cierre de una
historia no cambia de alcance porque CI haya elegido qué exigir. Y `contract:check` tiene que estar verde
**sin cambios en `contracts/`**: si algo ahí cambió, esta feature se salió de su alcance.

## 6. Usarlo: el job nuevo en CI

```bash
git push
"C:\Program Files\GitHub CLI\gh.exe" run list --limit 1
"C:\Program Files\GitHub CLI\gh.exe" run view <id>
```

Lo que hay que ver:

- **tres jobs** donde antes había dos (más el semanal), y el nuevo con nombre propio;
- el reloj de pared del run **no empeora** (SC-004): lo sigue dominando la mutación;
- el job nuevo pasa sin `fetch-depth: 0` ni `main` traído: no compara contra nada.

Anotar la duración del job nuevo al lado de los 207 s / ~165 s de esta máquina: es el primer dato de cuánto
cuesta la durabilidad donde CI corre, y hasta ahora no existía.

---

## Lo corrido (2026-10-06)

Los pasos 1 a 5, en esta máquina, con la feature entera:

| Paso                              | Resultado                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. las dos categorías cubren todo | `check:suite-coverage` — **226 archivos**, todos los corre algún proyecto; 11 casos de su prueba en verde                                                    |
| 2. lo que decide corre solo       | `test:durability` — **20 archivos, 193 pruebas, 143 s** (era 23 / 197 / 207)                                                                                 |
| 3. las mediciones se corren       | `test:measures` — **3 / 4 / 41 s**, con sus cuatro cifras arriba                                                                                             |
| 4. romper una garantía            | tres pruebas de `outcomes.test.ts` la atraparon; ninguna del proyecto `fast`                                                                                 |
| 5. el workflow y la cadena        | `ci.test.ts` 6 casos, `quality` **8 gates**, `test:all` **2008 pruebas en 226 archivos**, `contract:check` y `release-check` en verde, `test:contract` 36/36 |

**Y el gate de mutación dijo lo que el plan predijo**: `test:mutation — skipped: no production lines`. La
feature no toca `src/`, así que no hay mutante que juzgar — que es la forma de comprobar que se quedó dentro
de su alcance, además de que `contract:check` pasó sin un solo cambio en `contracts/`.

**Dos cosas que aparecieron corriéndolo**, las dos sobre el propio quickstart:

- El paso 1 nombraba el proyecto equivocado: la prueba del gate vive en `tests/governance/` y ésa es del
  proyecto `fast`, no de `tools` (de `governance/` sólo `quality.test.ts` es de `tools`). Corregido.
- El paso 3 pasaba en verde **sin mostrar un número**: el reporter por defecto esconde el `console.info` de
  las mediciones. Ahora el paso dice cómo pedirlas.

---

## Lo que este quickstart **no** puede mostrar

- **Que un cambio en rojo no se pueda mergear.** No se puede: `main` no tiene protección de rama (**D-35**).
  Lo que se muestra es que el rojo aparece y dice qué falló; que eso impida el merge es una configuración del
  repositorio y una decisión del dueño.
- **Que el techo de las mediciones valga en CI.** Por eso no son gate: nadie midió esos techos en un runner, y
  medirlos es su propia tarea con su propia evidencia (ADR-038 es el precedente).
- **Que ninguna otra prueba del repositorio corra en ningún lado.** La verificación cubre
  `tests/durability/`, que es donde el hueco existía; si mañana otro proyecto gana exclusiones escritas a
  mano, el hueco vuelve en otro lugar y lo que lo evitaría es extender la misma regla, no esta corrida.
