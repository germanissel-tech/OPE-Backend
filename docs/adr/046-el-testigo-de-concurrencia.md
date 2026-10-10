---
numero: 046
titulo: El testigo de concurrencia — toda escritura que reemplaza lo que leyó exige el testigo de lo que leyó
estado: aceptada
fecha: 2026-10-10
fuente: specs/043-el-testigo-de-concurrencia/research.md; decisión del dueño del 2026-10-10; TAN-10 de Tandilia
---

# ADR-046 — El testigo de concurrencia

## Contexto

Las pantallas de la consola que escriben la configuración y la identidad del merchant trabajan igual: leen
lo que rige, lo precargan, el operador cambia algunos valores y la pantalla **manda el registro entero**. La
configuración de un merchant lleva, además, lo que la pantalla no edita —la política de decisión, los
anclajes, las etiquetas—, copiado de lo que rigió al abrir.

Hasta la feature 043 la regla era «gana el último»: si otro operador escribía en el medio, la segunda
escritura reemplazaba la primera con valores viejos y nada fallaba. La 040 y la 041 lo dejaron así a
propósito, como feature posterior, con TAN-10 de Tandilia como referencia. OPE-Web lo pidió con la
evidencia de su feature 008.

## Decisión

1. **Una escritura que reemplaza lo que leyó exige el testigo de lo que leyó.** Hoy son cuatro: las tres
   publicaciones de configuración (merchant, plataforma, defaults de tratamiento) y la edición de la
   identidad del merchant. La lectura del recurso devuelve el testigo en `ETag`, y la escritura lo devuelve en
   `If-Match`. Una escritura nueva del mismo tipo se suma declarando el parámetro; el código no cambia.
2. **Es obligatorio.** Sin `If-Match`, `428 witness-required`. Un testigo opcional protege sólo a quien se
   acuerda de mandarlo, y el olvido no falla: es la forma en que, según TAN-10, la protección se vuelve
   inútil en silencio. Decidido con el dueño el 2026-10-10; el cambio de contrato es incompatible y entró por
   la marca `building` (ADR-003) en la versión `1.15.0`.
3. **Las cuatro exigencias de TAN-10, tal cual:**
   - el testigo cambia en **toda** escritura del recurso, también las que no lo exigen (el interruptor, las
     rotaciones y la desactivación del merchant), y sus respuestas lo declaran;
   - el contrato dice de cada escritura protegida que **reemplaza** el recurso entero, y qué significa lo
     ausente;
   - el día que el consumidor `admin` tenga CORS, `ETag` va en Access-Control-Expose-Headers (hoy no lo
     tiene: la consola entra por el mismo origen);
   - los rechazos (`412` y `428`) **no devuelven** el testigo actual: darlo invita a reenviarlo sin mirar.
4. **El testigo se calcula, no se guarda**, y nombra el recurso para que el de uno nunca coincida en otro:

   | recurso                           | testigo                                                                       |
   | --------------------------------- | ----------------------------------------------------------------------------- |
   | nivel de plataforma o de defaults | el nombre de la versión que rige (platform-12, defaults-3)                    |
   | configuración de un merchant      | el merchant y el número de la versión que rige, o `0` (mrc_x:configuration:5) |
   | merchant                          | el merchant y su revisión (mrc_x:7)                                           |

   La revisión del merchant la sube la entidad, por un único método que arman sus cuatro mutaciones. Un
   cambio que no cambia nada (desactivar uno desactivado, el interruptor donde ya está) no la sube: el testigo
   describe el recurso, no el pedido.

5. **El orden dentro de la escritura:** alcance del operador → cuerpo bien formado → **¿idéntico a lo que
   rige?** → testigo → todo lo demás (juicio, congelamiento, escritura).
   - Un cuerpo idéntico a lo que rige responde como antes, **con cualquier testigo**: no hay nada que pisar, y
     así el reintento de una escritura cuya respuesta se perdió no falla (la idempotencia por contenido sigue
     intacta).
   - El testigo va antes del congelamiento: explicar el `409` de algo que ya cambió no sirve.
   - Un testigo que no es exactamente el actual —viejo, de otro recurso, `*`, varios, débil, sin comillas— es
     `412 stale-version`, sin distinguir uno de otro.
   - **La ausencia de `If-Match` es forma del pedido**, como un cuerpo mal formado: la responde el validador,
     antes del alcance. `428` no dice nada del recurso, así que tampoco revela si existe; el **valor** del
     testigo se juzga después del alcance.
6. **El `428` lo declara el contrato.** El parámetro `If-Match` es requerido y lleva `x-when-missing:
witness-required`. Cuando la única falla de un pedido es la ausencia de un parámetro con esa extensión,
   `validationFail` responde ese problema en vez de `400 validation-failed`. La regla `ope-when-missing` exige
   que la extensión vaya en un parámetro requerido y nombre un tipo del catálogo.
7. **Comparar y escribir es atómico porque la unidad de trabajo ya serializa.** Las cuatro escrituras son
   auditadas y corren dentro de su unidad de trabajo, que espera su turno (feature 034): nada se escribe entre
   la comparación y la escritura. No hay escritura condicional en los almacenes. **El despliegue en memoria no
   serializa** —es el de las pruebas, donde nadie escribe en paralelo—, y eso queda dicho acá para que nadie lo
   descubra después.

## Consecuencias

- La consola de OPE-Web no puede publicar ni editar la identidad hasta su feature siguiente, que manda el
  testigo y despierta su recuperación dormida (CU-29): relee, compara campo por campo y reintenta sola si
  nadie tocó lo mismo. El tipo `stale-version` y el encabezado son los que su núcleo ya espera.
- El reporte de `contract:diff` de la `1.15.0` nombra ocho respuestas nuevas (`412` y `428` en las cuatro
  operaciones) y el parámetro requerido; está citado en el quickstart de la feature 043.
- «Testigo» entra al glosario (`docs/dominio/testigo.md`).

## Alternativas descartadas

- **Un testigo opcional**, como la firma de plataforma (`X-OPE-Signature`, ADR-029): la firma es opcional de
  verdad, porque un merchant sin secreto no la manda; el testigo no lo es para nadie. Declararlo opcional
  habría hecho que `contract:diff` llamara compatible a un cambio que rechaza lo que antes aceptaba, y que los
  tipos generados no obligaran a nadie a mandarlo.
- **Una escritura condicional en cada almacén** (`UPDATE … WHERE version = :esperada`): repite, en dos gateways
  por recurso, una garantía que la unidad de trabajo ya da a todas.
- **Un hash del contenido como testigo**: cambiaría por cambios que no son escrituras (un campo nuevo en la
  forma de la respuesta), y no dice nada que la versión no diga.
- **`updatedAt` como revisión del merchant**: dos escrituras en el mismo milisegundo darían el mismo testigo.
