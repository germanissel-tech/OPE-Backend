// US5 (FR-040): el hook de pre-commit corre formato y lint sobre lo staged y el typecheck;
// nunca la verificación del contrato ni las pruebas. Verificación estática de lefthook.yml
// (ejecutar git hooks dentro de una prueba sería frágil).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Job {
  name: string;
  run: string;
  glob?: string;
}
interface Lefthook {
  "pre-commit": { parallel?: boolean; jobs: Job[] };
}

const config = parse(readFileSync(path.resolve("lefthook.yml"), "utf8")) as Lefthook;
const jobs = config["pre-commit"].jobs;
const byName = (name: string): Job | undefined => jobs.find((j) => j.name === name);

describe("lefthook.yml (pre-commit)", () => {
  it("corre en paralelo format, lint y typecheck", () => {
    expect(config["pre-commit"].parallel).toBe(true);
    expect(jobs.map((j) => j.name).sort()).toEqual(["format", "lint", "typecheck"]);
  });

  it("format y lint actúan sólo sobre los archivos staged, con los globs de la spec", () => {
    expect(byName("format")?.run).toContain("{staged_files}");
    expect(byName("format")?.glob).toBe("*.{ts,mts,cts,js,mjs,cjs,json,yaml,yml,md}");
    expect(byName("lint")?.run).toContain("{staged_files}");
    expect(byName("lint")?.glob).toBe("*.{ts,mts,cts,js,mjs,cjs}");
    expect(byName("typecheck")?.run).toBe("npm run typecheck");
  });

  it("no corre contract:check ni las pruebas", () => {
    for (const job of jobs) {
      for (const forbidden of ["contract:check", "npm test", "vitest", "test:contract", "release-check"]) {
        expect(job.run, `${job.name} no debe correr ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
