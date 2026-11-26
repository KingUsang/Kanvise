import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  account: { id: "school-1", membershipId: "membership-1", role: "learner" } as any,
  user: { id: "student-1", role: "student", email: "student@example.com", school_id: "school-1" } as any,
}));

vi.mock("../lib/supabase", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, auth: { admin: { updateUserById: mocks.updateUserById } } } }));
vi.mock("../middleware/auth", () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set("user", mocks.user); await next(); },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: "A valid tutoring account must be selected", code: "ACCOUNT_CONTEXT_REQUIRED" }, 400);
    c.set("account", mocks.account);
    await next();
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!mocks.account || !roles.includes(mocks.account.role)) {
      return c.json({ error: "This action is not available for your account membership", code: "INSUFFICIENT_ROLE" }, 403);
    }
    await next();
  },
}));

import { paymentsRouter } from "./payments";

function selectQuery(result: any, eqSpy = vi.fn()) {
  const value: any = {
    select: () => value,
    eq: (...args: any[]) => { eqSpy(...args); return value; },
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
    mocks.account = { id: "school-1", membershipId: "membership-1", role: "learner" };
    vi.stubEnv("FRONTEND_URL", "https://kanvise.com");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_123");
  });

  it("creates a checkout with a clean callback URL and persists Paystack details", async () => {
    let paymentsCall = 0;
    const programmeFilters = vi.fn();
    mocks.from.mockImplementation((table: string) => {
      if (table === "payments") {
        paymentsCall += 1;
        if (paymentsCall === 1) return selectQuery({ data: null, error: null });
        if (paymentsCall === 2) return insertQuery({ data: { id: "payment-1" }, error: null });
        if (paymentsCall === 3) return updateQuery({ error: null });
        return updateQuery({ error: null });
      }
      if (table === "programmes") return selectQuery({ data: { id: "programme-1", name: "Physics", price: 45000, school_id: "school-1", is_published: true }, error: null }, programmeFilters);
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
    expect(programmeFilters).toHaveBeenCalledWith("school_id", "school-1");
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

  it("does not replay an idempotency key for a different target", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "payments") return selectQuery({
        data: {
          id: "payment-1",
          paystack_reference: "PSK-existing",
          paystack_authorization_url: "https://checkout.paystack.com/existing",
          amount: 45000,
          status: "pending",
          programme_id: "programme-other",
          kanvise_fee: 4500,
        },
        error: null,
      });
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await paymentsRouter.request("/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "44444444-4444-4444-8444-444444444444" },
      body: JSON.stringify({ programme_id: "programme-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Checkout is already being initialized",
      code: "PAYMENT_INITIALIZING",
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("does not disclose a target from another active account", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "payments") return selectQuery({ data: null, error: null });
      if (table === "programmes") return selectQuery({ data: null, error: null });
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await paymentsRouter.request("/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "55555555-5555-4555-8555-555555555555" },
      body: JSON.stringify({ programme_id: "programme-foreign" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Target not found", code: "TARGET_NOT_FOUND" });
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it("maps checkout lookup failures to a stable non-disclosing response", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== "payments") throw new Error(`Unexpected table ${table}`);
      const value: any = {
        select: () => value,
        eq: () => value,
        maybeSingle: async () => { throw new Error("private database detail"); },
      };
      return value;
    });

    const response = await paymentsRouter.request("/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "66666666-6666-4666-8666-666666666666" },
      body: JSON.stringify({ programme_id: "programme-1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not initialize payment", code: "CHECKOUT_FAILED" });
  });

  it("does not authorize checkout without an active account context", async () => {
    mocks.account = null;

    const response = await paymentsRouter.request("/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "33333333-3333-4333-8333-333333333333",
      },
      body: JSON.stringify({ programme_id: "programme-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A valid tutoring account must be selected",
      code: "ACCOUNT_CONTEXT_REQUIRED",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an admin-only payment operation for a learner membership", async () => {
    const response = await paymentsRouter.request("/summary");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This action is not available for your account membership",
      code: "INSUFFICIENT_ROLE",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("return-page payment confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account = { id: "school-1", membershipId: "membership-1", role: "learner" };
    mocks.user = { id: "student-1", role: "student", email: "student@example.com", school_id: "school-1" };
  });

  it("confirms without writing app_metadata.school_id (DEV-PAY-006)", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_fake";
    mocks.from.mockReturnValue(selectQuery({ data: { paystack_reference: "ref-1", status: "pending", amount: 100 }, error: null }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: true, data: { status: "success", reference: "ref-1", amount: 10000, id: 77 },
    })));
    mocks.rpc.mockResolvedValue({
      data: { student_auth_id: "auth-1", student_school_id: "school-2", already_processed: false }, error: null,
    });

    const response = await paymentsRouter.request("/status/ref-1/confirm", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "successful", already_confirmed: false } });
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_student_payment", expect.objectContaining({ p_paystack_reference: "ref-1" }));
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
