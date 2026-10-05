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

## La corrida del 2026-10-02 (histórica y fechada)

Los seis pasos, en esta máquina, con el gate de mutación **terminado antes** de medir: la primera
medición de latencia se hizo mientras Stryker corría diez procesos y dio un p95 de cientos de
milisegundos en dos corridas de tres. No era la feature, era la carga, y es la clase de cifra que no se
anota sin decir bajo qué condiciones salió.

| Paso | Resultado                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `typecheck` verde con `tests/types/records.test-d.ts`; al cambiar el dominio, el único error de todo el repo fue el gateway que T009 borra |
| 2    | Las tres unitarias del dominio, 125 casos, verdes                                                                                          |
| 3    | Catálogo, pedidos y merchants en durabilidad, 29 casos, verdes; el del catálogo es nuevo                                                   |
| 4    | Una llamada a `rehydrate` por gateway durable, sobre el documento; cero `Money.rehydrate` en controllers                                   |
| 5    | `fast` 1618 casos verdes; `quality` 7 gates verdes; mutación sobre el diff: puntuación 100, cero supervivientes                            |
| 6    | `check:adrs`, `check:instructions`, `check:markers` y el proyecto `tools` verdes                                                           |

**SC-005, medido contra la misma máquina y la misma hora, con y sin los cambios** (tres corridas de cada
una, veinte merchants resolviendo el último, que es el caso de ADR-041):

| Código         | p95 SQLite (ms)    | p95 memoria (ms)   |
| -------------- | ------------------ | ------------------ |
| sin la feature | 9.02 / 9.30 / 9.09 | 2.18 / 1.40 / 1.38 |
| con la feature | 8.94 / 8.82 / 8.76 | 1.41 / 1.61 / 1.52 |

Dentro de la dispersión: la feature no agregó nada al camino, que es lo que R-05 decía. La línea base de
ADR-041 (6.78 / 6.78 / 7.25 ms, 2026-09-29) es más baja que las dos columnas, y la diferencia es de las
dos features que entraron desde entonces, no de ésta: por eso se mide contra el código de hoy sin los
cambios y no contra una cifra de otro día.

## Cambios respecto del plan (2026-10-02)

- **Tres afirmaciones de la unitaria del pedido cambiaron de identidad a igualdad por valor.** Afirmaban
  que una parte de una copia (`correlated`, `withReturn`) era **el mismo objeto** que se le pasó; con el
  constructor construyendo cada parte desde su registro, es un objeto igual por valor. FR-012 decía que
  ninguna expectativa de `fast` cambia; éstas cambian y son de un detalle de implementación, no de un
  comportamiento. Se descartó conservar la identidad con un `instanceof` en el constructor, porque sería
  una rama que ninguna prueba distingue y el gate de mutación la señalaría.
- **El pedido del caso de uso `notifyOrder` declara `MoneyRecord`.** El plan decía que `application/` no
  cambia; lo que cambió es el tipo de un campo del request de un caso de uso, no un puerto. El caso de
  uso sólo reenvía el total a `Order.of`, así que declarar la clase ahí era la misma mentira un anillo más
  arriba.
- **La conversión del contexto de página en la ingesta desapareció entera**, no sólo su envoltura: con el
  precio declarado como dato plano, el DTO del contrato ya tiene la forma del dominio y la función que lo
  traducía no traducía nada.
- **El paso 6 de lectura por alguien ajeno** queda para la revisión de la PR: no se puede hacer desde
  adentro de la sesión que escribió las reglas.
