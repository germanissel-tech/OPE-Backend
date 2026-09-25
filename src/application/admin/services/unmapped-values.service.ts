// What a merchant's catalogue says that OPE cannot say back (feature 027, FR-020): of every
// attribute of every product, those of a key OPE writes about whose label the merchant's
// correspondence does not translate. It is the writing side of the report; the reading side excludes
// again, because a label mapped after the last catalogue is no longer a gap.
//
// Nothing here fails: a merchant with no correspondence at all has every label unmapped, which is
// exactly what the report is for, and a catalogue of known labels records nothing.
import { MATERIAL, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { Attribute } from "../../../domain/catalog/index.js";
import type { AttributeLabelReportService } from "../../catalog/index.js";
import type { MessageDirectory } from "../../messages/index.js";
import type { UnmappedValueLog, UnmappedValueSighting } from "../ports/unmapped-value-log.js";

export interface UnmappedValuesDependencies {
  log: UnmappedValueLog;
  directory: MessageDirectory;
}

export class UnmappedValues implements AttributeLabelReportService {
  readonly #deps: UnmappedValuesDependencies;

  constructor(deps: UnmappedValuesDependencies) {
    this.#deps = deps;
  }

  async record(merchantId: MerchantId, attributes: readonly Attribute[], at: Date): Promise<void> {
    const { labels } = await this.#deps.directory.settingsFor(merchantId);
    const products = new Map<string, number>();
    for (const attribute of attributes) {
      // The comparison and not a list, like the type itself: with one key OPE writes about, a list
      // nobody iterates would be a constant with extra steps. An empty value is not a gap either —
      // there is nothing to map and nothing to name in a report.
      if (attribute.key !== MATERIAL || attribute.value === "") continue;
      if (labels.valueOf(attribute.value) !== undefined) continue;
      products.set(attribute.value, (products.get(attribute.value) ?? 0) + 1);
    }
    await this.#deps.log.replace(merchantId, sightings(products), at);
  }
}

const sightings = (products: ReadonlyMap<string, number>): readonly UnmappedValueSighting[] =>
  [...products].map(([label, count]) => ({ label, products: count }));
