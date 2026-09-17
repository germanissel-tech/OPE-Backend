// Dead-code fixture: `orphan` and `Unused` are exported and never imported.
export function used(): string {
  return "used";
}

export const orphan = 1;

export type Unused = { a: number };
