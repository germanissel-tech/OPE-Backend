// What an experiment records when a corrective version restarts its accumulation window (features 036 and
// 038): plain data, so the experiment module needs nothing of `configuration` or `messages` to keep it, and
// what a reading of the history asks to find which version restarted which window (feature 042).
import type { ConfigurationLevel } from "../shared-kernel/index.js";

/** A restart of the accumulation window: a corrective configuration version while active. */
export interface WindowRestart {
  at: Date;
  reason: string;
  /**
   * Which level the version that caused the restart belongs to (feature 036): **without it the number
   * identifies nothing**, because three levels publish and «version 3» would name three different things.
   */
  level: ConfigurationLevel;
  configurationVersion: number;
  /** The text that caused it (feature 038): then the number is the version of this key in this layer. Absent before. */
  text?: TextRestartCause | undefined;
}

/** The key and the layer of a text that restarted a window: plain data, so this module needs nothing of `messages`. */
export interface TextRestartCause {
  family: string;
  attributeValue?: string | undefined;
  locale: string;
  /** Whose layer the version belongs to: `base`, or the merchant. */
  layer: string;
}

/** What a restart records of its cause: the version of a level, or of a text in a layer. */
export interface RestartSource {
  level: ConfigurationLevel;
  configurationVersion: number;
  text?: TextRestartCause | undefined;
}
