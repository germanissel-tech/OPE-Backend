// What the application and the process lifecycle need from a logger: structured fields and a
// message, three levels. Which library writes them, where and in what format is a gateway's
// business (pino in infrastructure today).
export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
}
