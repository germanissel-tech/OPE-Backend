# Quickstart — verificar que la variante no exige atributos de indumentaria (029)

Seis pasos. Cinco los decide un comando; el último lo decide leer.

## 1. El canario: la variante no tiene campos de indumentaria

```bash
grep -nE "^  (size|color):" contracts/components/schemas/CatalogVariant.yaml src/domain/catalog/catalog-snapshot.ts
```

**Nada.** Mientras quede una ocurrencia, la feature no está hecha.

**Pregunta por campos, no por palabras, y la primera versión preguntaba por palabras.** Daba dos
aciertos falsos: el `.size` de un `Map` en el dominio, y el ejemplo «in apparel, size and colour» de
la descripción del contrato — que es el mismo paréntesis que la fuente lleva desde la enmienda del
2026-09-25, así que borrarlo haría al contrato **menos** fiel. Un canario que uno aprende a ignorar
deja de ser un canario, que es lo que D-13 costó aprender.

## 2. El atributo está escrito una sola vez

```bash
grep -c "CatalogAttribute" contracts/components/schemas/CatalogProduct.yaml contracts/components/schemas/CatalogVariant.yaml
grep -c "maxLength: 512" contracts/components/schemas/CatalogAttribute.yaml
```

Producto y variante referencian el mismo componente, y el límite del valor está en un solo lugar. Si
alguno lo define en línea, el contrato volvió a tener dos maneras de decir lo mismo.

## 3. Una tienda que no vende ropa publica su catálogo

```bash
npx vitest run --project fast tests/integration/catalog.test.ts
```

Un catálogo cuyas variantes declaran capacidad y terminación se acepta, y la verdad de producto queda
legible. Uno con los campos viejos recibe `400` nombrando el campo.

## 4. La idempotencia distingue un atributo distinto

```bash
npx vitest run --project fast tests/unit/domain/catalog tests/unit/application/catalog
```

Es **lo único que cambia de comportamiento**: dos publicaciones del mismo instante cuyas variantes
difieren en un atributo son un conflicto, y dos idénticas siguen siendo una repetición.

## 5. La decisión no cambió

```bash
npx vitest run --project fast tests/integration/decision-plane.test.ts
npx vitest run --project fast tests/integration/catalog-size.test.ts
```

Misma barrera, misma confianza, mismo escalón, mismo anclaje y mismo texto. Y el catálogo del tamaño
del piloto sigue entrando en una operación dentro del mismo presupuesto.

## 6. Lo que ningún comando decide

Leer la definición de variante del contrato **como si uno vendiera heladeras**. Si la descripción
obliga a traducir desde la ropa, quedó vocabulario que el `grep` del paso 1 no atrapa porque no dice
«size».

Y leer la nota del glosario de `variante`: su cita tiene que ser la que la fuente dice **hoy**, no la
que decía antes de la enmienda del 2026-09-25.

## Estado, corrido el 2026-09-26

Histórico y fechado (ADR-032): lo de abajo es lo que dio ese día, no una promesa.

| Paso                                | Resultado                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| 1. la variante sin campos de prenda | ✅ cero, con el canario corregido (ver arriba)                                       |
| 2. el atributo escrito una sola vez | ✅ producto y variante referencian el mismo componente; el límite, en un solo lugar  |
| 3. una tienda que no vende ropa     | ✅ heladera aceptada, variante sin atributos aceptada, forma vieja `400` con puntero |
| 4. la idempotencia ve el atributo   | ✅ verde, incluido el caso reordenado                                                |
| 5. la decisión no cambió            | ✅ verde, y el catálogo del piloto sigue entrando en una operación                   |
| 6. lo que ningún comando decide     | ✅ leído; ver abajo                                                                  |

**El paso 6.** Leí la definición de variante como si vendiera heladeras y aguanta: dice «la
combinación exacta de atributos que define un artículo vendible», con la ropa entre guiones como
ejemplo y no como requisito, y agrega lo que un integrador necesita saber —que lo que la identifica es
su id y que los atributos dicen qué la distingue, así que una variante única puede no declarar
ninguno—. La nota del glosario cita ahora lo que la fuente dice, no lo que decía antes de la enmienda.

## Dónde se toca qué, después de esto

| Si querés…                                  | Se toca                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| cambiar el límite de un atributo            | el componente compartido, una vez, y vale para producto y variante    |
| que un claim lea un atributo de la variante | el vocabulario de claims (ADR-027): es una feature de producto        |
| agregar un eje a una variante               | **nada**: la plataforma lo manda y el contrato ya lo admite           |
| recomendar una variante                     | el puerto de plataforma y el nivel 2 de sincronización, en el roadmap |
