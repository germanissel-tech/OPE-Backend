# La política extendida a archivos, y lo que el gate reporta (025)

Esta feature no tiene superficie HTTP. Su contrato es la **política declarada** —que pasa de
describir un archivo a describir siete— y la **forma del reporte**. Ninguno de los dos cambia de
diseño: es una envoltura más sobre lo que la feature 024 construyó.

## Cómo cambia la política

Hoy declara secciones sueltas. Pasa a declarar **archivos, cada uno con sus secciones**:

```jsonc
{
  // El límite vive en la política, no en el script: es el valor que gobierna el comportamiento
  // (constitución XI). Su fuente es la documentación oficial de Claude Code.
  "coreMaxLines": 200,

  "implicitRoots": ["…"], // sin cambios
  "notPaths": { "…": [] }, // sin cambios
  "commandsSection": "Comandos",

  "files": [
    {
      "file": "CLAUDE.md",
      "role": "core",
      "sections": [{ "heading": "…", "kind": "normative" }],
    },
    {
      "file": ".claude/rules/caso-de-uso.md",
      "role": "rule",
      // A qué parte del código se aplica. Sin esto la regla carga al arrancar y no ahorra nada,
      // así que falta de `paths` sin `unscopedReason` es un error.
      "paths": ["src/application/**"],
      "sections": [{ "heading": "…", "kind": "normative" }],
    },
  ],

  "exceptions": [{ "…": "con su motivo" }],
}
```

**`role` sólo admite `core` o `rule`.** Un `rule` sin `paths` **y** sin `unscopedReason` falla: no
acotar es una decisión, y no tomarla no puede pasar inadvertido.

## Qué reporta el gate

Una línea por problema, con archivo y línea, como los siete `check:*` que ya existen:

```
CLAUDE.md:498: ruta que no existe: …
.claude/rules/caso-de-uso.md:12: sección sin política: "## Algo"
scripts/instructions-policy.json: regla sin acotar y sin motivo: .claude/rules/x.md
scripts/instructions-policy.json: la acotación no alcanza ningún archivo: src/inexistente/**
CLAUDE.md: el núcleo tiene 211 líneas; el límite es 200
Instructions: 7 archivos, N rutas, 7 comandos, M secciones; nothing unverified
```

La última línea sale siempre, también en verde, como la de hoy: un gate que sólo habla cuando falla
no deja ver que sigue mirando. Gana el recuento de archivos, que es lo que esta feature agrega.

## Las dos verificaciones nuevas

| Verificación                  | Falla cuando                                            | Por qué importa                                                                                     |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Toda regla se acota**       | un `rule` no declara `paths` ni el motivo de no hacerlo | una regla sin acotar carga al arrancar: no ahorra nada y el archivo vuelve a crecer sin que se note |
| **La acotación alcanza algo** | ningún archivo del repositorio matchea el patrón        | una regla que nunca se puede activar es una regla muerta, y no hay señal de que lo sea              |

Y una tercera que es la razón de la feature: **el núcleo no supera su límite**, con el número
declarado en la política y no escrito en el script.

## Lo que la política **no** declara

- **Un mínimo de líneas.** El umbral es un techo; perseguir un piso premiaría borrar cosas útiles.
- **El orden de las reglas.** No hubo evidencia de que importe.
- **Qué debe decir cada regla.** El gate verifica que lo nombrado exista, no que lo escrito sea
  cierto — la frontera que la feature 024 dejó escrita sigue valiendo para los siete archivos.
