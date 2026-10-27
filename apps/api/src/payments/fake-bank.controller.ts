import { fakeBankPaymentSchema, KHQR_REF_PATTERN, type FakeBankAnswer } from "@khmio/payments";
import { toFieldErrors } from "@khmio/shared";
import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from "@nestjs/common";
import { getEnv } from "../config";
import { InvalidInputException } from "../errors";

/**
 * The stand-in bank for KHQR_PROVIDER=fake (local work and the end-to-end
 * checks): "pay (test)" on the order page pays a code here, and the worker
 * asks here whether it was paid, as it will ask Bakong. Kept in memory: a
 * restart forgets every payment. Not there at all in production, or when
 * KHQR isn't fake.
 */
@Controller("dev/fake-bank")
export class FakeBankController {
  private readonly payments = new Map<string, FakeBankAnswer>();

  private open(ref: string): void {
    const env = getEnv();
    if (env.NODE_ENV === "production" || env.KHQR_PROVIDER !== "fake" || !KHQR_REF_PATTERN.test(ref)) throw new NotFoundException();
  }

  @Get(":ref")
  status(@Param("ref") ref: string): FakeBankAnswer {
    this.open(ref);
    return this.payments.get(ref) ?? { paid: false };
  }

  @Post(":ref/pay")
  @HttpCode(200)
  pay(@Param("ref") ref: string, @Body() body: unknown): FakeBankAnswer {
    this.open(ref);
    const parsed = fakeBankPaymentSchema.safeParse(body);
    if (!parsed.success) throw new InvalidInputException(toFieldErrors(parsed.error));
    const answer: FakeBankAnswer = { paid: true, ...parsed.data };
    this.payments.set(ref, answer);
    return answer;
  }
}
