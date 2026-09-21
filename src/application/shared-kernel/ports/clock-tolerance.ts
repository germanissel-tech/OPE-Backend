// The tolerance of the platform clock (level 1 of the configuration, constitution XI): how far
// into the future an instant a client declares may sit (the skew), and how far into the past an
// event may arrive (late uploads). Read once from the release; every module that judges an
// instant against the clock receives it through this port.
export interface ClockTolerance {
  /** Milliseconds an instant may sit ahead of the server clock. */
  skewMs(): number;
  /** Milliseconds an event instant may sit behind the server clock. */
  eventPastMs(): number;
}
