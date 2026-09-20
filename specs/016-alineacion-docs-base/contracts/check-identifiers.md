# Gate `check:identifiers` (R-06)

```
node scripts/check-identifiers.mjs [--docs <dir,dir>] [--constitution <file>] [--bundle <file>] [--catalogs <file,file>] [--src <dir>] [--tooling <path,path>] [--allowlist <file>]
```

- Lee la constitución, `docs/adr/*.md`, `docs/dominio/*.md`; extrae spans `` `…` `` de una línea (los bloques de código se saltan).
- Identificador por forma: `/^[A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)+$/` (snake/kebab), `/^[a-z]+(?:[A-Z][a-z0-9]*)+$/` (camelCase), `/^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)*$/` (SCREAMING). Se ignora lo que contiene `/`, `.`, ` `, `(`, `:`, `<`, `$`, `#`, `@`, empieza con `--` o con dígito.
- Existe: token (`\b…\b`) en `contracts/dist/openapi.yaml`, `contracts/problem-types.yaml`, `contracts/no-op-reasons.yaml`, `contracts/api-map.yaml`, cualquier `src/**/*.ts` o el tooling del repo (`package.json`, `tsconfig*.json`, `eslint.config.mjs`, `.dependency-cruiser.cjs`, `knip.json`, `stryker.config.json`, `schemathesis.toml`, `redocly.yaml`, `lefthook.yml`, `vitest*.ts`, `contracts/.spectral.yaml`, `contracts/rules/`, `scripts/`, `.github/`): los ADR nombran reglas de lint, opciones del compilador y scripts. Una nota del glosario puede citar su propio `en`.
- Allowlist `scripts/identifiers-allowlist.json`: `[{ "identifier": "DECIDIDO", "reason": "…" }]`; entrada sin `reason` ⇒ exit 1 con mensaje propio.
- Salida: una línea por desconocido `docs/adr/010-…md:17: talle_calce`; resumen `Identifiers: N cited, M unknown`; exit 1 si M > 0.
- `package.json`: `"check:identifiers"`; `contract:check` lo encadena tras `check:glossary`. CLAUDE.md § Comandos gana la fila.
- Pruebas: `tests/governance/identifiers.test.ts` con fixtures `tests/governance/fixtures/identifiers/{ok,unknown,allowlist-without-reason}/`.
