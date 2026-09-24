// Experiments of the seed (ADR-022, ADR-031): the shape is parsed here; each experiment is built
// by its factory and the set judged by its owner, and a rejected one stops the start naming the
// field. The seed is the origin: the holdout does not judge it.
import { Experiment, Experiments, type ExperimentStatus } from "../domain/experiment/index.js";
import { asExperimentId, type MerchantId } from "../domain/shared-kernel/index.js";
import { ConfigError, type MerchantField } from "./config-error.js";
import { A_NUMBER, NON_EMPTY_STRING, NOT_AN_OBJECT } from "./env.js";
import { rejected } from "./seed-errors.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = ["calibrating", "active", "closed"];
const isExperimentStatus = (value: unknown): value is ExperimentStatus =>
  typeof value === "string" && (EXPERIMENT_STATUSES as readonly string[]).includes(value);

/** Experiments of a merchant: optional list; each built by its factory, the set judged by its owner (ADR-022). */
export function parseExperiments(raw: unknown, merchantIndex: number, merchantId: MerchantId): Experiments {
  const at: MerchantField = `merchants[${merchantIndex}].experiments`;
  if (raw === undefined) return Experiments.rehydrate([]);
  if (!Array.isArray(raw)) throw new ConfigError(at, "must be an array of experiments");
  const experiments = Experiments.of(
    raw.map((item: unknown, j) =>
      parseExperiment(item, `merchants[${merchantIndex}].experiments[${j}]`, merchantId),
    ),
  );
  if (!experiments.ok) throw rejected(`merchants[${merchantIndex}]`, experiments.error);
  return experiments.value;
}

/**
 * An experiment of the seed: opened at `openedAt` with its split, seed, target sample and cuts,
 * then moved to the declared status at that same instant (active: the window starts there;
 * closed: closed there). The seed is the origin: the holdout does not judge it.
 */
function parseExperiment(item: unknown, at: MerchantField, merchantId: MerchantId): Experiment {
  if (typeof item !== "object" || item === null) throw new ConfigError(at, NOT_AN_OBJECT);
  const e = item as Record<string, unknown>;
  const experimentId = e["experimentId"];
  const seed = e["seed"];
  const status = e["status"];
  const openedAt = e["openedAt"];
  const treatmentShare = e["treatmentShare"];
  const targetSample = e["targetSample"];
  const cuts = e["cuts"] ?? [];
  if (typeof experimentId !== "string" || !ID_PATTERN.test(experimentId)) {
    throw new ConfigError(`${at}.experimentId`, "must match ^[A-Za-z0-9_-]{8,64}$");
  }
  // Shape only: it has to be a number. Its range is the domain's rule (Experiment.of).
  if (typeof treatmentShare !== "number") {
    throw new ConfigError(`${at}.treatmentShare`, A_NUMBER);
  }
  if (typeof seed !== "string") throw new ConfigError(`${at}.seed`, NON_EMPTY_STRING);
  if (typeof targetSample !== "number") throw new ConfigError(`${at}.targetSample`, A_NUMBER);
  if (!isNumberArray(cuts)) throw new ConfigError(`${at}.cuts`, "must be an array of numbers");
  if (!isExperimentStatus(status)) {
    throw new ConfigError(`${at}.status`, `must be one of ${EXPERIMENT_STATUSES.join(", ")}`);
  }
  if (typeof openedAt !== "string" || Number.isNaN(Date.parse(openedAt))) {
    throw new ConfigError(`${at}.openedAt`, "must be an RFC 3339 date-time");
  }
  const opened = new Date(openedAt);
  const experiment = Experiment.of({
    experimentId: asExperimentId(experimentId),
    merchantId,
    treatmentShare,
    seed,
    targetSample,
    cuts,
    openedAt: opened,
  });
  if (!experiment.ok) throw rejected(at, experiment.error);
  return moved(experiment.value, status, opened);
}

/** The experiment in the status the seed declares, as of its opening. */
function moved(experiment: Experiment, status: ExperimentStatus, at: Date): Experiment {
  if (status === "closed") return experiment.closed(at);
  if (status === "calibrating") return experiment;
  const activated = experiment.activated(at);
  // A calibrating experiment always activates: the entity was just built.
  if (!activated.ok) throw new Error("A calibrating experiment could not be activated.");
  return activated.value;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}
