// Punto de entrada: lee la configuración, arranca por el composition root y maneja señales.
// Ninguna instancia concreta vive acá (ADR-013).
import { readFileSync } from "node:fs";
import { bootstrap } from "./composition/bootstrap.js";
import { readConfig } from "./composition/config.js";

async function main(): Promise<void> {
  const config = readConfig(process.env, (file) => readFileSync(file, "utf8"));
  const { app, close } = await bootstrap(config);

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, "apagando");
    void close().then(() => process.exit(0));
  };
  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { mode: config.mode, contract: config.contractPath, merchants: config.merchants.length },
    "OPE backend listo",
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`No se pudo arrancar el servidor: ${message}`);
  process.exit(1);
});
