# Mapa del contrato — roadmap renumerado y feature del puerto (R-02, F-017, F-029)

`contracts/api-map.yaml`, sección `features`:

```yaml
features:
  "010": Catalogue and stock
  "011": Decision plane I — barrier and evidence
  "012": Decision plane II — quality gate and policy
  "013": Outcomes — orders, returns, browser corroboration
  "014": Integral engineering audit (read-only)
  "015": Audit findings — corrections
  "016": Configuration, flags, kill switch and administration
  "017": Message catalogue
  "018": ITT analysis and merchant portal
  "019": Persistence and resilience
  "020": Observability and end-to-end
  "021": Platform port and adapters — obtenerCatalogo, obtenerStockYPrecio, alConfirmarOrden, alRegistrarDevolucion; generic and test adapters; end-to-end run (constitution X, 02 §6)
```

- Toda entrada `feature:` de `operations` con `"014"`…`"018"` se corre dos números en el mismo
  commit; `check:api-map` verde.
- Las operaciones del puerto de la 021 son salientes: no son `operations` del mapa; la feature
  existe en el roadmap con su fuente en la descripción.
- Prosa que citaba features por número (CLAUDE.md, ADR-022/025/027, glosario, comentarios de
  `src/`, `Incentive.yaml`): nombre de la feature o de la operación, nunca el número.
