// Puerto de reloj: el dominio y los manejadores nunca llaman a `new Date()`; reciben un Clock.
export interface Clock {
  now(): Date;
}
