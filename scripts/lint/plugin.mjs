// The `ope` ESLint plugin: the repository's own type-aware rules (ADR-016, ADR-023). Each rule
// lives in its own file with its reason on top; every rule has a fixture under
// tests/lint/fixtures/ that violates it and a test that expects the violation.
import dependenciesAreInterfaces from "./dependencies-are-interfaces.mjs";
import domainErrorShape from "./domain-error-shape.mjs";
import noGenericCatchInApplication from "./no-generic-catch-in-application.mjs";
import noMagicStrings from "./no-magic-strings.mjs";
import noThrowDomainError from "./no-throw-domain-error.mjs";
import useCaseShape from "./use-case-shape.mjs";

export default {
  rules: {
    "no-magic-strings": noMagicStrings,
    "use-case-shape": useCaseShape,
    "dependencies-are-interfaces": dependenciesAreInterfaces,
    "domain-error-shape": domainErrorShape,
    "no-throw-domain-error": noThrowDomainError,
    "no-generic-catch-in-application": noGenericCatchInApplication,
  },
};
