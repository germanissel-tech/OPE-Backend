# Formato de un hallazgo y del reporte

El esquema ejecutable es `scripts/audit-finding.schema.json`; `scripts/verify-finding.mjs` lo
aplica y además comprueba que el archivo y la línea existen, que la fuente pertenece a una
clase que el perfil del proyecto (`audit.profile.json`) declara y resuelve por su resolutor, y
que la severidad es la que esa clase impone. Nada que no pase por ahí entra al reporte.

## Contenido

- Campos de un hallazgo
- Severidad: la decide la fuente, no el revisor
- Estado global: regla fija
- Ejemplo confirmado
- Ejemplo refutado
- Secciones del reporte

## Campos de un hallazgo

| Campo          | Qué es                                                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `F-001`, `F-002`… único en el reporte                                                                                                                                                                                            |
| `file`         | ruta relativa al repo con `/`; tiene que existir                                                                                                                                                                                 |
| `line`         | entera, dentro del archivo                                                                                                                                                                                                       |
| `rule.id`      | slug corto del criterio: `srp-one-authority-per-module`, `dip-port-leaks-infrastructure`…                                                                                                                                        |
| `rule.source`  | `<clase><resto>`: la clase es un prefijo que `profile.sources[]` declara (por ejemplo `ADR-`, `constitution#`, `lint:`, `clarity:`) y el resto lo que su resolutor busca (un número de ADR, un encabezado, una regla de un gate) |
| `severity`     | `high` · `medium` · `low` — la impone la clase de `rule.source` (`profile.sources[].severity`)                                                                                                                                   |
| `evidence`     | el fragmento citado (≤ 20 líneas), no una paráfrasis                                                                                                                                                                             |
| `proposal`     | `{ before, after }`: código, no prosa                                                                                                                                                                                            |
| `coveringTest` | qué prueba lo cubriría: nombre y ubicación (`tests/unit/.../x.test.ts: "..."`)                                                                                                                                                   |
| `status`       | `proposed` → `confirmed` \| `refuted`; `refuted` lleva `refutation`                                                                                                                                                              |
| `closure`      | opcional; lo escribe la feature que cierra el hallazgo: `{ status: resolved                                                                                                                                                      | absorbed-by | rejected, by: <commit | F-NNN | motivo>, feature: NNN }`; `verify-finding` no lo juzga |

## Severidad: la decide la fuente, no el revisor

Cada clase de fuente lleva su severidad en el perfil del proyecto. La convención que la skill
recomienda y la de acondicionamiento escribe por defecto:

| clase de fuente                                                                      | severidad | significa                                                            |
| ------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------- |
| una decisión registrada (ADR), un principio de la constitución, un requisito citable | `high`    | viola algo que el proyecto decidió y escribió                        |
| una convención de la guía para agentes, o el caso que una regla de un gate no ve     | `medium`  | viola una convención o extiende una regla                            |
| claridad (nombres, legibilidad), sin fuente formal                                   | `low`     | mejora sin decisión detrás; `verify-finding` la baja si pretende más |

`verify-finding` rechaza un hallazgo cuya severidad no es la de su clase, y uno cuya clase el
perfil no declara.

## Estado global: regla fija

- **`rejected`**: algún gate bloqueante en `fail`, o algún hallazgo confirmado `high`.
- **`changes-required`**: ningún `high`, algún `medium`.
- **`approved`**: sólo `low` o ningún hallazgo.

No hay puntuación numérica. Si alguien pide "un 1 a 10", la respuesta es el estado y la lista.

## Ejemplo confirmado

```json
{
  "id": "F-001",
  "file": "src/application/ingestion/ingest-batch.ts",
  "line": 52,
  "rule": { "id": "dip-use-case-reads-environment", "source": "constitution#I. Separación de autoridades" },
  "severity": "high",
  "evidence": "const ttl = Number(process.env[\"OPE_DEDUP_TTL\"] ?? 86400000);",
  "proposal": {
    "before": "const ttl = Number(process.env[\"OPE_DEDUP_TTL\"] ?? 86400000);",
    "after": "// ttl comes in through the EventDedup port's window, wired in composition/deployments"
  },
  "coveringTest": "tests/architecture/shape.test.ts: \"src/ instantiates npm packages only in composition\" (extend to process.env)",
  "status": "confirmed"
}
```

## Ejemplo refutado

```json
{
  "id": "F-002",
  "file": "src/interface-adapters/ledger/controllers/confirm-exposure.ts",
  "line": 20,
  "rule": { "id": "dry-duplicated-422-translation", "source": "lint:sonarjs/no-identical-functions" },
  "severity": "medium",
  "evidence": "if (!result.ok) return invariantResponse(req, result);",
  "proposal": { "before": "…", "after": "…" },
  "coveringTest": "tests/unit/problem-details.test.ts: invariantResponse()",
  "status": "refuted",
  "refutation": "The translation already lives in invariantResponse(); the two call sites are one line each and change for different reasons."
}
```

## Secciones del reporte

1. **Alcance**: `module:<nombre>` · `dir:<ruta>` · `diff:<base>...HEAD`, y la lista de archivos.
2. **Gates**: la salida de `run-gates.mjs`, gate por gate: `pass`/`fail` y hallazgos. Son hechos.
3. **Hallazgos**: sólo `confirmed` + `verified: true`, ordenados por severidad.
4. **Refutados**: anexo con cada `refuted` y su `refutation` (el lector ve qué se descartó y por qué).
5. **Estado global**: una palabra y la regla que la produjo.
