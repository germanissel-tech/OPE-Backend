# Quickstart — verificar que el registro es verdad y las cuatro están cerradas (026)

Cada fila la decide un comando, salvo la última, que la decide leer.

## 1. El registro existe donde se lo busca

```bash
ls docs/deudas.md && grep -c "^| D-" docs/deudas.md
```

Al menos diez filas: las seis de la 019 más las cuatro nuevas. Serán más si al separar apareció
alguna — que es lo que se espera de un registro que funciona. Y su fila en el inventario:

```bash
grep -c "deudas.md" docs/README.md      # 1
npx vitest run --project tools tests/docs/readmes.test.ts
```

Sin la fila, la prueba del inventario falla. **Es ADR-032 aplicándose al registro que la feature
019 nunca puso bajo esa regla**, que es parte de por qué se escondió.

## 2. Ninguna sección queda declarada mixta

```bash
node -e 'const p=require("./scripts/instructions-policy.json");
const m=p.files.flatMap(f=>f.sections.filter(s=>s.kind==="mixed").map(s=>f.file+" · "+s.heading));
console.log(m.length?m.join("\n"):"ninguna");'
```

**Ninguna.** Si queda alguna, tiene que tener su fila en el registro y su motivo — y eso se enumera
en el cierre, no se deja pasar.

## 3. El núcleo bajó y sigue bajo su umbral

```bash
wc -l CLAUDE.md && npm run check:instructions
```

Menos de 195 y menos de 200. La serie: 360 → 675 → 573 → 195 → …

## 4. Nada se perdió

```bash
git log --oneline 026-deudas-de-las-instrucciones --   docs/adr/
git log --oneline 026-deudas-de-las-instrucciones -- CLAUDE.md .claude/rules/
```

Por cada separación, el commit que **agrega** al destino va antes del que **borra** del origen. Si
están en el mismo commit, el diff no muestra que nada se perdió: se rehace.

La revisión es **por bloque, no por total**: un total que cierra puede esconder un bloque entero.

## 5. Lo descriptivo no quedó duplicado

```bash
grep -c "EffectiveConfiguration" CLAUDE.md docs/adr/031-*.md
grep -c "cognitive-complexity" .claude/rules/gates-de-calidad.md eslint.config.mjs
grep -c "MAX_RING_FILE_LINES" .claude/rules/anillos-y-modulos.md scripts/shape-rules.mjs
```

En cada par, **uno y sólo uno**. Mudarlo y dejarlo también en el origen sería duplicarlo, que es la
deuda que esto viene a cerrar.

## 6. El procedimiento está donde se lo ejecuta

```bash
ls .claude/skills/
npx vitest run --project tools tests/audit/skills-isolation.test.ts
```

La skill nueva, y el aislamiento en verde: **no importa nada del repositorio por ruta**. Y la regla
conserva el puntero:

```bash
grep -n "mutante" .claude/rules/gates-de-calidad.md
```

## Que nada más se movió

```bash
npm run format:check && npm run quality && npm run typecheck
npm test && npm run test:tools
npm run contract:check && npm run release-check
```

**Las pruebas del producto no se mueven.** Esta feature no toca `src/` ni el contrato; si alguna
cambia, hay algo mal entendido y se para.

## 7. Lo que ningún comando decide

Por cada separación, leer **lo que quedó** y preguntarse si un agente puede obedecerlo sin lo que se
fue. Si no puede, el bloque vuelve y su deuda queda registrada con el motivo — cerrar una deuda por
decreto es peor que dejarla anotada.

## Dónde se toca qué, después de esto

| Si querés…                           | Se toca                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| anotar una deuda nueva               | una fila en el registro, no el lugar donde estás trabajando |
| cerrar una deuda                     | su estado y su referencia de cierre                         |
| cambiar un umbral de calidad         | su configuración, que es su fuente                          |
| agregar un módulo                    | el mapa de contextos; ninguna instrucción lo lista          |
| cambiar el procedimiento de mutación | la skill que lo ejecuta                                     |

## Estado medido (2026-09-24)

Histórico y fechado, como toda tabla de estado de un `quickstart.md`: dice qué pasó esa vez, no
qué pasa hoy.

| Qué                                  |            Antes |          Después |
| ------------------------------------ | ---------------: | ---------------: |
| `CLAUDE.md`                          |       195 líneas |       185 líneas |
| `.claude/rules/gates-de-calidad.md`  |        58 líneas |        40 líneas |
| `.claude/rules/anillos-y-modulos.md` |        90 líneas |        40 líneas |
| Secciones declaradas `mixed`         |                3 |                0 |
| Dónde vive el registro de deudas     | dentro de la 019 | `docs/deudas.md` |
| Filas del registro                   |                6 |               12 |

Los siete pasos en verde. La cadena completa —`format:check`, `typecheck`, `quality`, `npm test`
(148 archivos), `test:tools`, `contract:check`, `release-check`— pasó sin que se moviera **ninguna
prueba del producto**, que era el canario de la feature.

### Lo que no se cerró, y por qué

- **D-11** (`profiles-compose-modules` vigila `src/composition/profiles/`, que ya no existe) y
  **D-12** (la activación de mutantes estáticos en el runner de Vitest, anotada en ADR-016 el
  2026-09-21 y nunca registrada). Las dos aparecieron **al separar**, las dos son cambios de un
  gate y no de documentación, y por eso quedan `abierta`s con su motivo en vez de arrastrarse
  dentro de esta feature.

### Lo que la separación corrigió sin que estuviera en la lista

- La enmienda de ADR-013 del 2026-09-16 describía el mecanismo que **ADR-033 reemplazó**
  (`composition/profiles/`, `binder(overrides)`, `bootstrap(config, { profile? })`), y el texto
  correcto vivía sólo en la instrucción. Borrarla sin corregir el ADR habría dejado como única
  fuente escrita una que está mal. Es el argumento a favor del orden en dos tiempos: agregar al
  destino obliga a leerlo.
- El reparto que fijó el `research.md` clasificó «Forma de los anillos» como descriptiva leyendo su
  primera cláusula. Leída regla por regla, cinco de sus seis prohibiciones no viven en ningún otro
  lado y se quedaron. **El reparto se decide leyendo, no clasificando por el título** — que es lo
  mismo que la 024 encontró y lo que el paso 7 existe para atrapar.
- `check:identifiers` no conocía los nombres de las skills, así que la primera cita de
  `triaging-mutants` salió como identificador inventado. La fuente era la que faltaba: una skill
  que existe es un nombre que existe.
