---
es: testigo
en: witness
contexto: plataforma
uso: disponible
estado: aprobado
fuente: docs/adr/046-el-testigo-de-concurrencia.md
---

# testigo -> `witness`

> Toda escritura que reemplaza lo que leyó exige el testigo de lo que leyó. — **DECIDIDO** (2026-10-10, feature 043; ADR-046)

El identificador de la versión actual de un recurso, opaco para quien lo recibe: la lectura lo entrega en
`ETag` y la escritura lo devuelve en `If-Match`. Si alguien escribió el recurso en el medio, el testigo ya no
coincide y la escritura se rechaza (`412 stale-version`) sin escribir nada, en vez de reemplazar lo que el otro
dejó con valores viejos.

Lo exigen las tres publicaciones de configuración (merchant, plataforma, defaults de tratamiento) y la edición
de la identidad del merchant; sin él, `428 witness-required`. Cambia en **toda** escritura del recurso, también
en las que no lo exigen. Se calcula del estado actual y nombra el recurso: el nombre de la versión que rige en
un nivel global, el merchant y su número de versión en su configuración, el merchant y su revisión en el
merchant. Un cuerpo idéntico a lo que rige se acepta con cualquier testigo, porque no hay nada que pisar.
