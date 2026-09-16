# Pruebas de contrato generadas (FR-051)

`npm run test:contract` bundlea el contrato, levanta el servidor real en un puerto libre y
corre [Schemathesis](https://schemathesis.readthedocs.io/) (vía `uvx`, versión fijada en
`scripts/test-contract.mjs`) con `--checks all` sobre `contracts/dist/openapi.yaml`: genera
requests válidos e inválidos en los bordes de cada esquema y verifica que toda respuesta use un
código declarado, un cuerpo que valida y Problem Details en los errores.

Requiere `uv` instalado (`uvx --version`). El reporte JUnit queda en `.schemathesis/`.

El servidor arranca con un merchant de prueba (`OPE_MERCHANTS`, definido en el script) y
Schemathesis manda su credencial en `X-OPE-Ingest-Key` (`-H`); también prueba el camino sin
header (401). `schemathesis.toml` acepta `422` como respuesta a datos válidos según el esquema:
es el rechazo por invariante declarada en `x-invariants` (ADR-007), no un error de validación.
El aviso "schema validation mismatch" sobre `POST /v1/events` es esperable: los instantes que
Schemathesis genera al azar caen casi siempre fuera de la tolerancia de `occurredAt`.

## Prueba negativa

```bash
OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts npm run test:contract
```

Debe fallar en `GET /v1/health`: el manejador intenta responder `203` (no declarado), el
servidor lo convierte en `500 response-contract-violation` (FR-043) y Schemathesis lo reporta
como _Server error_ en esa operación. Si se desactivara la validación de respuesta del
servidor, Schemathesis lo reportaría igual como _Undocumented HTTP status code_. En PowerShell: `$env:OPE_HANDLERS_MODULE="tests/contract/fixtures/health-203.ts"; npm run test:contract`.
