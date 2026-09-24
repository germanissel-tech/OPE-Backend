# Research — Las instrucciones tienen criterio de admisión y gate (024)

Todo lo de acá se midió en la rama `024-instrucciones-verificadas`, que sale de
`023-reparto-sin-ajuste-silencioso` (`4329755`). Cada decisión cita la evidencia y qué se descartó.

---

## R-01 — Dónde corre el gate

**Decisión**: un `check:*` propio dentro de `contract:check`. **No** una prueba del proyecto `tools`.

**Evidencia, y es la que decide la feature.** La intuición era seguir a `tests/docs/readmes.test.ts`
hasta el final y poner la verificación en el proyecto `tools`. Se midió `TOOLS_TRIGGERS`
(`scripts/test-scope.mjs`) y **ni `CLAUDE.md` ni `src/` están en la lista**:

```
scripts/  .claude/  contracts/  docs/  tests/audit/  tests/docs/  scripts/audit/
audit.profile.json  config/schemas/  generated/schemas/  tests/governance/quality.test.ts
tests/unit/contract-docs.test.ts  vitest*.config.ts  package.json  package-lock.json  .github/
```

Y `.github/workflows` corre `test:scoped` —no `test:all`—, así que el proyecto `tools` sólo se
ejecuta cuando cambia uno de esos caminos. Consecuencia medida: **una prueba en `tools` no habría
corrido en el commit que rompió lo que esta feature arregla.** La ventana de firma se movió en un
cambio de `src/` (`d0f9f09`), que no dispara `tools`.

Se podría agregar `CLAUDE.md` y `src/` a los disparadores, pero `src/` como disparador de `tools`
haría que el proyecto lento corra en casi todo commit, que es exactamente lo que la lista existe
para evitar (decisión del dueño del 2026-09-21, dos velocidades).

`contract:check` corre **siempre**: en CI sin condición y antes de cualquier commit. Ya hospeda los
seis `check:*` de gobernanza (`glossary`, `identifiers`, `adrs`, `markers`, `language`, `api-map`) y
`CLAUDE.md` es un documento de gobernanza. Ése es su lugar.

**Lo que sí se toma prestado del modelo de ADR-032** es la **forma**, no el hospedaje: política
declarada en un archivo, funciones puras sobre texto en una biblioteca, y verificación en los dos
sentidos (algo sin política **y** política sin algo).

---

## R-02 — Los identificadores

**Decisión**: extender `check:identifiers` para que lea `CLAUDE.md`, sin tocar nada de su lógica.

**Evidencia**. El verificador ya arma su lista así:

```js
const documents = [constitution, ...docsDirs.flatMap((d) => walkFiles(d, [".md"]))].filter(exists);
```

Agregar un archivo suelto a esa lista es una línea, y **el precedente existe y está probado**:
`check-adrs.mjs` y `check-markers.mjs` ya incluyen `CLAUDE.md` en la suya. Además el verificador ya
acepta un archivo por `--constitution`, que es como se corrió la medición de esta auditoría.

Corrido a mano hoy: **366 de 368 identificadores resuelven**. Los 2 que no son `multipleOf`, palabra
de JSON Schema, que entra al allowlist con su motivo como ya entraron `TS2882` y `OPE_MOCK`.

**Lo que esto no cubre**, y por eso hace falta R-03: el verificador descarta por prosa todo span que
contenga `/`, `.`, espacio, `(`, `:`, `<`, `$`, `#` o `@` (`PROSE_CHARS`). Toda ruta cae ahí. **Por
eso la referencia vieja sobrevivió tres días**: nadie la miraba. No se toca `PROSE_CHARS`: está bien
para lo que hace, y las rutas necesitan otra cosa —resolverse contra el disco, no buscarse en un
texto—.

---

## R-03 — Las rutas

**Decisión**: verificación propia, con **raíces implícitas declaradas** y **tres formas excluidas**
por su naturaleza, no por una lista de nombres.

**Evidencia**. Medido sobre las 140 rutas citadas:

|                                       |        |
| ------------------------------------- | ------ |
| Resuelven tal cual desde la raíz      | **72** |
| Resuelven sólo con una raíz implícita | **47** |
| No resuelven con ninguna              | **21** |

Las seis raíces implícitas que el documento usa hoy, con su frecuencia: `src/` ×24,
`src/composition/` ×8, `src/interface-adapters/` ×6, `../` ×3, `contracts/` ×3, `src/domain/` ×3.
**Declararlas** en la política. Se descartó **prohibirlas**: obligaría a escribir la raíz en 47
lugares, alargando el documento, que es lo contrario de lo que la feature busca (`## Assumptions` de
la spec ya lo anticipa).

De las 21 que no resuelven, **19 no son rutas** y se agrupan en tres formas:

1. **Nombres de forma** (`errors.ts`, `services/`, `ports/`, `index.ts`, `use-cases/`,
   `controllers/`, `ids.ts`): el documento los usa para decir «un archivo así **en cada** módulo».
   No apuntan a un lugar; describen una convención.
2. **Identificadores de reglas de lint** (`ope/no-magic-strings`, `ope/use-case-shape`,
   `ope/domain-error-shape`, `ope/no-throw-domain-error`, `ope/domain-no-loose-functions`,
   `ope/dependencies-are-interfaces`, `ope/no-generic-catch-in-application`): la barra es del
   espacio de nombres del plugin, no del sistema de archivos. **Éstas ya las verifica
   `check:identifiers`** por otra vía (son tokens del tooling), así que excluirlas acá no las deja
   sin dueño.
3. **Referencias que no son del repositorio**: `origin/main` (git), `merchantId/orderId` (clave
   compuesta), `HANDOFF.md` y `research.md` (archivos que existen a veces, por definición).

Las dos que **sí** son rutas y no resuelven son el hallazgo: la ventana de firma en su módulo viejo.

**Cómo se excluyen importa.** Una lista de diecinueve nombres sería una lista que envejece. Las
formas 1 y 2 se reconocen por su forma —un nombre sin raíz que coincide con una convención
declarada; un prefijo de plugin declarado— y la 3 por una excepción con motivo, que es el mecanismo
que el repositorio ya usa. El gate tiene que dar **cero** falsos positivos sobre las 19: es criterio
de éxito (SC-001) y se comprobó que un gate ingenuo da 75.

---

## R-04 — La tabla de comandos

**Decisión**: comparar en los dos sentidos contra `package.json`, con excepciones declaradas.

**Evidencia**. `package.json` declara 38 scripts. Medido: **`check:mutation-report` existe y aparece
cero veces** en el documento que dice ser la tabla de comandos. Ninguno de los documentados falta en
`package.json`.

El sentido «documentado pero inexistente» hoy está en cero y conviene que siga: es el que convierte
la tabla en una promesa falsa. El sentido «existe y no está documentado» es el que encontró el
hueco. Los dos, entonces.

Excepciones previsibles: `prepare` y `postinstall` son ganchos de npm, no comandos que un agente
invoque. Entran como excepción con motivo en vez de forzar una fila que nadie va a leer.

---

## R-05 — El criterio de admisión, y cómo se verifica

**Decisión**: cada sección declara en la política si es **normativa** o **descriptiva**, y el gate
verifica en los dos sentidos: una sección sin política falla, y una política sin sección también.

**Evidencia**. Es exactamente lo que `checkPolicies` hace hoy con los directorios
(`tests/docs/readmes.test.ts`: «a top-level directory without a policy, or a policy without a
directory, is a problem»). Esa simetría es la parte que **obliga a decidir**: abrir una sección
nueva no se puede hacer en silencio.

El criterio, aplicado a las catorce secciones de hoy, no deja ninguna en «depende»:

| Sección                        | Líneas  | Cae en          | Por qué                                                        |
| ------------------------------ | ------- | --------------- | -------------------------------------------------------------- |
| Fuentes de verdad              | 8       | normativa       | fija un orden de precedencia; no lo dice ningún otro documento |
| Flujo de trabajo               | 50      | normativa       | qué hacer y en qué orden; sin otro hogar                       |
| Comandos                       | 35      | descriptiva     | deriva de `package.json`; se queda porque el gate la sostiene  |
| Anillos y módulos              | 80      | mixta           | la tabla de qué puede importar qué la verifica `arch`          |
| Cómo se escribe un caso de uso | 59      | normativa       | es la instrucción; ADR-023 es su fundamento, no su reemplazo   |
| Cómo se escribe una entidad    | 45      | normativa       | ídem con ADR-024                                               |
| Gates de calidad               | 51      | mixta           | los umbrales viven en la configuración del linter              |
| Tipado                         | 17      | normativa       | qué está prohibido escribir                                    |
| **Notas operativas**           | **219** | **descriptiva** | **diez bloques, los diez citan un ADR: es el acople**          |
| Documentación viva             | 18      | normativa       | cómo se escribe documentación acá                              |
| Auditoría de arquitectura      | 12      | descriptiva     | describe dónde viven las skills; ADR-032 lo decide             |
| Reglas que fallan el build     | 12      | normativa       | el resumen ejecutable; su valor es estar juntas                |
| Convenciones                   | 44      | mixta           | mezcla reglas de escritura con descripciones del sistema       |
| Si existe `HANDOFF.md`         | 3       | normativa       | qué hacer al arrancar                                          |

**Aparece una tercera categoría que la spec no anticipó: `mixta`** (Anillos, Gates de calidad,
Convenciones). No es «depende»: es que la sección tiene párrafos de los dos tipos. El plan la trata
declarando la sección como mixta y dejando la separación de sus párrafos para la historia 3, que es
donde se decide qué se muda. Forzarlas a un lado ahora sería mentirle a la política.

---

## R-06 — Qué se muda y qué no

**Decisión**: se mudan los **diez bloques** de «Notas operativas del contrato», de a uno, y sólo si
el puntero alcanza. Nada más se muda en esta feature.

**Evidencia**. Los diez bloques suman 195 de las 219 líneas de esa sección y **los diez ya citan el
ADR que los decide**:

| Bloque                         | Líneas | ADR             |
| ------------------------------ | ------ | --------------- |
| Plano de decisión              | 34     | ADR-026/027     |
| Configuración del SDK          | 33     | feature 017     |
| Merchants operados             | 28     | ADR-031         |
| Asignación y experimentos      | 23     | ADR-022/024/031 |
| Outcomes y cadena de evidencia | 21     | ADR-028         |
| Consumidores                   | 19     | ADR-020         |
| Firma de plataforma            | 13     | ADR-029         |
| Verdad de producto             | 11     | ADR-025         |
| Puerto de plataforma           | 9      | ADR-025         |
| Ledger                         | 4      | ADR-021/023     |

Los ADR destino suman 636 líneas, así que el contenido cabe donde ya se decidió.

**Uno no tiene ADR**: «Configuración del SDK y diagnóstico de anclajes» (33 líneas) cita la feature
017 y el documento de arquitectura, no un ADR. Es el más grande después del plano de decisión y su
mudanza necesita un destino que no existe. El plan lo deja **explícitamente para el final** y, si al
llegar no hay destino, se queda con su motivo escrito: inventar un ADR para poder mudar sería el
tipo de trámite que esta feature debería estar eliminando.

**El criterio de la mudanza no es el ahorro de líneas.** Se muda un bloque sólo si lo que queda —de
qué se trata y dónde está— le alcanza a un agente para llegar en un paso. La spec ya lo fijó y el
plan no lo relaja.

---

## R-07 — Dónde se registra la decisión

**Decisión**: **enmienda de ADR-032**. No un ADR nuevo.

**Evidencia**. ADR-032 es el que decidió «método portable, perfil por proyecto» e inventó el patrón
que esta feature reusa: política declarada más prueba que la verifica, con la simetría que obliga a
decidir. Extenderlo del inventario de directorios a las instrucciones de los agentes es la misma
decisión aplicada a otro documento. Un ADR nuevo obligaría a leer dos para entender un patrón.

---

## R-08 — Compatibilidad

No toca el contrato, ni `src/`, ni ninguna superficie HTTP. `contract:diff` no tiene nada que
reportar y `info.version` no se mueve.

---

## Lo que no se investigó y por qué

- **Un límite de líneas para el documento.** La spec lo dejó fuera de alcance con su motivo (una
  meta numérica premia borrar cosas útiles) y el plan no lo reabre.
- **Verificar que la prosa sea correcta.** Fuera de alcance por la spec, y además ninguna
  herramienta puede sostenerlo. La diferencia entre «lo nombrado existe» y «lo escrito es cierto»
  queda escrita donde vive el criterio, para que nadie la confunda al leer el gate en verde.
- **Mudar lo mixto párrafo por párrafo dentro de Anillos, Gates y Convenciones.** Se identificó en
  R-05 pero no se resolvió: es trabajo de la historia 3 y su tamaño no se conoce hasta tener el
  criterio escrito y aplicado a los diez bloques primero.
