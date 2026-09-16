# Pruebas de contrato generadas (FR-051)

`npm run test:contract` bundlea el contrato, levanta el servidor real en un puerto libre y
corre [Schemathesis](https://schemathesis.readthedocs.io/) (vía `uvx`, versión fijada en
`scripts/test-contract.mjs`) con `--checks all` sobre `contracts/dist/openapi.yaml`: genera
requests válidos e inválidos en los bordes de cada esquema y verifica que toda respuesta use un
código declarado, un cuerpo que valida y Problem Details en los errores.

Requiere `uv` instalado (`uvx --version`). El reporte JUnit queda en `.schemathesis/`.

## Prueba negativa

```bash
OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts npm run test:contract
```

Debe fallar en `GET /v1/health`: el manejador intenta responder `203` (no declarado), el
servidor lo convierte en `500 response-contract-violation` (FR-043) y Schemathesis lo reporta
como *Server error* en esa operación. Si se desactivara la validación de respuesta del
servidor, Schemathesis lo reportaría igual como *Undocumented HTTP status code*. En PowerShell: `$env:OPE_HANDLERS_MODULE="tests/contract/fixtures/health-203.ts"; npm run test:contract`.
