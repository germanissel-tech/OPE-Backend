// Fixture: el módulo de composición no enlaza el puerto de su módulo.
// Fixture de check:ports-bound: el gate lee la forma, no compila el proyecto; estas declaraciones
// son las mínimas para que el árbol sea TypeScript válido.
declare function port(label: string): <T>() => { label: string };
interface Clock {
  now(): Date;
}
export const ClockPort = port("catalog.clock")<Clock>();
