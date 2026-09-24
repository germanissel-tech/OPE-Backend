# Quickstart — verificar que el núcleo entra en una pasada (025)

Cada fila la decide un comando.

## Antes de empezar

```bash
claude --version
```

Tiene que decir **2.1.198 o superior**: es la versión desde la que las reglas acotadas funcionan
completas. Verificado al abrir la feature: 2.1.280. **Si la herramienta bajó de versión, parar**:
sin reglas acotadas esta feature no tiene mecanismo.

## Las garantías

### 1. El núcleo entra en una pasada

```bash
wc -l CLAUDE.md
```

Menos de **200**. Es el umbral que la documentación oficial publica, y su motivo no es el costo de
contexto: un archivo más largo **se obedece peor**. Contra la serie que venía subiendo —360 → 675 →
573— ésta es la cifra que cierra.

El gate lo dice solo, que es lo que importa:

```bash
npm run check:instructions
```

### 2. Nada se perdió

```bash
wc -l CLAUDE.md .claude/rules/*.md
```

La suma contra las 573 de partida, menos lo que se consolidó a propósito —la tabla de comandos, que
se fusionó con un inventario que ya la describía— y eso está enumerado en el commit. **La revisión
es por sección, no por total**: un total que cierra puede esconder una sección que se fue entera.

### 3. Cada regla se acota, y a algo que existe

```bash
node -e 'const p=require("./scripts/instructions-policy.json");
for (const f of p.files.filter(f => f.role === "rule"))
  console.log(f.file.padEnd(36), (f.paths ?? ["SIN ACOTAR"]).join(", "));'
```

Las seis con su acotación, ninguna sin. Y que la acotación alcance algo:

```bash
npm run check:instructions     # falla si un patrón no matchea ningún archivo
```

Una regla que nunca se puede activar es una regla muerta, y sin esta verificación no habría señal de
que lo es.

### 4. El gate mira los siete archivos, no uno

```bash
printf '\n- Una ruta que no existe: `src/inventado/cosa.ts`\n' >> .claude/rules/caso-de-uso.md
npm run check:instructions     # tiene que fallar nombrando el archivo y la línea
git checkout .claude/rules/caso-de-uso.md
```

Y lo mismo con las otras cinco. Partir el documento sin esto sería deshacer la feature 024 con más
lugares donde esconderse.

### 5. Las otras tres verificaciones también llegan

```bash
npm run check:identifiers && npm run check:adrs && npm run check:markers
```

Los recuentos tienen que subir respecto de antes de la partición: si no suben, están leyendo sólo el
núcleo y las reglas quedaron sin verificar.

### 6. La invariante alcanza

Ésta no la decide un comando, y conviene decirlo. Por cada regla que se fue, leer **sólo** lo que
quedó en el núcleo y preguntarse si alcanza para no equivocarse antes de que la regla llegue. Si no
alcanza, esa sección vuelve, con el motivo escrito (FR-004).

El caso a mirar con más cuidado es el de escribir un caso de uso: un agente creando el **primer**
archivo de la capa todavía no leyó ninguno, así que la regla no cargó.

## Que nada más se movió

```bash
npm run format:check && npm run quality && npm run typecheck
npm test && npm run test:tools
npm run contract:check
npm run release-check
```

`contract:diff` no tiene nada que reportar: esta feature no toca el contrato ni `src/`.

## Dónde se toca qué, después de esto

| Si querés…                                         | Se toca                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| agregar una instrucción                            | la pregunta «¿hace falta en toda sesión?» decide el destino    |
| agregar una regla acotada                          | su archivo **y** su entrada en la política; sin las dos, falla |
| cambiar a qué parte del código se aplica una regla | su acotación en la política                                    |
| documentar un comando                              | el inventario de `scripts/`, no el núcleo                      |

## Lo que esto **no** verifica

Que la invariante que quedó en el núcleo sea suficiente. Eso lo dice el uso: si un agente se
equivoca en algo que la regla habría evitado, la invariante era corta y vuelve al núcleo. El gate
mide el largo y la existencia, no la suficiencia.

## Estado al cierre de la implementación (2026-09-24)

Histórico y fechado, como pide la convención de documentación viva.

| Verificación                                   | Resultado                                                      |
| ---------------------------------------------- | -------------------------------------------------------------- |
| Núcleo                                         | **194 líneas** (umbral: 200). Serie: 360 → 675 → 573 → 194     |
| Suma de las siete instrucciones                | 617 líneas; el crecimiento sobre 573 es frontmatter y punteros |
| Contenido perdido                              | ninguno; lo único consolidado fue la tabla de comandos         |
| Reglas acotadas                                | 6, todas con `paths`, todos los patrones alcanzan algo         |
| El gate contra el núcleo **sin partir**        | falló con 574 contra 200, que era la prueba                    |
| Archivos que el gate verifica                  | 7 · 155 rutas · 10 comandos · 17 secciones                     |
| `check:identifiers` / `adrs` / `markers`       | alcanzan las siete instrucciones                               |
| `npm test` (`fast`) · `test:tools`             | 1303 · 44 en `tests/docs`                                      |
| `quality` · `contract:check` · `release-check` | verdes                                                         |

**Lo que la implementación encontró y el plan no había previsto:**

1. **El título del núcleo nunca había estado clasificado.** La verificación miraba de `##` para
   abajo, y el `#` de arriba —que lleva la convención de idioma de ADR-015— quedaba fuera. Apareció
   sola al mudar la primera regla, porque el título de un archivo de regla **es** su única sección.
2. **La fusión de la tabla obligó a que el gate acepte dos lugares.** Si el núcleo deja de listar
   los treinta comandos, los que quedan descritos en el inventario de `scripts/` se reportarían como
   sin documentar. Ahora cuentan los dos; lo que no puede pasar es un comando descrito en ninguno.
   Pedirle al núcleo la lista completa era precisamente lo que hacía de esa tabla una segunda copia.
3. **Faltaban treinta líneas y estaban en el flujo de trabajo.** Los seis pasos del orden dentro de
   una feature que toca HTTP son detalle del contrato, no del flujo: se fueron a su regla.
4. **El bloque de código no se lee, por diseño.** Al escribir el lazo de comandos dentro de un
   ` ```bash `, el gate dejó de verlos: las citas dentro de un bloque cercado se saltean a propósito.
   La tabla volvió, de diez filas en vez de treinta.

**La verificación que ningún comando decide** (FR-004): leídos los seis punteros como los leería un
agente sin la regla cargada, los seis alcanzan. Ninguna sección volvió al núcleo. El de la entidad
ganó una cláusula de seis palabras —que `src/domain/` no exporta funciones sueltas— porque era lo
único que un agente podía intentar sin que el puntero se lo dijera.
