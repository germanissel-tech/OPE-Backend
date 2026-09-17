// Shape fixture: a module path taken from the environment and loaded at runtime (the old
// `loadHandlersModule` of bootstrap.ts). The literal dynamic import below is allowed.
import { pathToFileURL } from "node:url";

export async function loadHandlersModule(file: string | undefined): Promise<unknown> {
  if (file === undefined) return {};
  const mod = (await import(pathToFileURL(file).href)) as { handlers: unknown };
  return mod.handlers;
}

export const literal = (): Promise<unknown> => import("./ok.js");
