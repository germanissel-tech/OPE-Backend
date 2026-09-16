// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
const f: unknown = () => 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el fixture necesita un valor any para provocar la llamada insegura
export const r = (f as any)();
