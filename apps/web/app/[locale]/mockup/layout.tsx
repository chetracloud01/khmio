import type { ReactNode } from "react";
import { AdminProvider } from "./admin-context";
import { CartProvider } from "./cart-context";
import { CounterSalesProvider } from "./counter-sales-context";
import { DeliverySettingsProvider } from "./delivery-settings-context";
import { MerchantAccountProvider } from "./merchant-account-context";
import { MerchantInventoryProvider } from "./merchant-inventory-context";
import { MerchantProductsProvider } from "./merchant-products-context";
import { MerchantProfileProvider } from "./merchant-profile-context";
import { MerchantSubscriptionProvider } from "./merchant-subscription-context";
import { OrdersProvider } from "./orders-context";
import { StoreSettingsProvider } from "./store-settings-context";
import { WebsiteProvider } from "./website-context";

// Mock data stores, outermost first. One that reads another must sit inside
// it: store settings read the admin's rate band; the cart reads store and
// delivery settings.
export default function MockupLayout({ children }: { children: ReactNode }) {
  return (
    <MerchantAccountProvider>
      <MerchantProfileProvider>
        <MerchantSubscriptionProvider>
          <MerchantProductsProvider>
            <MerchantInventoryProvider>
              <AdminProvider>
                <StoreSettingsProvider>
                  <DeliverySettingsProvider>
                    <OrdersProvider>
                      <CartProvider>
                        <CounterSalesProvider>
                          <WebsiteProvider>{children}</WebsiteProvider>
                        </CounterSalesProvider>
                      </CartProvider>
                    </OrdersProvider>
                  </DeliverySettingsProvider>
                </StoreSettingsProvider>
              </AdminProvider>
            </MerchantInventoryProvider>
          </MerchantProductsProvider>
        </MerchantSubscriptionProvider>
      </MerchantProfileProvider>
    </MerchantAccountProvider>
  );
}
