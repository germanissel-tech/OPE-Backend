// ope-path-version-prefix (FR-003): todo path empieza con /v{major} donde major es el de info.version.
"use strict";

module.exports = (document, _opts, context) => {
  const version = document && document.info ? String(document.info.version || "") : "";
  const major = version.split(".")[0];
  if (!/^\d+$/.test(major)) {
    return [
      {
        message: `info.version debe ser semver MAJOR.MINOR.PATCH; es '${version}'.`,
        path: [...context.path, "info", "version"],
      },
    ];
  }
  const prefix = `/v${major}/`;
  const results = [];
  for (const route of Object.keys((document && document.paths) || {})) {
    if (!route.startsWith(prefix)) {
      results.push({
        message: `El path ${route} no lleva el prefijo ${prefix} que corresponde a info.version ${version}. Un cambio de major cambia el prefijo.`,
        path: [...context.path, "paths", route],
      });
    }
  }
  return results;
};
