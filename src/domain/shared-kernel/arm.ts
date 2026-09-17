// The two arms of an experiment (01-arquitectura-mvp.md §0.1): CONTROL never receives an
// intervention; TREATMENT may. Shared by the experiment module (which assigns) and the ledger
// (which records the arm on every decision).
export type Arm = "CONTROL" | "TREATMENT";
