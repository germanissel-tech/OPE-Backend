# Modelo de datos — Registros honestos

Fase 1 del plan. Lo único que cambia son **formas de tipos del dominio**: ninguna tabla, ninguna
columna, ningún documento.

## Lo primero: no hay migración, y no es un olvido

Lo que un almacén guarda es `toDocument(entidad.record())`. `record()` sigue devolviendo las mismas
instancias que hoy, y `toDocument` serializa por campos, así que **el texto escrito es idéntico** antes y
después de la feature. Un documento guardado antes se lee después sin ninguna diferencia, salvo la que
la feature existe para producir: lo leído es lo que el tipo dice.

## El principio, en una regla

Un registro declara la **forma de los datos** de la entidad. Donde una parte es una clase, el registro
declara el registro de esa parte, y el constructor de la entidad la convierte. Una instancia cumple con
la forma de su registro, así que quien construye pasando clases sigue compilando; y un dato plano
asignado a un campo de clase no compila, porque le faltan los métodos.

## Las formas que cambian

### `Origin` gana su registro (`domain/merchant/origin.ts`)

```text
OriginRecord { value: string }          // NUEVO: la forma canónica, tal como se escribió
Origin.rehydrate(record: OriginRecord)  // acepta el registro; hoy acepta el string
```

`Origin` cumple con `OriginRecord`. El cambio de firma de `rehydrate` es para que el constructor del
merchant pase la parte tal como la lee; quien hoy llama con un string se ajusta (es un sitio: el
gateway que desaparece).

### `MerchantRecord` (`domain/merchant/merchant.ts`)

```text
hoy:      origins: readonly Origin[]
después:  origins: readonly OriginRecord[]

constructor: this.origins = record.origins.map((o) => Origin.rehydrate(o))
```

`Merchant.of` sigue construyendo sus orígenes con `Origin.parse` y pasándolos como instancias: cumplen
con el registro. `record()` no cambia.

### `OrderFacts` y `OrderRecord` (`domain/outcomes/order.ts`)

```text
hoy:      total: Money
          correlation?: Correlation | undefined
          redemption?: IncentiveRedemption | undefined
          returned?: Return | undefined
después:  total: MoneyRecord
          correlation?: CorrelationRecord | undefined
          redemption?: IncentiveRedemptionRecord | undefined
          returned?: ReturnRecord | undefined

constructor: this.total = Money.rehydrate(record.total)
             if (record.correlation !== undefined) this.correlation = Correlation.rehydrate(record.correlation)
             if (record.redemption !== undefined)  this.redemption  = IncentiveRedemption.rehydrate(record.redemption)
             if (record.returned !== undefined)    this.returned    = Return.rehydrate(record.returned)
```

Las cuatro partes ya tienen su registro y su `rehydrate`; lo que cambia es quién los llama. `Order.of`
sigue juzgando lo mismo (SKU duplicado, instante en el futuro) sobre el registro plano. `withCorrelation`
y `withReturn` siguen pasando por `record()` y el constructor; las partes se convierten de nuevo y el
resultado es igual por valor (R-03). `Order implements OrderRecord` sigue valiendo: `Money` cumple con
`MoneyRecord`.

### `Variant` (`domain/catalog/catalog-snapshot.ts`)

```text
hoy:      price: Money
después:  price: MoneyRecord
```

Sin conversión (R-02, R-05): el catálogo no aplica ninguna regla de `Money`. Quien la necesite la pide
en el sitio: `Money.rehydrate(variant.price)`.

### `Event` (`domain/ingestion/event.ts`)

```text
hoy:      price?: Money
después:  price?: MoneyRecord
```

Sin conversión, por la misma razón. La lista blanca de campos del evento no cambia.

## Lo que desaparece

| Dónde                        | Qué                                                                                  | Por qué                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `sqlite-order-ledger.ts`     | Las cuatro rehidrataciones manuales de `orderOf`, y el comentario sobre «una quinta» | La entidad vuelve sola; la promesa del comentario era falsa     |
| `sqlite-merchant-store.ts`   | `StoredMerchant` y el `map` sobre los orígenes                                       | `MerchantRecord` ya describe lo que el documento trae           |
| `upsert-catalog-snapshot.ts` | `Money.rehydrate(v.price)`                                                           | El tipo pide el dato plano, que es lo que el contrato ya validó |
| `ingest-events.ts`           | `Money.rehydrate(price)`                                                             | Ídem                                                            |
| `notify-order.ts`            | `Money.rehydrate(body.total)`                                                        | Ídem; el constructor del pedido convierte                       |

## Lo que se agrega

| Dónde                                                | Qué                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tests/types/records.test-d.ts`                      | `MoneyRecord` no es `Money`; `OriginRecord` no es `Origin`; un `OrderRecord` plano entra en `Order.rehydrate` sin cast |
| `tests/unit/domain/outcomes/order.test.ts`           | Construido desde un registro plano, `returned.sameContentAs` responde; construido desde una copia, es igual por valor  |
| `tests/unit/domain/merchant/merchant.test.ts`        | Construido desde un registro plano, `allowsOrigin` responde                                                            |
| `tests/unit/domain/catalog/catalog-snapshot.test.ts` | Rehidratado desde un registro plano, el precio conserva sus dos campos                                                 |
| `tests/durability/catalog.test.ts`                   | Tras un reinicio, el precio de una variante vuelve y `Money.rehydrate(precio).equals(original)` es verdadero           |

## Invariantes que la feature fija

- Una entidad construida desde un registro plano y la misma construida desde instancias son iguales por
  valor, y sus partes responden a sus métodos (FR-002, FR-005).
- Una parte opcional ausente en el registro sigue ausente (FR-006).
- `record()` de cada entidad alcanzada produce el mismo documento que hoy (FR-013).
- Un campo de clase nuevo sin conversión no compila (FR-003, R-04).
