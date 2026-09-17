---
numero: 15
titulo: Idioma — código, comentarios y contrato en inglés; documentación de decisión en español
estado: aceptada
fecha: 2026-09-16
fuente: specs/005-auditoria-calidad/research.md
---

# ADR-015 — Idioma del código y del contrato

## Contexto

Los identificadores del repositorio están en inglés y todo lo demás —comentarios, strings,
mensajes de error y de log, descripciones del contrato OpenAPI, mensajes de las reglas del
contrato, configuraciones— en español. Quien lee el código o consume la API sin hablar
español lee un texto bilingüe: un consumidor externo del contrato, un revisor, un modelo. La
documentación de decisión (constitución, ADRs, specs, glosario, guía de agentes) tiene otro
lector: el equipo que decide, en español.

## Decisión

1. **En inglés**: todo lo que lee un desarrollador o un consumidor de la API. Identificadores,
   comentarios, strings, mensajes de error y de log, `description`/`summary`/`title` del
   contrato, `contracts/problem-types.yaml`, `contracts/no-op-reasons.yaml`, mensajes de las
   reglas de Spectral y de sus funciones, configuraciones raíz, definiciones de integración
   continua y los scripts de las skills.
2. **En español**: `docs/`, `docs/adr/`, `docs/dominio/`, `specs/`, `.specify/`, `CLAUDE.md`,
   `README.md`, `SKILL.md` y referencias de las skills, y los mensajes de commit.
3. **Verificación**: `npm run check:language` (dentro de `contract:check` y de `quality`)
   falla ante texto en español en el alcance del punto 1. Detecta caracteres propios del
   español y palabras funcionales de una lista única (`scripts/language-denylist.json`, sin
   palabras de una letra), sólo en comentarios y strings, nunca en identificadores. Las
   exclusiones son las de `.prettierignore`.
4. **Excepción**: `lang:es -- motivo` en la línea o en la anterior; sin motivo falla; se
   cuentan (`Language exceptions: N`) con objetivo permanente 0.
5. Traducir descripciones del contrato es un cambio compatible: no cambia `info.version`.

## Consecuencias

- El contrato es publicable para consumidores que no hablan español; los mensajes de error
  que devuelve la API son en inglés.
- Una frase en español en código es un defecto de build, no una observación de revisión.
- Los textos de `title`/`detail` de Problem Details cambian de idioma: las pruebas que los
  afirman literalmente se actualizan junto con el catálogo.
- `CLAUDE.md` deja de decir "código e identificadores: inglés" y pasa a decir "código,
  comentarios, strings y contrato: inglés".
