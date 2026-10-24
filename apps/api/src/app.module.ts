import { Module } from "@nestjs/common";
import { AdminAuthController } from "./admin/admin-auth.controller";
import { AdminController } from "./admin/admin.controller";
import { AdminGuard } from "./admin/admin.guard";
import { AuthController } from "./auth/auth.controller";
import { SessionGuard } from "./auth/session.guard";
import { CatalogController } from "./catalog/catalog.controller";
import { CounterController } from "./counter/counter.controller";
import { DbShutdown, dbProviders } from "./db";
import { DeliveryController } from "./delivery/delivery.controller";
import { FilesController } from "./files/files.controller";
import { fileStorageProvider } from "./files/storage";
import { HealthController } from "./health/health.controller";
import { MerchantStoreGuard } from "./merchant/store.guard";
import { OrdersController } from "./orders/orders.controller";
import { ProductsController } from "./products/products.controller";
import { PublicController } from "./public/public.controller";
import { rateLimiterProvider } from "./security/rate-limit";
import { StoreController } from "./store/store.controller";
import { StoresController } from "./stores/stores.controller";
import { WaitlistController } from "./website/waitlist.controller";

@Module({
  controllers: [
    HealthController,
    AuthController,
    StoresController,
    StoreController,
    CatalogController,
    ProductsController,
    DeliveryController,
    OrdersController,
    CounterController,
    AdminAuthController,
    AdminController,
    FilesController,
    PublicController,
    WaitlistController,
  ],
  providers: [...dbProviders, DbShutdown, fileStorageProvider, rateLimiterProvider, SessionGuard, MerchantStoreGuard, AdminGuard],
})
export class AppModule {}
