// Fixture: un puerto que el módulo de aplicación declara y nadie enlaza.
export interface CatalogStore {
  put(id: string): Promise<void>;
}
