# Glosario del lenguaje ubicuo

Una nota por término. La constitución y los documentos del MVP hablan en castellano; el
contrato, en inglés. **Ningún sustantivo entra al contrato sin su nota**, y ninguna nota entra
sin `fuente`: traducir es una decisión, y la decisión tiene que estar citada (ADR-008).

`npm run check:glossary` verifica que todo sustantivo de ruta y de esquema del contrato
resuelva al `en` de una nota (o a `_tecnicos.json`), que toda nota tenga fuente existente y que
las notas sin uso lo declaren.

## Plantilla

```markdown
---
es: término en castellano
en: term
contexto: ingesta | decision | medicion | portal | plataforma | identidad
estado: aprobado | propuesto
fuente: constitucion#VI | mvp:01-arquitectura-mvp.md#7 | ruta/en/el/repo.md#sección
uso: disponible | pendiente        # sólo si el contrato todavía no usa el término
---

# término -> `term`

> Cita textual de la fuente.

Notas: falsos amigos, qué NO es, relación con otros términos.
```

`fuente` con `mvp:` apunta a los documentos del MVP en `..` (fuera del repo, a propósito); se
verifica cuando el directorio está disponible (`OPE_MVP_DOCS`). `_tecnicos.json` es la única
lista de vocabulario técnico.
