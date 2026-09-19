# Firma de plataforma (ADR-029) — lo que el adaptador del merchant implementa

Aplica a toda operación autenticada con `platformKey` (`PUT /v1/catalog`, `POST /v1/orders`,
`POST /v1/returns`) cuando el merchant tiene al menos un secreto de firma configurado
(`OPE_MERCHANTS[i].platformSecrets`). Sin secreto, sólo `X-OPE-Platform-Key`.

| Header               | Valor                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `X-OPE-Platform-Key` | la clave de plataforma (como hasta ahora)                                                |
| `X-OPE-Timestamp`    | segundos Unix (entero) del instante de la firma                                          |
| `X-OPE-Signature`    | `v1=` + hex minúscula de `HMAC-SHA256(secret, "<X-OPE-Timestamp>" + "." + cuerpo crudo)` |

- El cuerpo se firma **byte a byte** tal como se envía (sin canonicalizar, sin re-serializar).
- Ventana: |timestamp − reloj del servidor| ≤ 300 s; fuera, `401 signature-expired`.
- Falta cualquiera de los dos headers → `401 signature-missing`; formato inválido o HMAC que no
  coincide con ninguno de los secretos activos → `401 signature-invalid`. En los tres casos el
  cuerpo no se valida ni se registra.
- Rotación: dos secretos activos; OPE acepta cualquiera; el merchant cambia el suyo y después
  OPE retira el viejo.
- Los headers de credencial y de firma se redactan en los logs; el secreto nunca sale en una
  respuesta.

Ejemplo (Node):

```js
const ts = Math.floor(Date.now() / 1000);
const body = JSON.stringify(order);
const sig = "v1=" + crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-ope-platform-key": key,
    "x-ope-timestamp": String(ts),
    "x-ope-signature": sig,
  },
  body,
});
```
