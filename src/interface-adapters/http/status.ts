// The HTTP status codes src/ answers with, named once (audit 014 F-013). The generated operation
// types check each controller's status as a literal, so the object keeps them literal (`as const`);
// the catalogue of problems reads its statuses from here as well.
const OK = 200;
const CREATED = 201;
const ACCEPTED = 202;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const CONFLICT = 409;
const PAYLOAD_TOO_LARGE = 413;
const UNPROCESSABLE_CONTENT = 422;
const INTERNAL_ERROR = 500;
const NOT_IMPLEMENTED = 501;
const SERVICE_UNAVAILABLE = 503;

export const HTTP_STATUS = {
  OK,
  CREATED,
  ACCEPTED,
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  METHOD_NOT_ALLOWED,
  CONFLICT,
  PAYLOAD_TOO_LARGE,
  UNPROCESSABLE_CONTENT,
  INTERNAL_ERROR,
  NOT_IMPLEMENTED,
  SERVICE_UNAVAILABLE,
} as const;
