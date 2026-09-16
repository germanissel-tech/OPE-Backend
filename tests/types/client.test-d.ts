// SC-007: un request tipado a getHealth compila; un uso con tipo incorrecto no compila.
// Se verifica con `npm run typecheck`.
import { createOpeClient, type components } from "../../src/client/index.js";

const client = createOpeClient({ baseUrl: "http://127.0.0.1:3000" });

export async function health(): Promise<components["schemas"]["Health"] | undefined> {
  const { data, error } = await client.GET("/v1/health");
  if (error) {
    // El error está tipado como Problem Details.
    const type: string = error.type;
    void type;
  }
  return data;
}

// @ts-expect-error la ruta no existe en el contrato.
export const badPath = client.GET("/v1/nope");

// @ts-expect-error POST no está declarado para /v1/health.
export const badMethod = client.POST("/v1/health");

export async function wrongShape(): Promise<void> {
  const { data } = await client.GET("/v1/health");
  // @ts-expect-error Health no tiene la propiedad `uptime`.
  const uptime: number = data?.uptime;
  void uptime;
}
