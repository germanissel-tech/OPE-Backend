# Plantilla de `docs/auditoria/trabajo/avance.md`

Lo primero que lee cada sesión (junto con `tasks.md`). Responde sin leer otra cosa: ¿qué está
hecho, qué falta, cuál es el siguiente paso? Se actualiza al cerrar cada unidad de trabajo, no
sólo al cerrar la fase.

```markdown
# Avance — auditoría integral (014)

**Anclaje**: `main` @ `8d12aa2` · **Rama**: `014-auditoria-integral`

## Estado por fase

| Fase           | Estado    | Próxima tarea (tasks.md) | Commit de cierre |
| -------------- | --------- | ------------------------ | ---------------- |
| 0 Base         | en curso  | T005                     | —                |
| 1 Lectura fina | pendiente | —                        | —                |
| …              |           |                          |                  |

## Próximo paso exacto

<una línea: qué tarea, con qué comando o qué archivo se empieza>

## Lecturas hechas

- constitución: sí (sesión 1)
- CLAUDE.md: sí (sesión 1)
- ADRs: 001–029 (sesión 1)
- MVP: 01 §…, 02 §…, 03 §… (sesión 1)
- specs: 001…013 spec/quickstart (sesión N)

## Comandos corridos

| Comando                  | Fecha      | Salida                                    | Resumen |
| ------------------------ | ---------- | ----------------------------------------- | ------- |
| `npm run contract:check` | 2026-09-19 | `trabajo/gates/global-contract-check.txt` | OK      |
| …                        |            |                                           |         |

## Módulos (fase 1)

| Alcance       | Gates                             | Archivos leídos | Hallazgos por eje (1–7)    | Contraste documental                |
| ------------- | --------------------------------- | --------------- | -------------------------- | ----------------------------------- |
| shared-kernel | `gates/modulo-shared-kernel.json` | 9 (lista abajo) | 1: — · 2: F-003 · 3: — · … | glosario ✓ · ADR-013 ✓ · spec 004 ✓ |

### Archivos leídos por alcance

- shared-kernel: `src/domain/shared-kernel/ids.ts`, …

## Sospechas (handoff §6)

| S   | Fase | Veredicto | F-NNN / motivo |
| --- | ---- | --------- | -------------- |

## Dudas planteadas al dueño y respuestas

| Fecha | Duda | Respuesta | Efecto |
| ----- | ---- | --------- | ------ |

## Notas de sesión

- 2026-09-19 (sesión 1): …
```
