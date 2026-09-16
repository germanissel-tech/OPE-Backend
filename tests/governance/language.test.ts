// US1 (FR-002..FR-004; ADR-015): Spanish in comments, strings and contract prose fails the
// build; identifiers are never examined; `lang:es -- reason` allows a line and is counted.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const run = (...extra: string[]) =>
  runScript("check-language.mjs", ["--root", fixture("language"), "--dir", ".", ...extra]);

describe("check:language", () => {
  const r = run();

  it("fails naming file, line and fragment for accents, words without accents, strings and YAML", () => {
    expect(r.status).toBe(1);
    expect(r.output).toContain("accent.ts:1:");
    // lang:es -- the fixture content under test is Spanish on purpose
    expect(r.output).toContain("words-only.ts:1: // lista de eventos para el lote");
    // lang:es -- idem
    expect(r.output).toContain('string.ts:2: "El lote es invalido"');
    expect(r.output).toContain("spanish.yaml:4:");
  });

  it("fails on `lang:es` without a reason", () => {
    expect(r.output).toContain("allowed-no-reason.ts:2: `lang:es` without ` -- reason`");
  });

  it("ignores identifiers, English text, and lines allowed with a reason", () => {
    for (const clean of ["identifier-only.ts", "english.ts", "allowed.ts:", "allowed.yaml"]) {
      expect(r.output, clean).not.toContain(clean);
    }
  });

  it("counts the exceptions", () => {
    expect(r.output).toContain("Language exceptions: 2");
  });

  it("emits the gate JSON with --json", () => {
    const j = JSON.parse(run("--json").output) as {
      gate: string;
      mode: string;
      status: string;
      findings: { file: string; line: number; rule: string }[];
      exceptions: number;
    };
    expect(j.gate).toBe("language");
    expect(j.mode).toBe("blocking");
    expect(j.status).toBe("fail");
    expect(j.exceptions).toBe(2);
    expect(j.findings.map((f) => `${f.file}:${f.line}`)).toEqual([
      "accent.ts:1",
      "allowed-no-reason.ts:2",
      "spanish.yaml:4",
      "string.ts:2",
      "words-only.ts:1",
    ]);
  });
});

describe("scripts/language-denylist.json", () => {
  const list = JSON.parse(readFileSync(path.resolve("scripts/language-denylist.json"), "utf8")) as {
    words: string[];
  };

  it("holds only lowercase, unaccented words of two or more letters, without duplicates", () => {
    for (const w of list.words) {
      expect(w, w).toMatch(/^[a-z]{2,}$/);
    }
    expect(new Set(list.words).size).toBe(list.words.length);
  });

  it("excludes words that also exist in English", () => {
    for (const w of ["no", "error", "final", "general", "a", "y", "o", "me", "he"]) {
      expect(list.words, w).not.toContain(w);
    }
  });
});
