// The composition graph (ADR-033): what a module of composition uses to declare its components,
// bind them, expose services, serve operations, and what a deployment uses to compose the lot.
export { bind, bindAll, type Binding } from "./binding.js";
export {
  deployment,
  instantiate,
  replace,
  type Deployment,
  type Instance,
  type Missing,
  type Override,
  type Unwired,
  type Wired,
} from "./compose.js";
export {
  compositionModule,
  handler,
  uses,
  type ChooseATechnology,
  type CompositionModule,
  type Deployed,
  type HandlerRecipe,
  type Recipe,
  type Serves,
  type TechnologiesDisagree,
} from "./module.js";
export { port, type AnyPort, type Closable, type Label, type Port, type Served } from "./port.js";
