// listPlatformConfigurationVersions (feature 036, US4): paging → use case → 200 with the page, newest first.
//
// The level it names and the content of that level are the only things that differ from its twin: the
// translation itself lives once, in the presenters of the module.
import { listingOfLevel } from "../presenters.js";
import type { LevelHistoryReader } from "../../../application/configuration/index.js";
import type { components, OperationHandler } from "../../http/typed.js";

export function makeListPlatformConfigurationVersions(
  list: LevelHistoryReader,
): OperationHandler<"listPlatformConfigurationVersions"> {
  return listingOfLevel<components["schemas"]["PlatformConfigurationContent"]>("platform", list);
}
