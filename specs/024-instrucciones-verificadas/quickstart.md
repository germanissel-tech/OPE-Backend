# Quickstart — verificar que las instrucciones no pueden mentir en silencio (024)

Cada fila la decide un comando.

## La prueba de que el gate sirve

**Se corre antes de arreglar nada.** Un gate escrito después del arreglo no demuestra nada.

```bash
git stash          # con el CLAUDE.md de hoy, sin corregir
npm run check:instructions
```

Tiene que reportar **exactamente dos cosas**: la ruta de la ventana de firma en su módulo viejo y
`check:mutation-report` sin documentar. **Ni una más.** Si reporta alguna de las diecinueve que se
escriben con barras y no son rutas —`errors.ts`, `services/`, `ope/no-magic-strings`, `origin/main`,
`merchantId/orderId`—, el gate está mal: un gate ingenuo reporta setenta y cinco, medido.

## Las garantías

### 1. Una referencia vieja falla

```bash
npm run check:instructions     # verde después del arreglo
```

Y que falle de verdad, no por casualidad:

```bash
git mv src/domain/experiment/experiment.ts src/domain/experiment/renombrado.ts
npm run check:instructions     # tiene que fallar nombrando la línea
git mv src/domain/experiment/renombrado.ts src/domain/experiment/experiment.ts
```

### 2. La tabla de comandos, en los dos sentidos

```bash
npm pkg set scripts.inventado="echo hola" && npm run check:instructions   # falla: sin documentar
npm pkg delete scripts.inventado
```

Y al revés: documentar un comando que no existe también falla. Los dos sentidos, porque el primero
es el que encontró el hueco y el segundo es el que evita que la tabla prometa lo que no hay.

### 3. Abrir una sección obliga a decidir

```bash
printf '\n## Sección nueva\n\nalgo\n' >> CLAUDE.md
npm run check:instructions     # falla pidiendo que se declare su clase
git checkout CLAUDE.md
```

Y la simetría, que es la mitad que se olvida: una política para una sección que ya no existe también
falla.

### 4. El gate corre solo

```bash
npm run contract:check | grep -i instruc
```

Tiene que aparecer. Vive ahí y no en el proyecto `tools` por un motivo medido: **ni `CLAUDE.md` ni
`src/` disparan `tools`**, así que una prueba allá no habría corrido en el commit que movió la
ventana de firma — el commit que esta feature existe para atrapar.

### 5. El criterio está escrito y no deja «depende»

```bash
node -e 'const p=require("./scripts/instructions-policy.json");
const n=p.sections.length, k={};
for(const s of p.sections) k[s.kind]=(k[s.kind]||0)+1;
console.log(n,"secciones:",k);
console.log("mixtas sin motivo:", p.sections.filter(s=>s.kind==="mixed"&&!s.reason).length);'
```

Catorce secciones, cada una con clase, y **cero mixtas sin motivo**. Una sección mixta sin motivo es
lo mismo que no haberla clasificado.

### 6. El documento bajó

```bash
wc -l CLAUDE.md
```

Contra la serie que venía subiendo: 360 → 675 en seis días, monótona. **Ésta es la primera vez que
baja.** El número no es la meta —perseguir un número premia borrar cosas útiles— pero que baje una
vez es la señal de que el criterio se aplicó.

### 7. Nada se perdió en la mudanza

```bash
git diff main -- docs/adr/ | grep -c "^+"
git diff main -- CLAUDE.md | grep -c "^-"
```

Por cada bloque mudado, lo que decía tiene que estar en su destino. La revisión es por bloque, no
por total: lo que se agrega allá se escribe **antes** de borrarse acá, en ese orden y en commits
separados, para que el diff lo muestre.

## Que nada más se movió

```bash
npm run format:check && npm run quality && npm run typecheck
npm test && npm run test:tools
npm run contract:check
npm run release-check
```

`contract:diff` no tiene nada que reportar: esta feature no toca el contrato ni `src/`.

## Dónde se toca qué, después de esto

| Si querés cambiar…                                | Se toca                                                      |
| ------------------------------------------------- | ------------------------------------------------------------ |
| agregar una sección a las instrucciones           | la sección **y** su clase en la política; sin las dos, falla |
| abreviar una ruta con una raíz nueva              | la lista de raíces implícitas                                |
| citar algo que a propósito no existe              | una excepción con su motivo                                  |
| que una decisión transversal quede registrada     | su ADR; en las instrucciones va el puntero                   |
| que el gate verifique que la prosa dice la verdad | **nada: no lo hace, y está escrito que no lo hace**          |

## Lo que esto **no** verifica

Que el documento sea correcto. Verde significa que **no cita nada que no exista**, no que lo que
dice sea cierto. Eso lo verifica la revisión, y la diferencia está escrita junto al criterio
justamente para que un gate en verde no se lea como más de lo que es.
