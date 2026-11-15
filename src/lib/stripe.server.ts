// Minimal Stripe REST client (fetch-based, works on edge runtimes). Server-only.
export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super("Card payments are not set up yet. Please try again later.");
  }
}

type Params = Record<string, unknown>;

function encode(params: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") encode(item as Params, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === "object") {
      encode(v as Params, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

async function stripe<T>(method: "GET" | "POST", path: string, params?: Params, idempotencyKey?: string): Promise<T> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new PaymentsNotConfiguredError();
  const body = params ? encode(params).toString() : undefined;
  const url = method === "GET" && body ? `https://api.stripe.com/v1${path}?${body}` : `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const init: RequestInit = { method, headers };
  if (method === "POST" && body !== undefined) init.body = body;
  const res = await fetch(url, init);
  const json = (await res.json()) as T & { error?: { message?: string; code?: string } };
  if (!res.ok) {
    console.error(`[stripe] ${method} ${path} failed [${res.status}]`, json.error);
    const err = new Error(json.error?.message ?? `Stripe request failed (${res.status})`) as Error & { code?: string | undefined };
    err.code = json.error?.code;
    throw err;
  }
  return json;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_intent: string | { id: string; status: string } | null;
}

export function createCheckoutSession(params: Params, idempotencyKey: string) {
  return stripe<CheckoutSession>("POST", "/checkout/sessions", params, idempotencyKey);
}

export function retrieveCheckoutSession(id: string) {
  return stripe<CheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, {
    expand: ["payment_intent"],
  });
}

export function capturePaymentIntent(id: string) {
  return stripe<{ id: string; status: string }>(
    "POST",
    `/payment_intents/${encodeURIComponent(id)}/capture`,
    {},
    `capture-${id}`,
  );
}

export async function cancelPaymentIntent(id: string) {
  try {
    return await stripe<{ id: string; status: string }>(
      "POST",
      `/payment_intents/${encodeURIComponent(id)}/cancel`,
      {},
      `cancel-${id}`,
    );
  } catch (e) {
    // Already canceled / expired authorizations are fine: nobody is charged.
    const code = (e as { code?: string }).code;
    if (code === "payment_intent_unexpected_state") return null;
    throw e;
  }
}
