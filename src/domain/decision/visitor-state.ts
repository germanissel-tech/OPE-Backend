// Visitor state of the decision plane (01-arquitectura-mvp.md §4.5, "cooldown y fatiga";
// ADR-027): what the plane remembers of a visitor across sessions — when the ledger accepted
// an intervention for them, within a window. Hot, bounded state behind a port; a forgotten
// visitor starts over. Immutable: every change is a new value.

export interface VisitorStateRecord {
  interventions: readonly Date[];
}

export class VisitorState {
  readonly interventions: readonly Date[];

  private constructor(record: VisitorStateRecord) {
    this.interventions = record.interventions;
  }

  static empty(): VisitorState {
    return new VisitorState({ interventions: [] });
  }

  static rehydrate(record: VisitorStateRecord): VisitorState {
    return new VisitorState(record);
  }

  /** Interventions accepted within the last `windowMs` before `now`. */
  countSince(now: Date, windowMs: number): number {
    const since = now.getTime() - windowMs;
    return this.interventions.filter((at) => at.getTime() > since).length;
  }

  /** One more intervention at `now`; whatever fell out of the window is forgotten. */
  withIntervention(now: Date, windowMs: number): VisitorState {
    const since = now.getTime() - windowMs;
    return new VisitorState({
      interventions: [...this.interventions.filter((at) => at.getTime() > since), now],
    });
  }

  /** The instant of the latest intervention, for a store to expire the visitor. */
  updatedAt(): Date | undefined {
    return this.interventions.at(-1);
  }
}
