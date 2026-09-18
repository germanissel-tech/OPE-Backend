// Operational log around any use case (ADR-023): name, duration and outcome — `ok`, or the code
// of the returned error — per execution. Never the request, never `details`: nothing personal
// can leak through here. Composition decides which use cases it wraps; the use case itself
// does not know it exists.
import type { Clock } from "../ports/clock.js";
import type { Logger } from "../ports/logger.js";
import type { UseCase } from "../use-case.js";

export interface LoggedUseCaseDependencies {
  clock: Clock;
  logger: Logger;
}

const OK = "ok";

/** The code of a failed Result, `ok` for anything else (a success or a response that is not a Result). */
function outcomeOf(response: unknown): string {
  if (typeof response !== "object" || response === null) return OK;
  const result = response as { ok?: unknown; error?: { code?: unknown } };
  return result.ok === false && typeof result.error?.code === "string" ? result.error.code : OK;
}

export class LoggedUseCase<Request, Response> implements UseCase<Request, Response> {
  readonly #name: string;
  readonly #inner: UseCase<Request, Response>;
  readonly #deps: LoggedUseCaseDependencies;

  constructor(name: string, inner: UseCase<Request, Response>, deps: LoggedUseCaseDependencies) {
    this.#name = name;
    this.#inner = inner;
    this.#deps = deps;
  }

  async execute(request: Request): Promise<Response> {
    const { clock, logger } = this.#deps;
    const started = clock.now().getTime();
    const response = await this.#inner.execute(request);
    logger.info(
      { useCase: this.#name, durationMs: clock.now().getTime() - started, outcome: outcomeOf(response) },
      "use case executed",
    );
    return response;
  }
}
