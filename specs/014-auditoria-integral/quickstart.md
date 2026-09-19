# Quickstart — Auditoría integral (014)

Cómo retomar el trabajo en cualquier sesión y cómo verificar el cierre de cada fase.

## Retomar una sesión

```bash
git checkout 014-auditoria-integral
git log --oneline main..HEAD                       # una línea por fase cerrada
cat docs/auditoria/trabajo/avance.md               # estado, próximo paso, lecturas y comandos hechos
grep -n "\[ \]" specs/014-auditoria-integral/tasks.md | head   # primera tarea abierta
```

Reglas: no repetir una lectura ni un comando que ya figure en `avance.md`; no tocar nada fuera
de `specs/014-auditoria-integral/` y `docs/auditoria/`; una duda que cambie alcance o criterio
se plantea al dueño antes de seguir y su respuesta se anota en `avance.md`.

## Verificar el cierre de una fase

```bash
# 1. El alcance sigue aislado (SC-006): vacío
git diff --stat main -- . ':!specs/014-auditoria-integral' ':!docs/auditoria'

# 2. Los hallazgos de la fase pasan el verificador (SC-001)
node .claude/skills/auditing-architecture/scripts/verify-finding.mjs docs/auditoria/trabajo/hallazgos/fase-N.json

# 3. El informe no introduce marcadores bloqueantes (R-08)
npm run check:markers

# 4. Formato
npx prettier --check docs/auditoria specs/014-auditoria-integral

# 5. Traza: todas las tareas de la fase marcadas
grep -c "\[ \] T[0-9]* \[F N\]" specs/014-auditoria-integral/tasks.md   # 0

# 6. Commit de cierre
git add docs/auditoria specs/014-auditoria-integral && git commit -m "docs(auditoria): fase N — <resumen>"
```

## Comandos de la fase 0 (una vez)

```bash
npm ci
npm run contract:check   > docs/auditoria/trabajo/gates/global-contract-check.txt 2>&1
npm run quality          > docs/auditoria/trabajo/gates/global-quality.txt 2>&1
npm run typecheck        > docs/auditoria/trabajo/gates/global-typecheck.txt 2>&1
npm test                 > docs/auditoria/trabajo/gates/global-test.txt 2>&1
npm run build && npm run test:contract > docs/auditoria/trabajo/gates/global-test-contract.txt 2>&1
npm run check:markers    > docs/auditoria/trabajo/gates/global-markers.txt 2>&1
# largo, en segundo plano; el reporte queda en reports/mutation/report.json → copiar a trabajo/gates/mutation-full.json
npm run test:mutation -- --all
```

## Comandos de la fase 1 (por alcance)

```bash
node .claude/skills/auditing-architecture/scripts/run-gates.mjs --module <nombre> --json > docs/auditoria/trabajo/gates/modulo-<nombre>.json
node .claude/skills/auditing-architecture/scripts/run-gates.mjs --dir src/infrastructure --json > docs/auditoria/trabajo/gates/modulo-infrastructure.json
node .claude/skills/auditing-architecture/scripts/run-gates.mjs --dir src/composition --json > docs/auditoria/trabajo/gates/modulo-composition.json
```

Después, la lectura por rúbrica (`contracts/rubrica.md`) y el contraste documental (R-05).

## Verificar el cierre de la auditoría (fase 5)

- `verify-finding.mjs` sobre cada `hallazgos/fase-N.json`: ninguno rechazado (SC-001).
- `afirmaciones.md`: ninguna fila sin evidencia ni hueco; las doce sospechas con veredicto
  (SC-003).
- Cuadro por módulo: 14 filas × 7 ejes completas (SC-002).
- Estado global recalculado desde los JSON = declarado en §7 (SC-004).
- PR `014-auditoria-integral` → `main` con la descripción de gates del Constitution Check
  (ninguno de código aplica; diff limitado a dos directorios). Merge sólo si el dueño lo pide.
