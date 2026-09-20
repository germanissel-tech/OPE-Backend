# Re-corrida de la rúbrica (cierre 015, 2026-09-19)

Alcance: `git diff --name-only main -- src tests` tras `4caa985` (185 archivos). Método: los
siete ejes de `specs/014-auditoria-integral/contracts/rubrica.md`; los archivos nuevos
leídos enteros, los modificados en sus hunks; cada hallazgo `resolved` cotejado contra su
`proposal.after` en el árbol.

| Eje | Resultado                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | F-004, F-028, F-035 no se reproducen. Una observación nueva: `Window` (interfaz de `gateways/shared-kernel/windowed-map.ts`) comparte nombre con el global del DOM → `BoundedWindow` (`101e099`).                             |
| 2   | F-001, F-005, F-011, F-014, F-015, F-016, F-019, F-023, F-025, F-032, F-034, F-036, F-047, F-058 no se reproducen; cabeceras de prueba con feature (F-020) verificadas por `tests/governance/test-headers.test.ts`.           |
| 3   | F-012 no se reproduce: `build-server.ts` es ensamblado (84 líneas); `raw-bodies`, `security-boundary`, `dispatch`, `http-response` con una razón de cambio cada uno. `shape` en `pass` en los 15 alcances.                    |
| 4   | F-003, F-018, F-030, F-038, F-039, F-040 no se reproducen (`Claim` por `kind`, `FACTS … satisfies`, `SessionDecisions`, ids tipados, guard sin `as`).                                                                         |
| 5   | F-022, F-044 no se reproducen (`details` en vez de números en el mensaje; `CatalogStore.replace` con `Result`). Sin `throw` por regla de negocio ni `catch` que trague en lo tocado.                                          |
| 6   | F-024 (título ajustado al hecho), F-054, F-055, F-056 no se reproducen; `test:mutation` sobre las líneas cambiadas sin supervivientes en las cuatro historias; `--all` sin `Ignored` fuera de su línea (F-052).               |
| 7   | F-029, F-031, F-062, F-063 no se reproducen (constitución v1.3.0, roadmap renumerado, tasas 0–1 y conversión en el borde, X como deuda declarada). Glosario y ADR citados vigentes (`check:glossary`, `check:adrs` en verde). |

Reproducibles: F-043, F-045, F-046 (feature de persistencia) y F-041 (rechazado). Sin hallazgos
nuevos de severidad media o alta.
