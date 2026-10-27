import { SITE_PAGES, SITE_PICTURES, SITE_PRODUCTS, type SitePicture } from "@/site/content";

// The website mockups start from the live website's content (site/content.ts),
// under the names the mockup screens already use. The admin mockups (A10–A12)
// then change their own copy, kept on this device.

export const mockPlatformProducts = SITE_PRODUCTS;
export const mockPictures = SITE_PICTURES;
export type MockPicture = SitePicture;
export const mockHomePage = SITE_PAGES.home;
export const mockShopPage = SITE_PAGES.shop;
export const mockPricingPage = SITE_PAGES.pricing;
export const mockComingSoonPages = { class: SITE_PAGES.class, rent: SITE_PAGES.rent };
