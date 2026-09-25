# Quickstart — verificar que OPE muestra texto y que no se redacta por producto (027)

Cada paso lo decide un comando, salvo el último, que lo decide leer.

## 1. El placeholder ya no existe

```bash
grep -rn "MESSAGE_PLACEHOLDER_VERSION\|msg_.*_v0" src/ contracts/ --include=*.ts --include=*.yaml
```

**Nada.** Mientras quede una ocurrencia, la feature no está hecha: es el síntoma que la motivó.

## 2. Una intervención llega con texto

Levantar el servidor de desarrollo y provocar una decisión que intervenga:

```bash
npm run dev
# en otra terminal, un lote que dispare una barrera con evidencia suficiente
```

La respuesta lleva el texto y el anclaje. **Y sigue sin llevar** barrera, brazo, experimento,
política, margen ni escalón:

```bash
npx vitest run --project fast tests/integration --reporter=verbose 2>&1 | grep -i "intervention\|message"
```

## 3. Dos productos, dos textos, cero redacción

El caso del stakeholder. Dos productos que difieren **sólo** en el valor de un atributo mapeado:

```bash
npx vitest run --project fast tests/unit/application/messages
```

Verde significa: cada uno recibe la prosa curada de su valor, el que no trae el atributo cae al
escalón de abajo, y dos etiquetas distintas del merchant que apuntan al mismo valor reciben el mismo
texto.

## 4. Agregar productos no cuesta redacción

```bash
git diff --stat main -- config/
```

Cargar productos nuevos cuyos valores ya están mapeados **no toca ningún archivo**. Si aparece un
cambio en el corpus por haber agregado productos, el mecanismo está mal: se está redactando por
producto.

## 5. El valor crudo del merchant no sale nunca

```bash
npx vitest run --project fast tests/unit/domain/messages
```

Incluye el caso del copy de marketing: un atributo cuyo valor es «Algodón premium insuperable» o
mapea a un valor de OPE y se usa la prosa de OPE, o el producto no habla de eso. **Nunca** se
muestra la etiqueta.

## 6. Sin texto no es lo mismo que decidir callarse

```bash
npx vitest run --project fast tests/unit/application/decision
grep -n "message-unavailable" contracts/no-op-reasons.yaml
```

El motivo existe en el catálogo y se distingue de `control-arm`, `barrier-unclear` y de todos los
demás. Y lo que hay que comprobar además: **los presupuestos no se consumen** cuando no hubo texto,
igual que con `ledger-unavailable`.

## 7. El idioma resuelve por cadena y nunca miente

```bash
npx vitest run --project fast tests/unit/domain/messages/locale-chain
```

Un idioma sin texto propio prueba los de la cadena en orden. Agotada la cadena responde
`message-unavailable` — **jamás** un texto en otro idioma. Y la voz sí repliega a la voz por
defecto: fuera de voz se entiende, fuera de idioma no.

## 8. La versión registrada sobrevive a un cambio del corpus

```bash
npx vitest run --project fast tests/unit/domain/ledger
```

Una decisión registrada sigue diciendo qué versión mostró aunque el corpus cambie después. Si el
texto de una versión se puede editar en el lugar, el pasado del ledger es reescribible y `FR-019`
no se cumple.

## 9. El merchant ve lo que le falta mapear

```bash
npx vitest run --project fast tests/integration/messages
```

Un catálogo con valores sin correspondencia los deja listados con su conteo, y **nunca** rechaza ni
demora la ingesta. Alcanzado el tope, se descarta el más viejo.

## 10. El contrato y la cadena completa

```bash
npm run contract:check
npm run format:check && npm run quality && npm run typecheck
npm test && npm run test:tools
npm run test:contract && npm run release-check
```

`contract:check` incluye `check:api-map`, así que ahí se ve que `publishMessageCatalog` salió del
mapa y que lo que se construyó está declarado.

## 11. Lo que ningún comando decide

Leer **un texto del corpus** y preguntarse si alguien lo escribiría así. Si lee a ficha técnica, o
si hay que releerlo para entender que concuerda, el problema no es el texto: es que se coló una
plantilla donde tiene que haber prosa.

Y leer un texto **de la voz que no es la por defecto**, si ya hubiera dos, contra el mismo mensaje
en la voz neutra. Si no se distinguen, la voz no está haciendo nada y sobra.

## Dónde se toca qué, después de esto

| Si querés…                          | Se toca                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| corregir un texto                   | el corpus, acuñando una versión nueva; nunca editando la existente    |
| que OPE sepa hablar de una tela más | el vocabulario de valores y la prosa de ese valor                     |
| que una tienda hable de sus telas   | su correspondencia de etiquetas, en su configuración                  |
| agregar una voz                     | una entrada en el vocabulario y sus textos; ninguna estructura cambia |
| agregar un idioma                   | los textos de ese idioma y la cadena del merchant                     |
| agregar productos                   | **nada**                                                              |
