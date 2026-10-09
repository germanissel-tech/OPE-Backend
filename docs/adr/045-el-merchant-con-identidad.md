---
numero: 045
titulo: El merchant con identidad — nombre, URL, contacto y notas como valor del agregado, y la persona de contacto como persona identificada
estado: aceptada
fecha: 2026-10-09
fuente: specs/041-el-merchant-con-identidad/research.md; decisión del dueño del 2026-10-09
---

# ADR-045 — El merchant con identidad

## Contexto

Desde la feature 017 el merchant es un registro operado (ADR-031): identificador acuñado, estado,
orígenes y credenciales. Es lo que hace falta para dar de alta, rotar y apagar, y nada más. Cuando la
consola (OPE-Web 005 y 006) lo mostró, el hueco se vio: no hay forma de reconocer un merchant sin leer
su primer origen, que es técnico, puede ser uno de veinte y puede ser `localhost`; y no hay dónde dejar
nada de la relación comercial —con quién se habla, en qué etapa está—, que vive en la cabeza del
operador.

La constitución VII (1.5.0, ADR-044) acaba de acotar a quién protege: las personas **observadas**, el
visitante y el comprador, y nombró al operador como la persona identificada con nombre para mostrar.
La persona de contacto del merchant es la segunda de esa categoría, y la primera cuyo email y
teléfono el contrato lleva.

## Decisión

1. **La identidad es un valor del agregado, no otro agregado.** `MerchantProfile` —nombre para
   mostrar, URL de la tienda, persona de contacto, notas— vive dentro de `Merchant`, en su documento
   y en su transacción, y se lee con él (lista y ficha). No tiene otra vida que la del merchant: no se
   versiona ni se consulta por separado. Un merchant creado antes de esta decisión no tiene identidad
   hasta que un operador la escriba; nadie inventa un nombre. Un merchant desactivado la admite: la
   relación comercial no depende del estado operativo.
2. **Editar la identidad es reemplazarla.** `updateMerchantProfile` (`PUT`) toma los cuatro campos
   enteros —`displayName` obligatorio; ausente es vacío para los otros tres— y no toca orígenes,
   estado ni credenciales, que tienen sus operaciones y sus reglas. Exige `merchants:write`, respeta
   el alcance sin revelar existencia (`403 merchant-out-of-scope`), y se audita como toda escritura de
   un operador: quién, qué operación, sobre qué merchant; **nunca los valores**.
3. **El esquema juzga tamaño y formato; el dominio juzga lo que el esquema no dice.** Largos,
   `required`, `format: email` y el prefijo de la URL son del contrato y los rechaza el validador
   (`400` con puntero). El dominio rechaza lo que un esquema no expresa legible —espacios en los
   bordes, una URL que sólo parece una— con un invariante propio, `invalid-merchant-profile` (`422`),
   que señala el campo bajo `/body`. Un valor que entra, entra como se escribió: ni recortes ni
   normalización.
4. **El nombre es para reconocer, no para identificar.** Dos merchants pueden llamarse igual; el
   identificador sigue siendo `merchantId`, y la unicidad sigue siendo la de los orígenes. `storeUrl`
   es para que una persona la abra y no tiene relación con los orígenes registrados.
5. **La persona de contacto es una persona identificada de la relación comercial.** No es observada:
   sabe que OPE la tiene registrada y para qué. La constitución VII (1.5.1) nombra «las personas
   identificadas de la relación comercial: el operador y el contacto del merchant». Sus datos se
   sirven **sólo** al consumidor `admin` y no entran en una decisión, en lo que ve el SDK o la
   plataforma, en el registro de administración ni en los registros del servidor. La herramienta lo
   acompaña: `name`, `email` y `phone` siguen prohibidos en todo esquema, y la excepción
   `x-personal-datum` pasa a admitir una lista —cada propiedad con su razón— declarada en el esquema
   del contacto. `displayName`, que está en la lista desde la 040, se excusa en los esquemas del
   merchant con la razón de que es el nombre de una tienda.
6. **`displayName` es obligatorio en el alta, y eso es un cambio que `contract:diff` marca.** Entra
   por la marca `building` del contrato (ADR-003) con bump MINOR a `1.13.0`, reportado. Es la primera
   vez que la marca se usa para un `required` nuevo y no para un rename; la alternativa —un campo
   opcional que nadie completa— dejaría abierto el problema que la feature viene a cerrar.

## Consecuencias

- La ficha y la lista de merchants pueden mostrar nombre, URL, contacto y notas; listar por nombre y
  mostrar la ficha completa es un cambio de pantallas de OPE-Web, que toma `generated/contract/` con
  `contract:sync` y cuya conformidad pasa sin cambio (`MerchantContact` y `MerchantProfileInput` son
  esquemas objeto de cuerpos `admin`).
- Sin migración: el merchant es un documento (ADR-041) y la identidad viaja adentro; un documento
  viejo rehidrata un merchant sin identidad.
- Lo que `contract:diff` dijo al construirla, para que quede: `error [new-required-request-property]
… in API POST /v1/admin/merchants: added the new required request property displayName`, y a
  continuación `Incompatible change accepted: the contract is building (info.x-stability: building,
1.13.0); remove the mark before the first pilot`. Es la primera vez que la marca admite un
  `required` nuevo.
- Las dos operaciones que responden con el merchant entero (desactivación y reemplazo de la
  identidad) comparten la respuesta en el presentador: `check:duplication` no admite dos
  controllers con las mismas seis líneas.
- El régimen de retención y borrado de los datos del contacto sigue siendo D5 (ADR-010): desactivar
  un merchant no borra su identidad, porque no existe borrado.
- Un segundo contacto, o un contacto como cuenta que entra a algún lado, es otra decisión; el portal
  tiene su propio principal (ADR-020).
