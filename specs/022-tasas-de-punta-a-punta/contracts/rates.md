# Contrato — los ocho campos, antes y después

Todo lo que el contrato declara como porcentaje entero pasa a ser una tasa. El nombre nuevo de cada
campo **ya existe adentro del sistema**: el contrato adopta el vocabulario del dominio.

## 1. La regla

|             | Antes                      | Después                                  |
| ----------- | -------------------------- | ---------------------------------------- |
| tipo        | `integer`                  | `number`                                 |
| rango       | `0` … `100`                | `0` … `1`                                |
| nombre      | `…Percent`                 | `…Share`                                 |
| descripción | "as an integer percentage" | la fracción, y a qué resuelve el sistema |

## 2. Campo por campo

### Experimento (`Experiment`, `ExperimentCreate`)

```yaml
# antes
treatmentPercent:
  type: integer
  description: Share of visitors assigned to TREATMENT, as an integer percentage.
  minimum: 0
  maximum: 100

# después
treatmentShare:
  type: number
  description: >-
    Share of visitors assigned to TREATMENT, as a fraction of 1. The assignment resolves to
    whole buckets of one hundredth, so a finer value takes the nearest bucket.
  minimum: 0
  maximum: 1
```

```yaml
# cuts: la lista deja de ser de enteros
cuts:
  type: array
  description: >-
    Interim cuts as fractions of the target sample, strictly increasing; empty when the target
    sample is the only cut.
  items:
    type: number
    exclusiveMinimum: 0
    maximum: 1
```

El **mínimo exclusivo** de un corte es la traducción fiel de su `minimum: 1` de hoy: un corte tiene
que estar por encima de cero, y "1" significaba "1 %", no "el total".

### Configuración (`EffectiveConfiguration`, `TreatmentDefaults`, `MerchantConfigurationDeclared`)

| Antes                            | Después                     |
| -------------------------------- | --------------------------- |
| `holdoutPercent: integer 0..100` | `holdoutShare: number 0..1` |

### Política comercial (`CommercialPolicy`, `CommercialPolicyDeclared`)

| Antes                                      | Después                               |
| ------------------------------------------ | ------------------------------------- |
| `maxIncentivePercent: integer 0..100`      | `maxIncentiveShare: number 0..1`      |
| `incentiveLadderPercent: integer[]`        | `incentiveLadderShare: number[]`      |
| `marginPercent: integer 0..100` (opcional) | `marginShare: number 0..1` (opcional) |

La descripción de estos tres decía "Percentages at the edge; the domain works with rates". Esa
frase desaparece: ya no hay borde donde algo sea distinto.

### Incentivo (`Incentive`)

```yaml
# antes
value:
  type: integer
  description: The percentage, as the merchant's commercial policy allows it (never above its ceiling).
  minimum: 1
  maximum: 100

# después
value:
  type: number
  description: >-
    The share the incentive grants, as a fraction of 1 and never above the merchant's ceiling.
    A fifteen percent discount is `0.15`.
  exclusiveMinimum: 0
  maximum: 1
```

**El mínimo es la trampa de este campo.** Escribir `minimum: 1` sería cometer, en el contrato, el
error exacto que la feature elimina: 1 dejó de significar "uno por ciento" y ahora significa "todo".

`kind` **no cambia**: sigue siendo `percent` porque describe **qué clase de incentivo** es —un
descuento proporcional y no un monto fijo—, y eso no depende de la unidad. Lo que se ajusta es su
descripción, para que `kind: percent` con `value: 0.15` no se lea como "0,15 %".

## 3. La versión

`info.version` de `1.4.0` a **`1.5.0`**, y el prefijo `/v1/` **se conserva**.

Es un cambio incompatible y la constitución pediría versión mayor, pero ADR-003 declara la
excepción: mientras `info.x-stability: building` esté puesta —ningún merchant consume el contrato—
entra con bump menor, `contract:diff` lo reporta y lo acepta, y `release-check` avisa.

**Lo que el diff tiene que mostrar**: los ocho campos y nada más. Cualquier otro cambio
incompatible es alcance que se escapó.

## 4. Lo que no cambia

|                                               |                                                   |
| --------------------------------------------- | ------------------------------------------------- |
| Las rutas y los `operationId`                 | intactos                                          |
| Los esquemas de seguridad y las capacidades   | intactos                                          |
| Los tipos de problema y sus status            | intactos                                          |
| El resto de los campos de esos siete esquemas | intactos                                          |
| El mapa del contrato                          | ninguna operación nace, muere ni cambia de estado |

## 5. Lo que hay que regenerar

- Los tipos que el contrato deriva.
- Los esquemas de los archivos de configuración, que salen del mismo bundle — y con ellos, los
  valores de la configuración versionada, que pasan a la unidad nueva.
- El cliente tipado que el repositorio publica.
- Los ejemplos de las operaciones afectadas, que hoy muestran enteros.
