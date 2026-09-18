// The one contract every use case implements (ADR-023): what changes per call is the request;
// what the use case needs to operate arrives once, through its constructor, as an object of
// interfaces (`*Dependencies`). A use case never invokes another use case.
export interface UseCase<Request, Response> {
  execute(request: Request): Promise<Response>;
}
