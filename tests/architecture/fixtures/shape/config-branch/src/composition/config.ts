// Shape fixture: config.ts parses the environment and may branch; it is exempt.
export function readConfig(env: Record<string, string | undefined>): { mode: "real" | "mock" } {
  const config = { mode: env["OPE_MOCK"] === "1" ? ("mock" as const) : ("real" as const) };
  if (config.mode === "mock") return config;
  return config;
}
