// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el fixture necesita un valor any para provocar el acceso inseguro
const o = JSON.parse("{}") as any;
export const v: unknown = o.prop;
