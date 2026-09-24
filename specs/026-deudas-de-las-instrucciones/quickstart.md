# Quickstart — verificar que el registro es verdad y las cuatro están cerradas (026)

Cada fila la decide un comando, salvo la última, que la decide leer.

## 1. El registro existe donde se lo busca

```bash
ls docs/deudas.md && grep -c "^| D-" docs/deudas.md
```

Diez filas: las seis de la 019 más las cuatro nuevas. Y su fila en el inventario:

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
grep -c "complejidad cognitiva" .claude/rules/gates-de-calidad.md eslint.config.mjs
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
