// ope-path-version-prefix (FR-003): every path starts with /v{major} where major is the one of info.version.
"use strict";
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

/** @type {SpectralFunction} */
const pathVersionPrefix = (document, _opts, context) => {
  const version = String(get(get(document, "info"), "version") ?? "");
  const major = version.split(".")[0] ?? "";
  if (!/^\d+$/.test(major)) {
    return [
      {
        message: `info.version must be semver MAJOR.MINOR.PATCH; it is '${version}'.`,
        path: [...context.path, "info", "version"],
      },
    ];
  }
  const prefix = `/v${major}/`;
  /** @type {SpectralResult[]} */
  const results = [];
  const paths = get(document, "paths");
  for (const route of Object.keys(isObject(paths) ? paths : {})) {
    if (!route.startsWith(prefix)) {
      results.push({
        message: `Path ${route} does not carry the ${prefix} prefix that corresponds to info.version ${version}. A major change changes the prefix.`,
        path: [...context.path, "paths", route],
      });
    }
  }
  return results;
};

module.exports = pathVersionPrefix;
