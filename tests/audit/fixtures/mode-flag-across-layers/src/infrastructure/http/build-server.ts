// Eval fixture: the server knows whether it is "the mock" and answers differently (the pre-005
// build-server, condensed). The mode is a flag the composition root reads from configuration
// and infrastructure consults again: the same decision, taken twice, in two layers.
export type ServerMode = "real" | "mock";

interface Api {
  mockResponseForOperation(operationId: string): { status: number; mock: unknown };
}
interface Response {
  status: number;
  body: unknown;
}

export function notImplemented(api: Api, mode: ServerMode, operationId: string): Response {
  if (mode === "mock") {
    const mocked = api.mockResponseForOperation(operationId);
    return { status: mocked.status, body: mocked.mock };
  }
  return { status: 501, body: { type: "urn:ope:problem:not-implemented", status: 501 } };
}
