---
es: cadencia
en: cadence
contexto: plataforma
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#6
---

# cadencia -> `cadence`

> `pull`: OPE consulta la API de la plataforma con credenciales del merchant, a la cadencia que aguante. — **DECIDIDO** (`02 §6`)

Cada cuánto el planificador consulta un flujo de un merchant en `pull`, y cuántas variantes trae cada lote de stock
y precio. Es configuración del merchant sobre los defaults de tratamiento (constitución XI): la plataforma de cada
merchant aguanta lo que aguanta.

No es la frescura: la frescura dice cuándo un dato deja de valer; la cadencia, cada cuánto se va a buscar.
