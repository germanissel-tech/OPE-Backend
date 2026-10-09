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

Desde la feature 041 (ADR-045) tiene además una **identidad para personas**: un nombre para mostrar
(`displayName`, el de la tienda o su razón social; obligatorio al crear, no al leer), la URL de la
tienda para una persona (`storeUrl`, distinta de los orígenes, que son técnicos), una persona de
contacto (`contact`: nombre, email, teléfono y rol; una persona identificada de la relación comercial,
no una observada, constitución VII 1.5.1) y notas del operador (`notes`). Es un valor del agregado,
no otro agregado: se lee con el merchant y se reemplaza entero con `updateMerchantProfile`. Nada de
eso entra en una decisión, en lo que ve el SDK o la plataforma, en el registro de administración ni
en los registros del servidor; sólo el consumidor `admin` lo ve. El nombre es para reconocer, no para
identificar: dos merchants pueden llamarse igual.
