// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
type Status = "ok" | "degraded";
export function label(s: Status): string {
  switch (s) {
    case "ok":
      return "bien";
  }
  return "?";
}
