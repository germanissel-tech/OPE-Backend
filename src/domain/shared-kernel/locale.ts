// The shape of a BCP 47 language tag (`es-AR`, `en`); the contract publishes the same pattern. It lives in
// the kernel since feature 038 because the configuration (the languages a store serves) and the texts (the
// language a text is written in) share it and cannot depend on each other.
export const LOCALE_PATTERN = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;
