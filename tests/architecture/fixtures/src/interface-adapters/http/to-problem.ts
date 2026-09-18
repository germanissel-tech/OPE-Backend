// Legitimate: the HTTP adapter's translation of business errors.
export const toProblem = (code: string): { status: number; type: string } => ({ status: 422, type: code });
