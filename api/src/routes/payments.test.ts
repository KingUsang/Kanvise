import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: "student-1", role: "student", email: "student@example.com", school_id: "school-1" } as any,
}));

vi.mock("../lib/supabase", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("../middleware/auth", () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set("user", mocks.user); await next(); },
}));

import { paymentsRouter } from "./payments";

function selectQuery(result: any) {
  const value: any = {
    select: () => value,
    eq: () => value,
    order: () => value,
    limit: () => value,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  };
  return value;
}

function insertQuery(result: any) {
  const value: any = {
    insert: () => value,
    select: () => value,
    single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  };
  return value;
}

function updateQuery(result: any) {
  const value: any = {
    update: () => value,
    eq: () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  };
  return value;
}

describe("POST /payments/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FRONTEND_URL", "https://kanvise.com");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_123");
  });

  it("creates a checkout with a clean callback URL and persists Paystack details", async () => {
    let paymentsCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "payments") {
        paymentsCall += 1;
        if (paymentsCall === 1) return selectQuery({ data: null, error: null });
        if (paymentsCall === 2) return insertQuery({ data: { id: "payment-1" }, error: null });
        if (paymentsCall === 3) return updateQuery({ error: null });
        return updateQuery({ error: null });
      }
      if (table === "programmes") return selectQuery({ data: { id: "programme-1", name: "Physics", price: 45000, school_id: "school-1", is_published: true }, error: null });
      if (table === "paystack_subaccounts") return selectQuery({ data: { subaccount_code: "ACCT_TEST", percentage_charge: 10 }, error: null });
      if (table === "enrolments") return selectQuery({ data: null, error: null });
      throw new Error(`Unexpected table ${table}`);
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: true,
      data: { authorization_url: "https://checkout.paystack.com/session", access_code: "access-123" },
    }), { status: 200 }));

    const response = await paymentsRouter.request("/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
      },
      body: JSON.stringify({ programme_id: "programme-1" }),
    });

    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.data.payment_url).toBe("https://checkout.paystack.com/session");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/initialize",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"callback_url\":\"https://kanvise.com/payment/return\""),
      }),
    );
    expect(mocks.from).toHaveBeenCalledWith("payments");
    expect(mocks.from).toHaveBeenCalledWith("programmes");
    expect(mocks.from).toHaveBeenCalledWith("paystack_subaccounts");
  });

  it("enrols a student immediately when a programme is free", async () => {
    let paymentsCall = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "payments") {
        paymentsCall += 1;
        if (paymentsCall === 1) return selectQuery({ data: null, error: null });
        return insertQuery({ data: { id: "free-payment-1" }, error: null });
      }
      if (table === "programmes") return selectQuery({ data: { id: "programme-1", name: "Free Physics", price: 0, school_id: "school-1", is_published: true }, error: null });
      if (table === "enrolments") return selectQuery({ data: null, error: null });
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.rpc.mockResolvedValue({ data: { enrolment_id: "enrolment-1" }, error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await paymentsRouter.request("/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "22222222-2222-4222-8222-222222222222" },
      body: JSON.stringify({ programme_id: "programme-1" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ data: { free: true, enrolment_id: "enrolment-1", amount: 0 } });
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_student_payment", expect.objectContaining({ p_amount_kobo: 0 }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
