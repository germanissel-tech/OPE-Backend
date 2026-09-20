# Enmienda de la constitución — v1.3.0 (F-062)

Sección VII, tercer punto, pasa de:

> El contrato del conector de órdenes MUST acotarse a: identificador de orden, monto, moneda,
> ítems con SKU y cantidad, fecha y el identificador de OPE. Campos adicionales se rechazan.

a:

> El contrato del conector de órdenes MUST acotarse a: identificador de orden, monto, moneda,
> ítems con SKU y cantidad, fecha, el identificador de OPE y el incentivo aplicado (clase y
> valor, que OPE mismo concedió y no es un dato del comprador). Campos adicionales se rechazan.

Historial de versiones (al pie de la constitución): `v1.3.0 — 2026-09-19 — VII: el conector de
órdenes admite el incentivo aplicado (ADR-028 §5–6; hallazgo F-062 de la auditoría 014). 01
§10.3 (documento del MVP) lista seis campos y no se enmienda desde el repo: la diferencia queda
anotada en ADR-028.`

Sin cambio en X (decisión del dueño 2026-09-19: se planifica la feature del puerto). Todo
Constitution Check posterior evalúa los diez principios y cita la versión.
