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
2. Escribir `audit.profile.json` en la raíz del proyecto (a mano según el esquema, o con la
   skill `conditioning-project` cuando exista): la raíz del código, los alcances, los gates con
   sus adaptadores, las fuentes de verdad, el documento de criterios y el directorio de evals.
3. Un adaptador por gate, del lado del proyecto: recibe `--files-from <archivo>` (una ruta por
   línea) y escribe `{ "findings": [{ "file", "line", "rule", "message" }] }`; con
   `--list-rules` escribe `{ "rules": [...] }`; sale con código distinto de cero si no pudo
   correr (gate degradado).
4. Un documento de criterios de diseño en términos del proyecto (SRP, OCP, LSP, ISP, DIP, DRY,
   claridad, errores: definición, fuente, qué viola, qué cumple, qué ya ve un gate).
5. Invocar la skill: "auditá el módulo X", "revisá los cambios contra main".

Sin perfil, la skill dice qué falta y termina; con un perfil de una versión que no entiende, lo
rechaza nombrando las dos.

## Inventario

| Entrada           | Qué es                                                                                                                     | Fuente o derivado | Quién lo lee                         | Verificación                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `.claude-plugin/` | `plugin.json`: nombre, versión semver, descripción.                                                                        | fuente            | Claude Code                          | `tests/audit/plugin-isolation.test.ts`; `claude plugin validate`   |
| `skills/`         | `auditing-architecture/` (SKILL.md, `references/`, `scripts/`, `evals/` universales). D-02 agrega `conditioning-project/`. | fuente            | Claude Code; `tests/audit/` por ruta | `tests/audit/audit.test.ts` (evals propias del repo y universales) |
