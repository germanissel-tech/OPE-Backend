# El cambio del contrato, campo por campo (023)

Nada se agrega, se quita ni se renombra. Lo que cambia es **qué se acepta** y **qué se dice**.

## 1. `contracts/components/schemas/ExperimentCreate.yaml`

### La descripción deja de prometer el ajuste

```diff
   treatmentShare:
     type: number
-    description: "… It cannot exceed what the holdout of the merchant leaves (`1 − holdoutShare`).
-      The assignment resolves to whole buckets of one hundredth, so a finer value takes the
-      nearest bucket."
+    description: "… It cannot exceed what the holdout of the merchant leaves (`1 − holdoutShare`).
+      The assignment splits the visitors into whole buckets of one hundredth, so the share has to
+      be one of them: `0.07` is a share, `0.075` is not."
     minimum: 0
     maximum: 1
```

**Ninguna palabra clave de JSON Schema expresa la regla.** `multipleOf: 0.01` rechazaría diez de los
ciento un valores legítimos, `0.07` entre ellos (research R-01). Por eso es una invariante y no una
restricción de esquema: es exactamente el caso que ADR-007 define.

### La invariante nueva, junto a la que ya está

```diff
 x-invariants:
   - type: invalid-experiment-cuts
     status: 422
     rule: the cuts are strictly increasing fractions
     description: A cut that does not follow the previous one is a mistake, not an order (D-F).
+  - type: treatment-share-too-fine
+    status: 422
+    rule: treatmentShare is one of the buckets the assignment splits the visitors into
+    description: "A finer share would be silently rounded to the nearest bucket, so the split that
+      runs would not be the split that was declared — `0.004` would assign nobody (ADR-035)."
```

Va **sobre el esquema** y no sobre la operación porque sólo involucra un campo propio.

## 2. `contracts/problem-types.yaml`

```diff
   - slug: invalid-treatment-share
     status: 422
     title: The treatment share of an experiment is out of range
+  - slug: treatment-share-too-fine
+    status: 422
+    title: The treatment share is finer than the split can resolve
```

Se agrega, **no** se amplía el que ya está: `0.075` está perfectamente en rango, así que «out of
range» mentiría. Además el rango lo verifica el esquema (`minimum`/`maximum` ⇒ 400) y esto es una
invariante (⇒ 422); juntarlos pondría un 400 y un 422 bajo el mismo nombre (research R-03).

## 3. `contracts/components/responses/ExperimentUnprocessable.yaml`

La respuesta tiene hoy un ejemplo. `ope-no-generic-422` exige que la `422` nombre la invariante que
la produce, así que el ejemplo pasa a mostrar las dos con `examples`:

```diff
     schema:
       $ref: ../schemas/ProblemDetails.yaml
-    example:
-      type: urn:ope:problem:invalid-experiment-cuts
-      …
+    examples:
+      cuts: { … el de hoy, sin cambios … }
+      tooFine:
+        value:
+          type: urn:ope:problem:treatment-share-too-fine
+          title: The treatment share is finer than the split can resolve
+          status: 422
+          detail: The treatment share must be one of the buckets the assignment splits into.
+          instance: /v1/admin/merchants/mrc_7f3k5d2q4m6x/experiments
```

**Verificado**, no queda abierto: la regla `ope-no-generic-422` lee `example` **y** `examples`
(plural, por `value`), exige al menos uno y que cada uno nombre una invariante declarada en la
operación o en el esquema de su cuerpo. Y `ExperimentUnprocessable.yaml` lo referencia **una sola
operación** (`createExperiment`), así que agregar el ejemplo no rompe a ninguna otra: si lo
compartieran, activar y cerrar un experimento fallarían el linter por nombrar una invariante que no
declaran.

## 4. `contracts/openapi.yaml`

```diff
-  version: 1.5.0
+  version: 1.6.0
```

Incompatible (estrecha lo aceptado) pero con incremento menor y conservando `/v1/`, porque
`info.x-stability: building` sigue declarado y ningún merchant consume el contrato (ADR-003,
constitución v1.4.2). `contract:diff` lo reporta y lo acepta; `release-check` avisa.

## Lo que **no** se toca

|                                                                    | por qué                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `Experiment.yaml` (la respuesta)                                   | las invariantes son sobre lo que entra                                         |
| `cuts` y sus `minimum`/`maximum`                                   | nadie los cuantiza (research R-06)                                             |
| `CommercialPolicy*`, `EffectiveConfiguration`, `TreatmentDefaults` | el holdout se rechaza con `invalid-configuration-value`, que ya está declarado |
| `contracts/api-map.yaml`                                           | no hay operación nueva ni cambio de ciclo de vida                              |

## Qué tiene que reportar `contract:diff`

Sólo tres cosas, y se revisan de un vistazo: la descripción de `treatmentShare`, la invariante nueva
(que oasdiff ve como extensión) y el ejemplo de la `422`. **Ningún campo agregado, quitado ni
renombrado** (SC-005). Si aparece un cuarto, se para y se revisa.
