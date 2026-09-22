// Feature 019 D-02 (ADR-032): the conditioning-project skill makes a repository auditable. On
// this repository it detects everything (no question left), rebuilds a profile equivalent to
// the committed one and the doctor is green; on an empty repository it writes the minimum, the
// doctor lists what is missing and succeeds; a second run changes nothing; a manual edit is
// never overwritten.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const skill = path.resolve("plugins/auditable-architecture/skills/conditioning-project");
const EMPTY_REPO = path.resolve("tests/audit/fixtures/empty-repo");

interface Inspection {
  sources: Record<string, { found: boolean; path?: string }>;
  tools: Record<string, { found: boolean; path?: string; adapter?: string }>;
  modules: { roots: string[] } | null;
  diffBase: string | null;
  questions: { key: string; question: string; options: string[]; suggested: string }[];
}
interface Doctor {
  gates: { id: string; status: string; reason?: string }[];
  sources: { kind: string; status: string; reason?: string }[];
  criteria: { status: string; placeholders: number };
  maxVerdict: string;
}

const tmp: string[] = [];
afterAll(() => {
  for (const dir of tmp) rmSync(dir, { recursive: true, force: true });
});

function run(
  script: string,
  args: string[],
  cwd = process.cwd(),
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [path.join(skill, "scripts", script), ...args], {
    encoding: "utf8",
    cwd,
  });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

/** A hash of every file under a directory (path + content), to prove a run changed nothing. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[path.relative(dir, full).replaceAll("\\", "/")] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

function emptyRepoCopy(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ope-empty-repo-"));
  cpSync(EMPTY_REPO, dir, { recursive: true });
  tmp.push(dir);
  return dir;
}

describe("inspect.mjs on this repository", () => {
  const r = run("inspect.mjs", ["."]);
  const inspection = JSON.parse(r.stdout) as Inspection;

  it("detects the constitution, the ADRs, the agent guide and every gate tool, with their adapters", () => {
    expect(r.status, r.stderr).toBe(0);
    expect(inspection.sources["constitution"]?.found).toBe(true);
    expect(inspection.sources["adr"]?.found).toBe(true);
    expect(inspection.sources["guide"]?.found).toBe(true);
    for (const tool of ["eslint", "dependency-cruiser", "jscpd", "knip", "stryker"]) {
      expect(inspection.tools[tool]?.found, tool).toBe(true);
    }
    expect(inspection.tools["eslint"]?.adapter).toBe("scripts/audit/gate-lint.mjs");
  });

  it("proposes the module roots from the organisation of src/ and the diff base from the remote", () => {
    expect(inspection.modules?.roots).toEqual([
      "src/domain/{name}",
      "src/application/{name}",
      "src/interface-adapters/{name}",
    ]);
    expect(inspection.diffBase).toBe("origin/main");
  });

  it("leaves no question: everything was detected", () => {
    expect(inspection.questions).toEqual([]);
  });
});

describe("write-profile.mjs and doctor.mjs on this repository", () => {
  it("rebuilds a profile equivalent to the committed one (dry run)", () => {
    const r = run("write-profile.mjs", [".", "--dry-run"]);
    expect(r.status, r.stderr).toBe(0);
    const written = JSON.parse(r.stdout) as { files: Record<string, string> };
    const rebuilt = JSON.parse(written.files["audit.profile.json"] ?? "{}") as Record<string, unknown>;
    const committed = JSON.parse(readFileSync("audit.profile.json", "utf8")) as Record<string, unknown>;
    for (const key of ["profileVersion", "sourceRoot", "scopes", "criteria", "evals"]) {
      expect(rebuilt[key], key).toEqual(committed[key]);
    }
    const ids = (p: Record<string, unknown>) => (p["gates"] as { id: string }[]).map((g) => g.id).sort();
    expect(ids(rebuilt)).toEqual(ids(committed));
    // The rebuilt profile declares every kind the committed one declares, except the ones that
    // point outside the repository (`dirEnv`: the MVP documents), which only the owner adds.
    const kinds = (p: Record<string, unknown>) =>
      (p["sources"] as { kind: string; resolve: { dirEnv?: string } }[])
        .filter((s) => s.resolve.dirEnv === undefined)
        .map((s) => s.kind);
    expect(kinds(rebuilt)).toEqual(expect.arrayContaining(kinds(committed)));
    expect(kinds(rebuilt)).toEqual(
      expect.arrayContaining(["constitution#", "ADR-", "guide#", "spec:", "lint:", "clarity:"]),
    );
  });

  it("the doctor is green: no gate or source missing or degraded, criteria without placeholders, verdict rejected reachable", () => {
    const r = run("doctor.mjs", [".", "--json"]);
    expect(r.status, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout) as Doctor;
    expect(report.gates.filter((g) => g.status !== "ready")).toEqual([]);
    expect(report.sources.filter((s) => s.status !== "ready")).toEqual([]);
    expect(report.criteria).toEqual({ status: "ready", placeholders: 0 });
    expect(report.maxVerdict).toBe("rejected");
  }, 180_000);
});

describe("on an empty repository", () => {
  it("inspect finds nothing and asks the three questions with a suggestion each", () => {
    const dir = emptyRepoCopy();
    const r = run("inspect.mjs", ["."], dir);
    expect(r.status, r.stderr).toBe(0);
    const inspection = JSON.parse(r.stdout) as Inspection;
    expect(Object.values(inspection.sources).every((s) => !s.found)).toBe(true);
    expect(Object.values(inspection.tools).every((t) => !t.found)).toBe(true);
    expect(inspection.questions.map((q) => q.key).sort()).toEqual(
      ["diffBase", "blockingGates", "moduleRoots"].sort(),
    );
    for (const q of inspection.questions) {
      expect(q.options.length).toBeGreaterThan(0);
      expect(q.options).toContain(q.suggested);
    }
  });

  it("write-profile writes the minimum profile and the criteria template with placeholders; the doctor lists the pending sources and succeeds; a second run changes nothing", () => {
    const dir = emptyRepoCopy();
    const answers = JSON.stringify({
      moduleRoots: ["src/{name}"],
      blockingGates: [],
      diffBase: "origin/main",
    });
    const first = run("write-profile.mjs", [".", "--answers", answers], dir);
    expect(first.status, first.stderr).toBe(0);
    expect(existsSync(path.join(dir, "audit.profile.json"))).toBe(true);
    expect(existsSync(path.join(dir, "docs/auditoria/criterios-diseno.md"))).toBe(true);
    const profile = JSON.parse(readFileSync(path.join(dir, "audit.profile.json"), "utf8")) as {
      profileVersion: number;
      gates: unknown[];
      sources: { kind: string }[];
      conditioning: { answers: Record<string, unknown> };
    };
    expect(profile.profileVersion).toBe(1);
    expect(profile.gates).toEqual([]);
    expect(profile.sources.map((s) => s.kind)).toContain("clarity:");
    expect(profile.conditioning.answers).toEqual(JSON.parse(answers));
    expect(readFileSync(path.join(dir, "docs/auditoria/criterios-diseno.md"), "utf8")).toContain(
      "PLACEHOLDER",
    );

    const doctor = run("doctor.mjs", [".", "--json"], dir);
    expect(doctor.status, doctor.stderr).toBe(0);
    const report = JSON.parse(doctor.stdout) as Doctor;
    expect(report.sources.filter((s) => s.status === "missing").map((s) => s.kind)).toEqual(
      expect.arrayContaining(["constitution#", "ADR-"]),
    );
    expect(report.criteria.status).toBe("degraded");
    expect(report.maxVerdict).toBe("changes-required");

    const before = snapshot(dir);
    const second = run("write-profile.mjs", ["."], dir);
    expect(second.status, second.stderr).toBe(0);
    expect(snapshot(dir)).toEqual(before);
    expect(second.stdout).toContain("unchanged");
  });

  it("a manual edit of the profile is reported, never overwritten", () => {
    const dir = emptyRepoCopy();
    const answers = JSON.stringify({
      moduleRoots: ["src/{name}"],
      blockingGates: [],
      diffBase: "origin/main",
    });
    expect(run("write-profile.mjs", [".", "--answers", answers], dir).status).toBe(0);
    const file = path.join(dir, "audit.profile.json");
    const edited = readFileSync(file, "utf8").replace('"sourceRoot": "src"', '"sourceRoot": "lib"');
    writeFileSync(file, edited);
    const r = run("write-profile.mjs", ["."], dir);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(edited);
    expect(r.stdout).toContain("differs");
  });
});
