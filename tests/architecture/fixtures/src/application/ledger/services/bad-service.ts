// Violation (services-no-use-cases): a service importing a use case.
import { RecordUseCase } from "../use-cases/record.use-case.js";

export const badService = { run: () => new RecordUseCase().execute() };
