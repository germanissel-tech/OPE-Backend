---
numero: 041
titulo: La memoria responde por el almacén en el borde de autenticación, y hasta cuándo
estado: aceptada
fecha: 2026-09-29
fuente: feature 033 (research R-02 y su enmienda), medición del 2026-09-29
---

# ADR-041 — La memoria responde por el almacén en el borde de autenticación, y hasta cuándo

La feature 033 hace durable lo que un operador configura. Eso pone al **borde de autenticación de toda
petición** a depender de un almacén: antes de validar el cuerpo, cada request del SDK y de la plataforma
resuelve su merchant por la huella de su credencial. Es la tercera vez que el camino de decisión queda
atado a algo durable, y —como las dos anteriores— se declara en vez de disimularse.

## Contexto

`01 §P9`: «Decisión: **síncrono, acotado, sin I/O de red**. Medición: **asíncrono, durable**, auditable.»
El principio **IV** de la constitución dice además que el estado caliente **no es fuente de verdad**.

Las dos excepciones anteriores están registradas: ADR-038 dejó la **escritura** del ledger en el camino
crítico porque el principio IX no admite intervenir sin haber registrado, y ADR-040 dejó ahí una
**lectura** porque olvidar un tope es peor que esperarla. Ésta es distinta de las dos: no es el plano de
decisión, es el **borde de autenticación**, que corre antes —en toda petición, incluidas las que el
cuerpo va a rechazar— y no tiene nada que degradar. Un merchant que no se resuelve es un `401`.

Y el alcance es mayor de lo que parecía. `MerchantStore` es el caso obvio; `ExperimentStore` también
implementa `ExperimentDirectory`, cuyo `activeFor` lo llama `Assignments.assign` en **toda decisión**, y
no por clave: lee todas las filas de experimentos del merchant, las rehidrata y las juzga para encontrar
la abierta. El research de la feature había clasificado ese puerto como frío y estaba mal; la enmienda
de R-02 lo corrige y dice cómo se detectó — buscando los llamadores de cada puerto antes de escribir su
gateway, no midiendo, porque la medición de la ingesta no pasa por ahí.

## Decisión 1 — La memoria es el índice de un almacén que es la fuente, en esos dos puertos

El gateway durable de merchants y el de experimentos **no leen su propia tabla**: llenan un índice en
memoria al construirse y lo mantiene la misma operación que escribe, después de que el almacén aceptó.

Las dos alternativas, con lo que cuesta cada una:

|                                     | Consultar el almacén en cada petición                        | La memoria como índice                                  |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Contra SQLite local                 | un `SELECT` indexado por petición                            | un `Map.get`                                            |
| **Contra PostgreSQL remoto (D-21)** | **un viaje de red por petición, antes de validar el cuerpo** | un `Map.get`                                            |
| Al arrancar                         | nada                                                         | leer todos los merchants una vez                        |
| Coherencia con dos procesos         | correcta                                                     | **el índice de un proceso no ve la escritura del otro** |
| Memoria                             | nada                                                         | proporcional a la cantidad de merchants, no al tráfico  |

**Lo que decide no es el costo de hoy sino el de mañana.** Contra SQLite local las dos son baratas —un
`SELECT` por huella cuesta lo que cuesta un índice— y por eso la medición de abajo no distingue entre
ellas. La diferencia aparece el día que el almacén sea remoto, que es el día de **D-21**: ahí la primera
pone un viaje de red por petición antes de validar el cuerpo, y elegirla hoy sería elegir rehacerla.

### No es «escribir dos veces», y la diferencia es verificable

La feature 032 rechazó exactamente eso para el estado caliente: el ledger y el estado serían **dos
verdades** capaces de discrepar sobre el mismo hecho. Acá hay **una** verdad —la tabla— y el índice es
una vista de ella que mantiene la misma operación que la cambia. La diferencia se prueba: si pudieran
discrepar habría dos caminos de escritura, y no los hay. Lo que lo sostiene es una regla de orden que
tiene su prueba unitaria en los dos gateways: **el índice se toca después de que el almacén aceptó y
nunca antes**, así que una escritura rechazada no puede dejarlo respondiendo algo que la tabla no tiene.

### Hasta cuándo vale

**Vale mientras haya un proceso**, que es el alcance declarado desde la feature 030 (**D-21**). Deja de
valer exactamente cuando hay dos: el índice de A no ve el alta que hizo B, y un merchant recién creado
autenticaría en un nodo y no en el otro. No es una sorpresa a descubrir después — es lo mismo que D-21
ya dice de las demás garantías — y la feature de PostgreSQL tiene que resolverlo con invalidación o
consultando. Queda escrito en los dos gateways, no sólo acá, porque es ahí donde alguien lo va a leer.

## Decisión 2 — Un servidor que no puede leer sus merchants no arranca

Llenar el índice es lo que el gateway hace al construirse, y **esa lectura lanza en vez de degradar**.
Es la única del repositorio que lo hace, y es correcta: pasa en el arranque, y un servidor que no puede
leer sus merchants autenticaría a nadie y asignaría como si no hubiera experimentos, en silencio. Es la
misma regla que el almacén aplica a un esquema que no reconoce (ADR-039). Una escritura que falla
después es otro hecho y degrada, como en todos los demás gateways (ADR-021).

## Lo medido (2026-09-29, tres corridas, una laptop)

El p95 de la ingesta con el almacén durable, con **veinte merchants en la tabla** y resolviendo el
último —el peor caso del recorrido por huella—, contra el mismo almacén con un solo merchant:

| Perfil                     | p95                    |
| -------------------------- | ---------------------- |
| SQLite, veinte merchants   | 6,78 / 6,78 / 7,25 ms  |
| SQLite, un merchant        | 7,85 / 11,15 / 8,25 ms |
| memoria (la misma corrida) | 1,12 – 2,09 ms         |

**Nunca peor, y dentro de la dispersión del caso que no guarda ningún merchant**: hacer durables los
merchants no costó nada medible en el camino. El delta contra memoria (5,4 – 6,2 ms) es la escritura de
los ledgers de las features 030 y 031, no esta resolución — lo que aísla el costo propio de este diseño
es la prueba unitaria que fija que el gateway lee su tabla una vez al arrancar y nunca más.

La reconstrucción de la ventana de deduplicación, que es la otra lectura que esta feature agrega al
camino, cuesta **~6 ms una vez por merchant y por arranque** (8,78 ms el primer lote contra 2,77 ms el
siguiente).

## Consecuencias

- **No sube de prioridad ninguna feature de desacople**, y el motivo es que en este diseño no hay nada
  que desacoplar: la lectura del camino es un `Map.get`. Lo que sube de prioridad es **D-21**, que ahora
  carga una garantía más: el segundo proceso no sólo divide ledgers, invalida este índice.
- **La clasificación «frío o caliente» de un puerto se verifica buscando sus llamadores**, no leyendo su
  nombre ni midiendo la ingesta. Cuatro de cinco eran ciertas en R-02 y la quinta cambió el diseño de un
  gateway.
- **Lo que esta decisión no cubre**: el resto de los almacenes de la feature —configuración, registro de
  administración, diagnósticos, valores sin mapear— se leen en operaciones de administración y van al
  almacén directo, sin índice. `ConfigurationStore` es el caso que conviene no confundir: parece
  caliente y no lo es, porque `Configurations` resuelve la configuración efectiva de un merchant una vez
  y la sirve de memoria.
