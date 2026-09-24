# La política declarada y lo que el gate reporta (024)

Esta feature no tiene superficie HTTP. Su contrato es el **archivo de política** que declara qué se
espera de las instrucciones, y la **forma del reporte** cuando algo no se cumple. Los dos siguen el
molde de `scripts/readme-inventory-policy.json` (ADR-032), que ya funciona y que nadie tiene que
aprender de nuevo.

## Forma de la política

```jsonc
{
  // Las raíces con las que el documento abrevia una ruta, en orden de intento.
  // Medidas hoy: src/ ×24, src/composition/ ×8, src/interface-adapters/ ×6,
  // ../ ×3, contracts/ ×3, src/domain/ ×3.
  "implicitRoots": [
    "",
    "src/",
    "src/composition/",
    "src/interface-adapters/",
    "src/domain/",
    "contracts/",
    "../",
  ],

  // Lo que se escribe con barras y no apunta a un lugar. Por forma, no por nombre.
  "notPaths": {
    // Un nombre sin raíz que nombra una convención repetida en cada módulo.
    "shapeNames": ["errors.ts", "index.ts", "ids.ts", "services/", "ports/", "use-cases/", "controllers/"],
    // Prefijos de espacios de nombres que no son directorios.
    "namespacePrefixes": ["ope/"],
  },

  // Cada sección del documento, con su clase. En los dos sentidos:
  // una sección sin entrada falla, y una entrada sin sección también.
  "sections": [
    { "heading": "Fuentes de verdad, en este orden", "kind": "normative" },
    { "heading": "Notas operativas del contrato", "kind": "descriptive" },
    {
      "heading": "Convenciones",
      "kind": "mixed",
      "reason": "mezcla reglas de escritura con descripciones del sistema; se separa en la historia 3",
    },
    // … las catorce
  ],

  // Lo que a propósito no resuelve. Sin motivo, falla.
  "exceptions": [
    {
      "cite": "multipleOf",
      "reason": "Palabra de JSON Schema, no un identificador del sistema (ADR-035 la nombra para descartarla).",
    },
    { "cite": "origin/main", "reason": "Referencia de git, no una ruta del árbol." },
    {
      "cite": "HANDOFF.md",
      "reason": "Existe sólo mientras hay una tarea en curso; el documento explica justamente eso.",
    },
    { "script": "prepare", "reason": "Gancho de npm, no un comando que un agente invoque." },
    { "script": "postinstall", "reason": "Gancho de npm; aplica los parches." },
  ],
}
```

**`kind` sólo admite `normative`, `descriptive` o `mixed`**, y `mixed` **exige `reason`**: declararla
mixta es admitir una deuda concreta, no esquivar la decisión.

## Qué reporta el gate

Una línea por problema, con el archivo y la línea, como los demás `check:*`:

```
CLAUDE.md:498: ruta que no existe: application/merchant/policies/signature-window.ts
package.json: comando sin documentar: check:mutation-report
CLAUDE.md: sección sin política: "## Sección nueva"
scripts/instructions-policy.json: política para una sección que no existe: "## Sección vieja"
scripts/instructions-policy.json: excepción sin motivo: "algo"
Instructions: 140 rutas, 38 comandos, 14 secciones; N problema(s)
```

La última línea sale siempre, en verde también — como `Identifiers: 488 cited, 0 unknown`. Un gate
que sólo habla cuando falla no deja ver que sigue mirando.

## Qué tiene que reportar **hoy**, antes de arreglar nada

Es el criterio de éxito SC-001 y la única prueba de que el gate sirve:

| Reporte esperado                                  | Por qué                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| La ruta de la ventana de firma en su módulo viejo | Se movió en la feature 020 y el documento no                  |
| `check:mutation-report` sin documentar            | Existe en `package.json`, cero menciones                      |
| **Nada más**                                      | Las 19 no-rutas no se reportan; un gate ingenuo reportaría 75 |

## Lo que la política **no** declara

- **Un largo máximo.** Fuera de alcance por la spec: una meta numérica premia borrar cosas útiles.
- **Qué debe decir cada sección.** El gate verifica que lo nombrado exista, no que lo escrito sea
  cierto. Esa frontera va escrita en el criterio, no sólo acá.
- **El orden de las secciones.** No hubo evidencia de que importe; agregar la regla sería inventar
  trabajo.
