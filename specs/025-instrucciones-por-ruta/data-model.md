# Data model — El núcleo se lee siempre; el resto carga cuando hace falta (025)

No hay entidades de dominio: la feature no toca `src/`. Lo que hay es el **vocabulario de los tres
destinos**, que es lo que US3 tiene que dejar escrito y lo que el gate verifica.

## Los tres destinos de una instrucción

La pregunta que los separa, en este orden:

```
¿Hace falta en TODA sesión?
  sí  → el núcleo
  no  → ¿es un procedimiento de varios pasos?
          sí  → una skill        (fuera de alcance en esta feature)
          no  → una regla acotada a la parte del código donde se aplica
```

| Destino           | Cuándo entra al contexto                     | Ejemplo real del repositorio                        |
| ----------------- | -------------------------------------------- | --------------------------------------------------- |
| **Núcleo**        | siempre, al arrancar                         | el flujo de trabajo; las reglas que fallan el build |
| **Regla acotada** | cuando el agente lee un archivo de esa parte | cómo se escribe un caso de uso                      |
| **Skill**         | cuando se la invoca                          | la auditoría de arquitectura                        |

**El límite del núcleo es 200 líneas**, y el motivo no es el costo de contexto: la documentación
oficial dice que un archivo más largo **se obedece peor**. El límite se cuenta **con los punteros
adentro** — fue lo que la spec omitió y el plan corrigió.

## La regla acotada

|                        |                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Dónde vive**         | `.claude/rules/<tema>.md`, hermano de `.claude/skills/`                                                                   |
| **Qué declara**        | `paths`: a qué archivos se aplica. **Sin eso no ahorra nada**: una regla sin acotar carga al arrancar igual que el núcleo |
| **Qué deja atrás**     | su **invariante de una línea** en el núcleo: lo que impide equivocarse antes de que la regla llegue                       |
| **Cuándo no se mueve** | cuando esa invariante no alcanza y el agente quedaría expuesto (FR-004); entonces se queda, con el motivo escrito         |

### Las seis, con su acotación y su invariante

| Regla                          | Se acota a                     | La línea que queda en el núcleo                                                                   |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Notas del contrato             | el contrato                    | el contrato es la única fuente de verdad de la superficie HTTP                                    |
| Anillos y módulos              | el código fuente               | la dependencia va sólo hacia adentro; un módulo importa de otro sólo por su índice                |
| Cómo se escribe un caso de uso | la capa de aplicación          | una clase con `execute`, dependencias interfaces; un error de negocio se devuelve, nunca se lanza |
| Gates de calidad               | el código fuente y las pruebas | un cambio no entra si un mutante de sus propias líneas sobrevive                                  |
| Cómo se escribe una entidad    | el dominio                     | clase si hay reglas, tipo si no; las reglas viven con su dueño                                    |
| Auditoría de arquitectura      | las evaluaciones y las skills  | el método vive en la skill; lo de este repo, en su perfil                                         |

**Las seis pasan FR-004 por el mismo motivo**: su invariante está sostenida por un gate que falla en
el acto, así que equivocarse cuesta un ciclo de gate y no una revisión.

## Lo que se queda, y por qué

| Sección                    | Por qué no se mueve                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Flujo de trabajo           | hace falta antes de tocar nada                                                                                     |
| Convenciones               | atraviesan todo el código                                                                                          |
| Documentación viva         | se aplica a cada documento que se escribe                                                                          |
| **Tipado**                 | **decisión del plan**: ya es casi toda invariante y su alcance sería casi universal — el peor negocio de las siete |
| Reglas que fallan el build | su valor es estar juntas y a la vista                                                                              |
| Fuentes de verdad          | fija la precedencia; se necesita antes de leer cualquier otra cosa                                                 |
| `HANDOFF.md`               | qué hacer al arrancar                                                                                              |

## La tabla de comandos: no se mueve, se **fusiona**

Es el único caso que no es una mudanza. Medido: **26 de sus 30 comandos ya están descritos en
`scripts/README.md`**, un inventario que ADR-032 gobierna y que una prueba ya verifica fila por fila.

- **Al inventario**: lo que le falte, agregado **antes** de borrar la tabla.
- **Se queda en el núcleo**: los siete del lazo normal, que el flujo de trabajo ya enumera —
  `format:check`, `quality`, `typecheck`, `test`, `test:mutation`, `test:contract`, `contract:check`.
- **Los cuatro que no son scripts de `scripts/`** (`build`, `arch`, `format`,
  `check:mutation-report`) no se pierden: el plan los ubica sin dejarlos fuera de los dos lugares.

## Lo que el gate agrega a lo que ya verificaba

Sobre lo de la feature 024 —lo citado existe, cada sección clasificada, en los dos sentidos—, dos
verificaciones propias de esta feature:

| Verificación                       | Por qué                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Toda regla declara a qué se aplica | una regla sin acotar no ahorra nada, y no decidirlo no puede pasar inadvertido |
| Esa parte del código existe        | una regla que nunca se puede activar es una regla muerta                       |
