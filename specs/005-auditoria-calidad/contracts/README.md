# Contratos — Feature 005

## 1. OpenAPI: sólo cambia el idioma

Ninguna ruta, schema, código de estado, `x-invariants`, `x-required-capabilities`, ejemplo
estructural ni `info.version` cambia. Lo que cambia, a inglés:

| Dónde                                              | Qué                                                           | Compatibilidad                                                             |
| -------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `contracts/openapi.yaml`, `paths/*`                | `info.description`, `summary`, `description` de operaciones   | informativo (oasdiff no lo clasifica como rompiente)                       |
| `components/schemas/*`                             | `description` de schemas y propiedades; `title` si es prosa   | informativo; los tipos generados sólo cambian en JSDoc                     |
| `components/responses/*`, `examples/*`             | `description`; en ejemplos, los valores de `title` y `detail` | informativo; los ejemplos no son contrato de valores                       |
| `contracts/problem-types.yaml`                     | `title` y `description` de cada `urn:ope:problem:<slug>`      | el `type` (URN) no cambia; `title` es texto para humanos (RFC 9457 §3.1.2) |
| `contracts/no-op-reasons.yaml`                     | `description` de cada motivo; el patrón del string no cambia  | informativo                                                                |
| `contracts/.spectral.yaml`, `rules/functions/*.js` | `message` de cada regla                                       | no es parte del OpenAPI                                                    |

Verificación: `npm run contract:check` (lint, bundle, `contract:diff` contra `origin/main`
sin cambios rompientes, tipos regenerados sin drift, glosario, invariantes, marcadores) y
`npm run check:language` en verde sobre `contracts/`.

Efectos en código: `src/interface-adapters/http/problem-details.ts` replica `title` por
tipo (verificado por prueba: se actualiza junto); las pruebas de integración que afirman
sobre `title`/`detail` literales se actualizan (listadas en el cierre, SC-004).

## 2. Hallazgo de auditoría

[`audit-finding.schema.json`](audit-finding.schema.json): la forma que `verify-finding.mjs`
exige a cada hallazgo antes de que entre al reporte. Es un contrato entre la parte cognitiva
de la skill (que propone) y la determinista (que verifica); no es una superficie HTTP.

## 3. Salida de un gate

Todo `scripts/check-*.mjs` y `mutation-diff.mjs` acepta `--json` y emite:

```json
{
  "gate": "language",
  "mode": "blocking",
  "status": "fail",
  "findings": [{ "file": "src/main.ts", "line": 12, "rule": "language", "message": "..." }]
}
```

`run-gates.mjs` los concatena en `{ gates: [...] }`. Sin `--json`, salida humana como hoy.
