# Quickstart — Deudas técnicas del tooling y las skills (019)

## Prerrequisitos

- `main` con la 018 mergeada (`619414d`); `npm ci`; `npm run contract:bundle`.
- Línea base: `npm run test:all` y `npm run quality` en verde antes de tocar nada.
- Orden de las historias (R-09): D-06 → D-04 → D-05 → D-01 → D-02. Un commit por historia;
  al cerrar cada una, su fila del registro pasa a `implementada` con el commit.

## Por historia (gates comunes al final de cada una)

```bash
npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:tools
npm run check:identifiers && npm run check:language && npm run check:adrs
```

### D-06 — Directorios de primer nivel con README verificado

```bash
npx vitest run --project tools tests/docs        # inventario: cero faltantes, cero sobrantes; cabeceras
head -1 generated/problem-types.js               # cita un script que existe
grep -E "^# (Fix|Retire):" patches/*.patch       # dos líneas
for f in scripts/*.mjs scripts/lint/*.mjs; do sed -n '1{/^#!/d;p}' "$f" | grep -q '^//' || echo "sin cabecera: $f"; done
mkdir tmp-dir && npx vitest run --project tools tests/docs; rmdir tmp-dir   # un directorio nuevo sin README falla (SC-06-4; la prueba lleva su fixture)
git diff --stat main -- CLAUDE.md                # sólo quita descriptivo y agrega enlaces
```

### D-04 — `config/` con esquemas

```bash
npm run contract:types && git status --short generated/   # nada si está al día; incluye generated/schemas/
npm run contract:types:check
npx vitest run tests/unit/composition/config-schemas      # 4/4 archivos validan; semilla y operadores coinciden con los lectores
npx spectral lint tests/contract-rules/fixtures/ope-configuration-fields-described.yaml --ruleset contracts/.spectral.yaml   # dispara sólo esa regla
npm run contract:check                                    # descripciones completas en los niveles
git diff main -- config/*.json                            # sólo la clave $schema
npm run dev                                               # arranca igual (el $schema no llega al lector)
```

### D-05 — `contracts/` con README y extensiones

```bash
npx vitest run --project tools tests/docs        # tabla de extensiones = x-* de la fuente, en los dos sentidos
test ! -e contracts/webhooks || grep -n "webhooks" contracts/README.md   # borrado o justificado
head -5 contracts/problem-types.yaml             # describe la generación
npm run contract:check                            # bundle, mapa y generado sin cambio salvo comentarios
```

### D-01 — Skill de auditoría portable

```bash
test ! -d .claude/skills/auditing-architecture   # reemplazada
claude plugin validate plugins/auditable-architecture
node plugins/auditable-architecture/skills/auditing-architecture/scripts/run-gates.mjs --module merchant --json | head -20
npx vitest run --project tools tests/audit       # nueve evals propias con expected.json sin diff contra main + universales admitidas
git diff main --stat -- tests/audit/evals/       # sólo movidos (mismo contenido)
grep -rn "scripts/lib.mjs\|governance-lib\|shape-rules\|eslint.config" plugins/   # vacío: la skill no importa el repo
cp audit.profile.json /tmp/p.json && node -e "..." # profileVersion 99 ⇒ rechazo con las dos versiones; sin perfil ⇒ una línea
npm run check:adrs                                # ADR-032 con frontmatter y citas
```

La corrida cognitiva (SKILL.md sobre cada fixture, comparación con `expected.json`) se hace una
vez al cerrar D-01 y se registra fechada en `tests/audit/evals/RESULTS.md`.

### D-02 — Skill de acondicionamiento

```bash
node plugins/auditable-architecture/skills/conditioning-project/scripts/inspect.mjs . | head -40   # todo detectado, cero preguntas
node plugins/auditable-architecture/skills/conditioning-project/scripts/doctor.mjs .              # 0 falta, 0 degradado, maxVerdict rejected
npx vitest run --project tools tests/audit/conditioning   # este repo: perfil equivalente; empty-repo: mínimo + faltantes; segunda corrida sin cambios
```

## Cierre de la feature (cuando el dueño cierra el registro)

```bash
npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:contract && npm run release-check
```

`test:mutation` en CI (poco `src/` cambia: `levels-config.ts`, `merchants-config.ts`,
`operators-config.ts`). PR a `main` sin merge. El registro de la spec con todas las filas en
`implementada` o `descartada`; D-03 queda `evaluada` con la nota de feature aparte.

## Cambios respecto del plan

- 2026-09-21 línea base: rama sobre `main` en `619414d`; `test:all` 1 270 pruebas / 146 archivos; `quality` en verde. ADR-032 se escribe en el Setup (no en D-01): el plan ya lo cita y `check:adrs` rompe la cadena sin él; D-01 lo enmienda si la implementación cambia algo. Ocho identificadores del plugin (`profileVersion`, `findings-v1`, los resolutores, los nombres de las skills) entran a `identifiers-allowlist.json` con motivo hasta que `plugins/` exista como raíz de tooling (D-01 los quita).
- 2026-09-21 D-06: la política del inventario (columnas fijas, exclusiones globales, directorios y columnas propias) vive en `scripts/readme-inventory-policy.json` y no en el código: es vocabulario en castellano de la documentación y `check:language` lo excluye como a la denylist; la lib (`readme-inventory-lib.mjs`) es pura y el sample de las pruebas es un fixture `.md`. Una entrada excluida (`dist/`) puede documentarse sin estar en el directorio. `reports/` no lleva README (ignorado por git, no es parte del repo); `.vscode/` es raíz de herramienta y queda excluido. Nueve directorios con README; `plugins/` entra en D-01. Cabeceras corregidas: `generated/problem-types.{js,d.ts}` citaban un script inexistente; `contract-types-lib.mjs` no tenía cabecera; el parche pasa a `# Fix:` / `# Retire:`.
- 2026-09-21 D-04: (1) la semilla y los operadores son arrays y un array no puede llevar `$schema`: los archivos pasan al objeto del esquema (`{ "$schema", "merchants": [...] }`, `{ "$schema", "operators": [...] }`) y los lectores aceptan las dos formas (`listOf` en `composition/env.ts`; el array a secas sigue valiendo en la variable en línea); `withoutSchemaReference` quita la clave antes del lector de forma cerrada, también en los helpers de prueba que leen los archivos. (2) Sin `$id` en los esquemas generados: la semilla referencia por ruta relativa `../../generated/schemas/merchant-configuration-declared.schema.json#/properties/<clave>` (un tercer esquema generado) y el editor y Ajv resuelven igual. (3) No hay regla Spectral nueva: `ope-property-description` (feature 001, FR-013) ya exige descripción en toda propiedad de todo esquema y su fixture existe; la prueba unitaria verifica además que la descripción llega a los esquemas generados. (4) Fixtures en tres clases: `valid`, `invalid` (esquema y lector rechazan) y `stricter` (el esquema lleva la forma del contrato y el lector no: patrón de `merchantId`, huellas hex, claves desconocidas, `holdoutPercent` fuera de rango que se juzga al importar); una divergencia nueva falla nombrando el fixture. `git diff main -- config/*.json`: una línea en cada nivel; la semilla y los operadores cambian de forma (envoltura) sin cambiar valores.
- 2026-09-21 D-05: `contracts/webhooks/` borrado (R-07; nada del mapa lo reclama). oasdiff no admite comentarios en el archivo de severidades (falla con `invalid line #1`): el motivo de cada elevación queda en la fila del README con la cita a ADR-003. La tabla de extensiones la lee la prueba desde la fuente (`contracts/**/*.ya?ml`, no `dist/`) con `extensionKeys`/`documentedExtensions` de la lib de inventario; el sample de la prueba usa encabezados en inglés porque `check:language` alcanza a `tests/`.
