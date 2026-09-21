# Contrato — Configuración del SDK y diagnóstico de anclajes (US4) (R-11)

Consumidor `sdk`, esquema `ingestKey`, tag `ingest` (como está planificado en el mapa). El
merchant se deriva de la clave; CORS con los orígenes registrados, como `ingestEvents`.

## `getSdkConfig` — `GET /v1/sdk/config` (`config:read`)

Respuesta `200 SdkConfig`:

```yaml
enabled: true # false con el kill switch apagado
versions: { platform: platform-1, defaults: defaults-1, merchant: 3 }
surfaces: [product, cart]
locales: { supported: [es-AR, en], fallback: es-AR }
anchors:
  size_selector: { selectors: ["#product-options-wrapper .swatch-attribute.size"] }
  price: { selectors: [".product-info-price"] }
```

Nunca: políticas, márgenes, escalones, reparto, brazo, experimento, presupuestos. `anchors`
puede faltar (sin mapa: el SDK usa su cadena de resolución de `01 §3.1.1`). `Cache-Control:
no-store`: la configuración cambia en caliente. Un merchant `deactivated` no autentica (401).

## `reportAnchorDiagnostics` — `POST /v1/sdk/diagnostics` (`diagnostics:write`)

Body `AnchorDiagnosticsReport` (`additionalProperties: false`):

```yaml
configurationVersion: 3 # opcional: la que el SDK tenía cargada
unresolved:
  - { anchor: size_selector, pageType: product }
  - { anchor: cta, pageType: product }
```

`anchor ∈ ANCHORS` (esquema `Anchor` existente), `pageType ∈ PageType`, 1..n elementos, sin
URL, sin producto, sin nada de la persona. Respuesta `202 { received: n }`. OPE conserva por
merchant el último instante y un contador por `(anchor, pageType, configurationVersion)`,
con tope `anchorDiagnosticsKept` de plataforma (se descarta el más viejo). El operador lo lee
con `listAnchorDiagnostics` (`admin-api.md`).

## Invariantes

Ninguna que el esquema no exprese: los vocabularios son enums; el tope es de plataforma y no
se rechaza (se descarta lo más viejo).
