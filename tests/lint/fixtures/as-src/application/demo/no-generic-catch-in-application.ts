// Lint fixture (as if under src/application/): violates only ope/no-generic-catch-in-application.
// A catch in the application ring swallows what should propagate.
export async function guarded(run: () => Promise<number>): Promise<number> {
  try {
    return await run();
  } catch (err: unknown) {
    return err instanceof Error ? -1 : 0;
  }
}
