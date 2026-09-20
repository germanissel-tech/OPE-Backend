# Anexo de cierre del informe de la 014 (R-14, FR-001..FR-003)

Sección nueva al final de `docs/auditoria/2026-09-19-informe-auditoria-integral.md`:

```markdown
## 8. Cierre (feature 015, <fecha>)

Regla: cada hallazgo confirmado termina `resolved` (commit), `absorbed-by` (F-NNN) o
`rejected` (motivo del dueño); F-043, F-045 y F-046 van a la feature de persistencia.

| F-NNN | Estado | Commit / F-NNN / motivo |
| ----- | ------ | ----------------------- |
| …     | …      | …                       |

Renumeración del mapa: … (tabla antes → después).

Re-corrida del método (SC-002): `run-gates.mjs` sobre los 15 alcances (…) y la rúbrica sobre
los archivos tocados (…); hallazgos reproducidos: sólo <lista> (persistencia / rechazados).
Estado global recalculado por la regla fija: `<estado>`.
```

En cada `fase-N.json`, el hallazgo gana `closure` (data-model.md). `verify-finding.mjs` sigue
aceptando los archivos (campo opcional en el esquema, con prueba en `tests/audit/`).
