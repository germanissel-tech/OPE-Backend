# Quickstart — verificar que el vocabulario no nombra una prenda (028)

Nueve pasos. Ocho los decide un comando; el último lo decide leer.

## 1. El canario: el vocabulario viejo no existe

```bash
grep -rnE "size_selector|size_guide" src/ contracts/ config/ --include=*.ts --include=*.yaml --include=*.json
```

**Nada.** Mientras quede una ocurrencia, la feature no está hecha. `specs/` anteriores y
`docs/auditoria/` quedan afuera a propósito: son históricos y reescribirlos falsificaría lo que cada
feature decidió en su momento.

## 2. El contrato dice lo mismo que la fuente

```bash
grep -A 3 "^enum" contracts/components/schemas/Anchor.yaml
```

Cuatro anclajes, ninguno nombra una prenda, y coinciden con los que `01 §3` enumera: el selector de
variante cubre los dos selectores que la fuente listaba por separado. **Antes de esta feature no
coincidían**: la fuente listaba cinco y el contrato publicaba cuatro.

## 3. El evento perdió el campo que nadie leía

```bash
grep -c "size" contracts/components/schemas/VariantSelectorInteracted.yaml
```

El evento no tiene campos propios. Un cliente que mande el campo viejo recibe `400` por
`additionalProperties: false`, que es lo que corresponde a un vocabulario cerrado.

## 4. La decisión no cambió

```bash
npx vitest run --project fast tests/integration/decision-plane.test.ts tests/unit/application/barrier
```

Es el paso que importa más que los otros siete juntos: **un renombre que cambia una decisión no es un
renombre**. La misma secuencia de señales tiene que producir la misma barrera, con la misma confianza,
el mismo escalón y el mismo anclaje.

## 5. Las réplicas del kernel siguen al contrato

```bash
npx vitest run --project fast tests/contract
```

`ANCHORS` y `BLOCKS` viven en el dominio y tienen su prueba de réplica contra el contrato. Si una se
renombró y la otra no, esto falla — que es exactamente para lo que existe.

## 6. El corpus sirve versiones nuevas, no editadas

```bash
npx vitest run --project fast tests/unit/application/messages tests/integration/decision-plane.test.ts
node -e "const c=require('./config/messages.json');console.log(c.texts.filter(t=>t.family.includes('variant_selector')).map(t=>t.version).join('\n'))"
```

Las tres familias del anclaje renombrado sirven versiones **nuevas** y ninguna versión vieja quedó
editada. El texto es el mismo; el identificador no, porque lleva la familia adentro.

## 7. El tope de barreras desapareció y nada se rompió

```bash
grep -A 6 "  barriers:" contracts/components/schemas/MerchantConfigurationDeclared.yaml
npx vitest run --project fast tests/integration/admin-configuration.test.ts
```

Sin `maxItems`. Una configuración con las tres barreras se acepta; una con una repetida se rechaza
por `uniqueItems`, como antes. El límite ahora lo pone el vocabulario, así que el día que exista una
cuarta barrera se mueve solo.

## 8. El contrato y la cadena completa

```bash
npm run contract:check
npm run format:check && npm run quality && npm run typecheck
npm run build && npm test && npm run test:tools
npm run test:contract && npm run release-check
npm run test:mutation
```

`contract:diff` tiene que reportar el cambio incompatible y **aceptarlo** por la marca `building`
(ADR-003), con la versión en la mayor siguiente de `info.version`. `npm run build` antes de
`test:contract`: si no, prueba el `dist/` anterior y culpa al código de hoy.

## 9. Lo que ningún comando decide

Abrir `contracts/components/schemas/Anchor.yaml` y `BlockDwelled.yaml` y leerlos **como si uno vendiera
heladeras**. Si alguna descripción, algún ejemplo o algún nombre obliga a traducir mentalmente desde
la ropa, quedó vocabulario de indumentaria que el `grep` del paso 1 no atrapa porque no dice «talle».

Y leer la nota del glosario del evento: tiene que explicar qué control es, no qué atributo elige ese
control en un rubro.

## Estado, corrido el 2026-09-25

Histórico y fechado (ADR-032): lo de abajo es lo que dio ese día, no una promesa.

| Paso                                 | Resultado                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| 1. el vocabulario viejo no existe    | ✅ cero ocurrencias en `src/`, `contracts/` y `config/`                               |
| 2. el contrato dice lo que la fuente | ✅ cuatro anclajes y ninguno nombra una prenda; **antes no coincidían con la fuente** |
| 3. el evento perdió el campo         | ✅ sin campos propios; el campo eliminado da `400` con su puntero                     |
| 4. la decisión no cambió             | ✅ verde; es el control real de toda la feature                                       |
| 5. las réplicas siguen al contrato   | ✅ `ANCHORS`, `EVENT_TYPES` y `BLOCKS` verdes                                         |
| 6. el corpus sirve versiones nuevas  | ✅ cinco versiones nuevas; ninguna vieja editada; un solo estilo en el archivo        |
| 7. el tope desapareció               | ✅ sin `maxItems`; `minItems` y `uniqueItems` siguen rechazando lo que rechazaban     |
| 8. contrato y cadena completa        | ✅ verde; `contract:diff` reportó lo incompatible y lo aceptó por `building` (1.8.0)  |
| 9. lo que ningún comando decide      | ✅ leído; ver abajo                                                                   |

**El paso 9, que es el que no tiene comando.** Leí los dos enums como si vendiera heladeras y las dos
descripciones aguantan: el anclaje dice «el control que elige variante» y aclara entre guiones que en
indumentaria son el de talle y el de color; el bloque dice «donde la página declara si el producto le
va a servir al comprador — la tabla de talles de una prenda, las medidas de un electrodoméstico». Un
integrador de otro rubro no tiene que traducir desde la ropa para entenderlos.

Lo que **no** se puede afirmar, y conviene no confundir: que `specifications` sea el mejor nombre en un
rubro que nadie observó todavía. `03 §9` dice que el piloto no va a contestar eso. Lo que sí se puede
afirmar es que el nombre viejo era de indumentaria y éste no.

## Dónde se toca qué, después de esto

| Si querés…                               | Se toca                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| agregar un punto de anclaje              | el enum del contrato y su réplica en el kernel; la prueba de réplica avisa |
| agregar un bloque de la ficha            | ídem, y la regla de la política que lo lea                                 |
| cambiar qué barreras atiende un merchant | su configuración; el esquema ya no pone un número                          |
| que OPE hable de otro rubro              | nada de esto: lo que falta es la variante genérica (D-16) y sus barreras   |
| renombrar algo del vocabulario otra vez  | el contrato primero, los tipos generados después, y el canario del paso 1  |
