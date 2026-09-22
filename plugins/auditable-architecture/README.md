# auditable-architecture — auditoría de arquitectura por método

Un plugin de Claude Code con la skill `auditing-architecture`: un procedimiento de revisión en
siete pasos —gates del proyecto como hechos, hallazgos con `file:line` y fuente, refutación,
verificación mecánica, veredicto derivado— que no sabe nada del proyecto que audita. Todo lo del
proyecto lo dice su perfil, `audit.profile.json` en la raíz del repositorio: cómo se resuelve un
módulo, qué gates hay y cómo entregan hallazgos (protocolo `findings-v1`), qué fuentes de verdad
existen y qué severidad imponen, dónde están los criterios de diseño y las evaluaciones propias.
La forma del perfil es `skills/auditing-architecture/scripts/audit-profile.schema.json`.

## Instalación en otro proyecto

1. Instalar el plugin: desde este repositorio como marketplace (`claude plugin marketplace add
<ruta o repo>` y `claude plugin install auditable-architecture@ope`), o en desarrollo con
   `claude --plugin-dir <ruta>/plugins/auditable-architecture`.
2. Acondicionar el proyecto con la skill `conditioning-project` ("acondicioná este repo para la
   auditoría"): inspecciona, pregunta sólo lo que no detecta, escribe `audit.profile.json` y el
   documento de criterios prellenado, deja pendiente cada herramienta sin adaptador y corre el
   doctor. A mano vale igual: el perfil sigue el esquema.
3. Un adaptador por gate, del lado del proyecto: recibe `--files-from <archivo>` (una ruta por
   línea) y escribe `{ "findings": [{ "file", "line", "rule", "message" }] }`; con
   `--list-rules` escribe `{ "rules": [...] }`; con `--describe` (opcional) dice su modo y sus
   alcances para el perfil; sale con código distinto de cero si no pudo correr (gate degradado).
4. Un documento de criterios de diseño en términos del proyecto (SRP, OCP, LSP, ISP, DIP, DRY,
   claridad, errores: definición, fuente, qué viola, qué cumple, qué ya ve un gate).
5. Invocar la skill: "auditá el módulo X", "revisá los cambios contra main".

Sin perfil, la skill dice qué falta y termina; con un perfil de una versión que no entiende, lo
rechaza nombrando las dos.

## Inventario

| Entrada           | Qué es                                                                                                                                                                                | Fuente o derivado | Quién lo lee                         | Verificación                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `.claude-plugin/` | `plugin.json`: nombre, versión semver, descripción.                                                                                                                                   | fuente            | Claude Code                          | `tests/audit/plugin-isolation.test.ts`; `claude plugin validate` |
| `skills/`         | `auditing-architecture/` (SKILL.md, `references/`, `scripts/`, `evals/` universales) y `conditioning-project/` (SKILL.md, `scripts/` inspect · write-profile · doctor, `templates/`). | fuente            | Claude Code; `tests/audit/` por ruta | `tests/audit/audit.test.ts`, `tests/audit/conditioning.test.ts`  |
