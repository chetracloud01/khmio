"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  mockBrands,
  mockCategories,
  mockProducts,
  mockUoms,
  type MockBrand,
  type MockCategory,
  type MockProduct,
  type MockUom,
} from "@/mock/mock-data";

interface MerchantProductsContextValue {
  /** False until saved data has been read — forms must wait for this before copying values into their own state. */
  hydrated: boolean;
  products: MockProduct[];
  setProducts: Dispatch<SetStateAction<MockProduct[]>>;
  addProduct: (product: MockProduct) => void;
  updateProduct: (product: MockProduct) => void;
  removeProduct: (id: string) => void;
  categories: MockCategory[];
  addCategory: (category: MockCategory) => void;
  brands: MockBrand[];
  addBrand: (brand: MockBrand) => void;
  uoms: MockUom[];
  addUom: (uom: MockUom) => void;
  /** A seller who just onboarded starts empty: no products or brands, only their business type's categories and unit. */
  startNewShop: (defaults: { categories: MockCategory[]; uoms: MockUom[] }) => void;
}

const MerchantProductsContext = createContext<MerchantProductsContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const PRODUCTS_STORAGE_KEY = "khmio:mockup-merchant-products";
const CATEGORIES_STORAGE_KEY = "khmio:mockup-merchant-categories";
const BRANDS_STORAGE_KEY = "khmio:mockup-merchant-brands";
const UOMS_STORAGE_KEY = "khmio:mockup-merchant-uoms";

export function MerchantProductsProvider({ children }: { children: ReactNode }) {
  // Starts from the catalog mock data so server and client render the same
  // list before hydration reads whatever was saved locally.
  const [products, setProducts] = useState<MockProduct[]>(mockProducts);
  const [categories, setCategories] = useState<MockCategory[]>(mockCategories);
  const [brands, setBrands] = useState<MockBrand[]>(mockBrands);
  const [uoms, setUoms] = useState<MockUom[]>(mockUoms);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawProducts = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (rawProducts) setProducts(JSON.parse(rawProducts) as MockProduct[]);
      const rawCategories = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (rawCategories) setCategories(JSON.parse(rawCategories) as MockCategory[]);
      const rawBrands = window.localStorage.getItem(BRANDS_STORAGE_KEY);
      if (rawBrands) setBrands(JSON.parse(rawBrands) as MockBrand[]);
      const rawUoms = window.localStorage.getItem(UOMS_STORAGE_KEY);
      if (rawUoms) setUoms(JSON.parse(rawUoms) as MockUom[]);
    } catch {
      // Corrupt or inaccessible storage (e.g. private browsing) — keep the catalog defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [products, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [categories, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(BRANDS_STORAGE_KEY, JSON.stringify(brands));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [brands, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(UOMS_STORAGE_KEY, JSON.stringify(uoms));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [uoms, hydrated]);

  function addProduct(product: MockProduct) {
    setProducts((prev) => [product, ...prev]);
  }

  function updateProduct(product: MockProduct) {
    setProducts((prev) => prev.map((existing) => (existing.id === product.id ? product : existing)));
  }

  function removeProduct(id: string) {
    setProducts((prev) => prev.filter((existing) => existing.id !== id));
  }

  function addCategory(category: MockCategory) {
    setCategories((prev) => [...prev, category]);
  }

  function addBrand(brand: MockBrand) {
    setBrands((prev) => [...prev, brand]);
  }

  function addUom(uom: MockUom) {
    setUoms((prev) => [...prev, uom]);
  }

  function startNewShop(defaults: { categories: MockCategory[]; uoms: MockUom[] }) {
    setProducts([]);
    setBrands([]);
    setCategories(defaults.categories);
    setUoms(defaults.uoms);
  }

  return (
    <MerchantProductsContext.Provider
      value={{
        hydrated,
        products,
        setProducts,
        addProduct,
        updateProduct,
        removeProduct,
        categories,
        addCategory,
        brands,
        addBrand,
        uoms,
        addUom,
        startNewShop,
      }}
    >
      {children}
    </MerchantProductsContext.Provider>
  );
}

export function useMerchantProducts(): MerchantProductsContextValue {
  const ctx = useContext(MerchantProductsContext);
  if (!ctx) throw new Error("useMerchantProducts must be used within a MerchantProductsProvider");
  return ctx;
}
