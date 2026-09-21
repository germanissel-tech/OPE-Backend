// The three versions a decision is taken with (01 §14.2; constitution XI): platform, treatment
// defaults and, when the merchant published one, its own. Shared by the configuration that
// resolves them, the decision plane that stamps them and the ledger that records them.
export interface ConfigurationVersions {
  platform: string;
  defaults: string;
  merchant?: number;
}
