import { useCallback, useMemo, useState } from "react";
import {
  clearStoredProducts,
  defaultProducts,
  productsToCards,
  readStoredProducts,
  writeStoredProducts,
  type Product,
} from "./catalog";

type Source = "storage" | "builtin";

type CatalogState = {
  products: Product[];
  source: Source;
};

function initialState(): CatalogState {
  const stored = readStoredProducts();
  if (stored) return { products: stored, source: "storage" };
  return { products: defaultProducts(), source: "builtin" };
}

export function useCatalog() {
  const [state, setState] = useState(initialState);
  const cards = useMemo(() => productsToCards(state.products), [state.products]);

  const save = useCallback((products: Product[]) => {
    writeStoredProducts(products);
    setState({ products, source: "storage" });
  }, []);

  const reset = useCallback(() => {
    clearStoredProducts();
    const products = defaultProducts();
    setState({ products, source: "builtin" });
    return products;
  }, []);

  return {
    products: state.products,
    cards,
    saved: state.source === "storage",
    save,
    reset,
  };
}
