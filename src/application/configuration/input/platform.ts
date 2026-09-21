// The reading of the platform configuration of the release (level 1): every value present; the
// ranges are the domain's (`PlatformConfiguration.of`).
import { PlatformConfiguration } from "../../../domain/configuration/index.js";
import { Shape, type Key, type ShapeResult } from "./shape.js";

const WINDOW_KEYS: readonly Key[] = ["ttlMs", "maxIds"];
const NUMBER_KEYS = [
  "clockSkewToleranceMs",
  "eventPastToleranceMs",
  "sessionWindowMs",
  "visitorWindowMs",
  "signatureWindowMs",
  "rotationGraceMaxMs",
  "anchorDiagnosticsKept",
] as const satisfies readonly Key[];
const WINDOW: Key = "dedupWindow";
const KEYS: readonly Key[] = ["version", WINDOW, ...NUMBER_KEYS];

export function readPlatformConfiguration(value: unknown): ShapeResult<PlatformConfiguration> {
  const shape = new Shape();
  const raw = shape.record(value, "");
  shape.closed(raw, KEYS, "");
  for (const key of KEYS) shape.required(raw, key, "");
  const window = shape.recordAt(raw, WINDOW, "");
  shape.closed(window, WINDOW_KEYS, WINDOW);
  for (const key of WINDOW_KEYS) shape.required(window, key, WINDOW);
  const numbers = Object.fromEntries(NUMBER_KEYS.map((key) => [key, shape.number(raw, key, "")])) as Record<
    (typeof NUMBER_KEYS)[number],
    number
  >;
  const read = shape.result({
    version: shape.string(raw, "version", ""),
    dedupWindow: {
      ttlMs: shape.number(window, "ttlMs", WINDOW),
      maxIds: shape.number(window, "maxIds", WINDOW),
    },
    ...numbers,
  });
  if (!read.ok) return read;
  return PlatformConfiguration.of(read.value);
}
