---
es: merchant
en: merchant
contexto: identidad
estado: aprobado
fuente: constitucion#V
uso: pendiente
---

# merchant -> `merchant`

> `merchantId` MUST derivarse siempre de la credencial autenticada. MUST NOT tomarse del body, la query ni el path.

Se mantiene en inglés también en castellano ("merchant", no "comerciante"): así lo usan los documentos del MVP. Es la frontera de aislamiento de todo dato (constitución V).

Desde la feature 017 el merchant es un **registro operado**: lo crea un operador por la API de
administración (OPE acuña el `merchantId`, inmutable, que sólo aparece en las rutas del
consumidor `admin`), tiene un estado —`active`, `off` (interruptor) o `deactivated`
(terminal: sus credenciales dejan de valer y sus registros se conservan; no existe borrado)—,
sus orígenes y sus credenciales. Su configuración y sus experimentos son agregados aparte con
vidas distintas (ADR-031). **Ninguna operación sobre un merchant requiere reinicio**; el
servidor se reinicia sólo con un deploy. La variable `OPE_MERCHANTS` es una semilla que se
importa por el mismo camino sólo en un entorno vacío.
