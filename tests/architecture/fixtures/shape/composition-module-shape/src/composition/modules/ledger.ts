// Fixture (feature 020, FR-008): un módulo de composición que exporta algo que no es un componente
// ni el módulo — una fábrica que otro módulo podría llamar sin pasar por el grafo.
export const DecisionLedgerPort = port("ledger.decisions")<DecisionLedger>();

export function decisionRecorderOf(ports: LedgerPorts): DecisionRecorder {
  return new DefaultDecisionRecorder(ports);
}

export const ledgerModule = compositionModule({
  ports: [DecisionLedgerPort],
});
