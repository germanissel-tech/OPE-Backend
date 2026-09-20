# Quickstart — Alineación con los documentos base del MVP (016)

## Prerrequisitos

- `npm ci`; `uvx` para `test:contract`; `origin/main` con el contrato 1.2.0 (base del diff).
- Historia 3: la sesión autoriza la carpeta `../` (los documentos base), o se relanza con `--add-dir ..`.

## Verificar cada historia

### US1 — Gobernanza del repo

```bash
npm run contract:check       # check:adrs, check:glossary, check:api-map, check:markers en verde
git diff main -- .specify/memory/constitution.md docs/adr contracts/api-map.yaml docs/dominio
```

Esperado: constitución 1.4.0 con XI y `fit`/`price`/`returns`; ADR-025 con los tres modos; ADR nuevo con las cinco decisiones; ADR-010 remitiendo a `01 §13`; `features:` 016–022 en el orden de R-03; las notas nuevas del glosario con fuente.

### US2 — Contrato v2, `locale`, `check:identifiers`

```bash
npm run contract:check       # "Expected incompatible change: major version 1 → 2"; tipos regenerados; check:identifiers en verde
npm test                     # órdenes, corroboraciones y devoluciones con status + correlation; ingesta con locale
npm run test:contract        # Schemathesis contra /v2/
npm run check:identifiers    # Identifiers: N cited, 0 unknown
node scripts/check-identifiers.mjs --docs tests/governance/fixtures/identifiers/unknown   # exit 1, nombra el identificador
```

### US3 — Base al día

Releer la evaluación §5.1 contra `../README.md`, `../01`, `../02`, `../03`, `../04`; `npm run check:glossary` sigue resolviendo las fuentes `mvp:`; compilar los diagramas si `archify` está disponible (`npx archify …`), o anotar aquí que queda pendiente.

## Cierre

```bash
npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check
```

Un commit por historia; PR a `main` sin merge.

## Cambios respecto del plan

(Se completa durante la implementación, con fecha.)
