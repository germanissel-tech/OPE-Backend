# Data model — Alineación con los documentos base del MVP (016)

## Cadena de evidencia en el contrato (R-04)

```
OrderStatus   = VERIFIED_ORDER | ATTRIBUTED_ORDER | RETURNED      # lo que la plataforma confirmó
Correlation   = PENDING_CORRELATION | ATTRIBUTED                  # lo que OPE pudo vincular
```

| Situación de la orden                      | `status`           | `correlation`         |
| ------------------------------------------ | ------------------ | --------------------- |
| Confirmada, sin sesión conocida            | `VERIFIED_ORDER`   | `PENDING_CORRELATION` |
| Confirmada, sesión en la que OPE decidió   | `ATTRIBUTED_ORDER` | `ATTRIBUTED`          |
| Devuelta (cualquiera de las dos de arriba) | `RETURNED`         | la que tenía          |

- `OrderResult { orderId, status, correlation, receivedAt }`; `ReturnResult { orderId, status: RETURNED, correlation, receivedAt }` (sin `orderStatus`).
- Dominio: `Order.status(): OrderStatus` (con `returned` ⇒ `RETURNED`), `Order.correlationStatus(): CorrelationStatus`. Invariantes sin cambio (ADR-028): la correlación se decide una vez; la devolución la conserva.
- Idempotencia sin cambio: una notificación repetida de una orden ya devuelta responde 200 con `status: RETURNED`.

## Idioma de la página (R-05)

```
PageContext.locale?: string   # BCP 47 por forma: ^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$, ≤ 35
ProductFocus.locale?: string  # el de la página de producto en foco
DecisionRecord.locale?: string  # el idioma en que se decidió; ausente si la página no lo declaró
```

Sin efecto en asignación, inferencia, evidencia, selección ni política. Se registra para que el catálogo de mensajes por idioma (020) y el análisis (021) lo tengan desde la primera decisión.

## Identificador citado (R-06)

```
Cita     = { file, line, text }                    # span entre comillas de código en constitución, ADR o glosario
Forma    = snake | kebab | camelCase | SCREAMING    # lo que se considera identificador
Existe   = token de contracts/dist/openapi.yaml ∪ contracts/{problem-types,no-op-reasons,api-map}.yaml ∪ src/**/*.ts
Exclusión = { identifier, reason }                 # scripts/identifiers-allowlist.json; sin reason ⇒ el gate falla
Hallazgo = Cita con Forma y sin Existe y sin Exclusión
```

## Roadmap (R-03)

```
016 Alineación con los documentos base (esta)
017 Configuración, flags, kill switch y administración   (antes 016)
018 Persistencia y resiliencia                            (antes 019)
019 Puerto de plataforma, estrategia por flujo y adaptadores (antes 021)
020 Catálogo de mensajes                                  (antes 017)
021 Análisis ITT y portal del merchant                    (antes 018)
022 Observabilidad y end-to-end                           (antes 020)
```

Toda operación planificada del mapa apunta al número nuevo de su feature.

## Decisiones de producto confirmadas (R-02)

```
D-B abandono como amplificador; incentivo sólo con barrera precio; reaseguro sin señal previa
D-C histórico de devoluciones OPCIONAL; riesgo por comportamiento de sesión
D-E evidencia sólo de catálogo y configuración; sin escasez ni prueba social
D-F portal: salud siempre visible, resultado en cortes; veredicto → intervalo → cifras → fecha
D-G calibración, después configuración congelada; arreglos que restauran; kill switch
```

Estado: confirmadas por el dueño el 2026-09-20 (ADR nuevo); D3–D6 siguen abiertas (ADR-010, `01 §13`).
