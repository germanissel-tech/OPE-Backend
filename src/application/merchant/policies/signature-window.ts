// How far a platform signature's timestamp may sit from the server clock, either way (ADR-029).
import { minutes } from "../../../domain/shared-kernel/index.js";

const SIGNATURE_WINDOW_MINUTES = 5;
export const SIGNATURE_WINDOW_MS = minutes(SIGNATURE_WINDOW_MINUTES);
