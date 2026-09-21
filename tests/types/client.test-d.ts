// SC-007: a typed request to getHealth compiles; a use with the wrong type does not compile.
// Verified with `npm run typecheck`.
import { createOpeClient, type components } from "../../client/index.js";

const client = createOpeClient({ baseUrl: "http://127.0.0.1:3000" });

export async function health(): Promise<components["schemas"]["Health"] | undefined> {
  const { data, error } = await client.GET("/v1/health");
  if (error) {
    // The error is typed as Problem Details: `type` is a string without any assertion.
    const problemType: string = error.type;
    throw new Error(problemType);
  }
  return data;
}

// @ts-expect-error the path does not exist in the contract.
export const badPath = client.GET("/v1/nope");

// @ts-expect-error POST is not declared for /v1/health.
export const badMethod = client.POST("/v1/health");

export async function wrongShape(): Promise<unknown> {
  const { data } = await client.GET("/v1/health");
  // @ts-expect-error Health has no `uptime` property.
  const uptime: unknown = data?.uptime;
  return uptime;
}
