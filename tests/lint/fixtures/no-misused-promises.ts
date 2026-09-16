// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
export function go(): string {
  if (Promise.resolve(true)) return "a";
  return "b";
}
