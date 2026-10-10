// ope-when-missing (feature 043; ADR-046): a parameter that declares `x-when-missing` names the problem of the
// catalogue its absence answers with, and only a required parameter can be missing in a way that deserves
// one. The server reads the extension when the validator refuses a request (`validationFail`), so a slug that
// is not in the catalogue, or an optional parameter carrying it, would be a rule the server cannot keep.
"use strict";
const { loadCatalog } = require("./_catalog.js");
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

const EXTENSION = "x-when-missing";

/** @type {SpectralFunction} */
const whenMissing = (parameter, options, context) => {
  if (!isObject(parameter) || !(EXTENSION in parameter)) return [];
  const name = String(get(parameter, "name"));
  const slug = parameter[EXTENSION];
  /** @type {SpectralResult[]} */
  const results = [];
  const at = [...context.path, EXTENSION];
  if (parameter["required"] !== true) {
    results.push({
      message: `Parameter ${name} declares ${EXTENSION} but is not required: an optional parameter is never missing (ADR-046).`,
      path: at,
    });
  }
  const catalog = loadCatalog(context, get(options, "catalog"));
  if (typeof slug !== "string" || !catalog.types.has(slug)) {
    results.push({
      message: `Parameter ${name} declares ${EXTENSION}: ${String(slug)}, which is not a type of the catalogue.`,
      path: at,
    });
  }
  return results;
};

module.exports = whenMissing;
