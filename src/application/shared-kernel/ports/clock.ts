// Clock port: the domain and the handlers never call `new Date()`; they receive a Clock.
export interface Clock {
  now(): Date;
}
