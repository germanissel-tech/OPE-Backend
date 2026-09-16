// Eval fixture: a use case that swallows the error of its port instead of resolving NO_OP with a reason.
export interface PriceSource {
  current(productId: string): Promise<number>;
}

export function makeQuotePrice(source: PriceSource): (productId: string) => Promise<number | undefined> {
  return async (productId) => {
    let price: number | undefined;
    try {
      price = await source.current(productId);
      price = Math.max(0, price);
    } catch (err) {}
    return price;
  };
}
