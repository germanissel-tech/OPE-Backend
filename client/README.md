# client/ — el cliente tipado para consumidores

Un cliente HTTP tipado (openapi-fetch, ~2 KB gzip) para el SDK y el portal, derivado de los
mismos tipos que el servidor (`generated/api.d.ts`). No es parte del servidor: nada de `src/` lo
importa; se compila aparte (`tsconfig.client.json`; `npm run build` compila los dos proyectos) y
se publica como el export `./client` del paquete
(`import { createOpeClient } from "ope-backend/client"`). Las pruebas de tipos lo cubren en
`tests/types/client.test-d.ts`.

## Inventario

| Entrada    | Qué es                                                                                   | Fuente o derivado | Quién lo lee                                             | Verificación                                                               |
| ---------- | ---------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `index.ts` | `createOpeClient(baseUrl, credential)`: un cliente openapi-fetch tipado por el contrato. | fuente            | consumidores del paquete; `tests/types/client.test-d.ts` | `typecheck`; `build` (`dist/client/`); `arch` (nadie en `src/` lo importa) |
