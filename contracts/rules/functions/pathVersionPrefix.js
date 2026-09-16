// ope-path-version-prefix (FR-003): todo path empieza con /v{major} donde major es el de info.version.
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
        message: `info.version debe ser semver MAJOR.MINOR.PATCH; es '${version}'.`,
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
        message: `El path ${route} no lleva el prefijo ${prefix} que corresponde a info.version ${version}. Un cambio de major cambia el prefijo.`,
        path: [...context.path, "paths", route],
      });
    }
  }
  return results;
};

module.exports = pathVersionPrefix;
