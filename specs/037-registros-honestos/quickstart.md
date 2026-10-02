# Quickstart — verificar que lo leído es lo que el tipo dice (037)

Seis pasos. Los comandos apuntan a rutas de archivo y no a filtros por nombre, por lo que la 031
encontró: `vitest run -t "<algo que no coincide>"` sale con 0 corriendo cero pruebas.

El paso que más importa es el 3: es el único que con el código **anterior** a la feature no se podía
escribir, porque el tipo del catálogo prometía una clase que el almacén no devolvía.

## 1. El compilador protege, y se ve en un archivo que nadie ejecuta

```bash
npm run typecheck
```

`tests/types/records.test-d.ts` compila sólo si un registro plano **no** es asignable a su clase y si un
`OrderRecord` plano entra en `Order.rehydrate` tal cual. SC-003 y FR-003. Para verlo fallar, quitar una
conversión del constructor de `Order`: el typecheck señala la línea del constructor, no un gateway.

## 2. Las entidades vuelven solas de su registro

```bash
npx vitest run tests/unit/domain/outcomes/order.test.ts tests/unit/domain/merchant/merchant.test.ts tests/unit/domain/catalog/catalog-snapshot.test.ts
```

Cada entidad alcanzada construida desde un registro plano: sus partes responden a sus métodos, una parte
opcional ausente sigue ausente, y una construida desde una copia es igual por valor. FR-002, FR-005,
FR-006, FR-008.

## 3. Lo que se lee tras un reinicio se comporta como lo que se escribió

```bash
npx vitest run --project durability tests/durability/catalog.test.ts tests/durability/outcomes.test.ts tests/durability/merchant-store.test.ts
```

SC-002 y FR-007. El caso nuevo del catálogo lee un precio tras el reinicio y le pide a `Money` que lo
compare con el original. Los de pedidos y merchants ya llamaban un método de cada parte (repetir una
devolución, admitir un origen) y siguen pasando con las rehidrataciones manuales borradas del gateway.

## 4. Ningún gateway rehidrata partes a mano

```bash
grep -rn "\.rehydrate(" src/interface-adapters --include=*.ts
```

SC-001. Lo que tiene que quedar: una llamada por gateway durable, sobre el documento entero, y ninguna
sobre una parte. Ningún tipo auxiliar de «lo que el documento realmente trae». Y `Money.rehydrate` no
aparece en ningún controller.

## 5. Nada del comportamiento existente cambió, y el camino de decisión no pagó

```bash
npm run format:check && npm run quality && npm run typecheck && npm test
npm run contract:check
npx vitest run --project durability
npx vitest run --project durability tests/durability/ingest-latency.test.ts
npm run test:mutation
```

SC-004 y SC-005. El contrato no tiene diferencias; ninguna expectativa de `fast` cambia, sólo se agregan
casos; la suite de durabilidad entera pasa sobre almacenes que se escriben igual que antes. La latencia de
ingesta se compara con la corrida previa en la misma máquina y lo esperable es que no haya diferencia
alguna: R-05 no agregó ninguna instrucción al camino. Y el gate de mutación sobre el diff: cada conversión
nueva del dominio tiene la prueba que la mata.

## 6. El lineamiento está donde se lee a tiempo

```bash
npm run check:adrs && npm run check:instructions && npm run check:markers
npm run test:tools
```

SC-006 y SC-007. El ADR nuevo tiene frontmatter válido y cita sólo ADR que existen; cada ruta, comando e
identificador citado en las dos reglas existe; la sección nueva de la regla de gateways tiene su clase
declarada; los inventarios de README cierran.

Y lo que ningún gate verifica: que alguien que no participó de la evaluación responda, leyendo sólo las
dos reglas, «¿dónde pongo la conversión de una parte anidada?» y «¿por qué `SqlStore` no se abstrae?».
Se hace en la revisión, y queda anotado en «Cambios respecto del plan» si la respuesta no salió de ahí.

## Cambios respecto del plan

_Se completa al cerrar la feature, fechado._
