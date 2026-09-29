// The modules that exist in **every** deployment and whose only difference is which technology serves
// them. `sharedModules` holds the ones with nothing to choose; these are the ones with something.
//
// **Why they are a list and not written twice.** Until feature 033 the two deployments repeated five
// identical `.with(…)` lines each, which was legible while it was five; the sixth crossed the duplication
// gate's threshold, and the gate was right for the wrong reason — an import list is not knowledge written
// twice, but **this** list is, and the gate found it while the reader would not have. What differs between
// the two deployments is a single word, and now that word is an argument.
//
// The technology stays a **literal** at each call site: `Technology` is a type parameter, so
// `modulesWith("sqlite")` gives each module `Chosen<M, "sqlite">` and not the union of both. Taking the
// union instead would typecheck and would quietly say that a deployment provides whichever of the two,
// which is exactly the promise the typed graph exists to keep exact (ADR-033).
import { catalogModule } from "../modules/catalog.js";
import { experimentModule } from "../modules/experiment.js";
import { ingestionModule } from "../modules/ingestion.js";
import { ledgerModule } from "../modules/ledger.js";
import { merchantModule } from "../modules/merchant.js";
import { outcomesModule } from "../modules/outcomes.js";

/** The two ways a module of this list can be served. Leaving the choice out does not compile. */
export type Technology = "memory" | "sqlite";

export const modulesWith = <T extends Technology>(technology: T) =>
  [
    catalogModule.with(technology),
    experimentModule.with(technology),
    // Ingestion is in this list because of the register (feature 031). Its queue is the same in both
    // deployments; what the technology chooses is only what the queue writes to.
    ingestionModule.with(technology),
    ledgerModule.with(technology),
    // The merchants joined in feature 033. In `sqlite` the gateway answers its reads from an in-memory
    // index, so this choice is about where the writes land and not about where the hot path reads.
    merchantModule.with(technology),
    outcomesModule.with(technology),
  ] as const;
