import "reflect-metadata";
import { EnvError, type ApiEnv } from "@khmio/shared";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getEnv } from "./config";
import { AllErrorsFilter } from "./errors";
import { createLogger, httpLogger } from "./logger";
import { corsOrigin } from "./security/cors";
import { securityHeaders } from "./security/headers";
import { initSentry } from "./sentry";
import type { NestExpressApplication } from "@nestjs/platform-express";

function readSettings(): ApiEnv {
  try {
    return getEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      // Before the logger exists; names the bad settings, never their values.
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

async function bootstrap() {
  const env = readSettings();
  const logger = createLogger(env.LOG_LEVEL);
  initSentry(env.SENTRY_DSN, env.NODE_ENV);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  // The buyer's real address behind Railway/Cloudflare, for rate limits (count the proxies: TRUST_PROXY_HOPS).
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.disable("x-powered-by");
  app.use(securityHeaders(env.NODE_ENV === "production"));
  app.use(httpLogger(logger));
  app.useGlobalFilters(new AllErrorsFilter(logger));
  // Only the web app may call the API from a browser (security/cors.ts).
  app.enableCors({ origin: corsOrigin(env), credentials: true });
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "API listening");
}

void bootstrap();
