import type { CatalogStore } from "../../application/catalog/ports/catalog-store.js";
// Fixture: dos componentes distintos declaran la misma etiqueta.
// Fixture de check:ports-bound: el gate lee la forma, no compila el proyecto; estas declaraciones
// son las mínimas para que el árbol sea TypeScript válido.
declare function port(label: string): <T>() => { label: string };
interface Clock {
  now(): Date;
}
export const CatalogStorePort = port("catalog.store")<CatalogStore>();
export const OtherPort = port("catalog.store")<Clock>();
