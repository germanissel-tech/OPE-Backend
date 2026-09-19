# Plantilla de `docs/auditoria/trabajo/afirmaciones.md`

Una fila por afirmación DECIDIDA (o principio MUST). Se llena en la fase 0 (columnas id,
origen, estado, texto) y se resuelve en la fase 4 (evidencia). Los enunciados `PROPUESTO` o
`ABIERTO` del documento fuente van en la tabla final, aparte: no generan `high`.

```markdown
# Afirmaciones DECIDIDAS y su evidencia

## Constitución (principios I–X y Flujo de desarrollo)

| id    | origen         | estado | afirmación                                                              | evidencia (prueba/gate con ruta) · hueco · F-NNN |
| ----- | -------------- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------ |
| A-001 | constitution#I | MUST   | Cada módulo decide una sola cosa; el orquestador arma contexto e invoca |                                                  |
| …     |                |        |                                                                         |                                                  |

## 01-arquitectura-mvp.md (§4, §5, §6, §9, §10)

| id  | origen | estado | afirmación | evidencia |
| --- | ------ | ------ | ---------- | --------- |

## 02-integracion-ecommerce.md (§4, §5)

…

## 03-alcance-mvp.md (§4.5, §4.7, §4.8, §4.11, §6, §10)

…

## Specs 001–013 (FR y SC)

### 001 …

| id | origen | estado | afirmación | evidencia |
| A-1xx | spec:001 FR-001 | DECIDIDO | … | tests/…: "…" |

## Enunciados PROPUESTO / ABIERTO (no generan high)

| origen | estado | enunciado | dónde se trata |
```

Convenciones: `evidencia` cita la prueba por ruta y nombre (`tests/unit/domain/x.test.ts:
"la regla …"`) o el gate (`arch: context-map:ledger`); "hueco: <qué faltaría probar>" cuando
no hay; `F-NNN` cuando el código contradice la afirmación.
