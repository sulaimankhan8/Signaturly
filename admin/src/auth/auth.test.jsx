import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { adminApi } from "../api/admin.api.js";
import RequireAdmin, { useAdmin } from "./AdminAuth.jsx";
import { getToken, startSession, endSession, takeNote } from "./session.js";
import PlanDialog, { planGrantPayload } from "../components/PlanDialog.jsx";

// Plan tasks AD-13, AD-14 and AD-22.

// A token shaped like the server's, expiring `seconds` from now
const tokenFor = (seconds) => {
  const part = (value) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  return `${part({ alg: "HS256" })}.${part({ id: "a1", isAdmin: true, exp: Math.floor(Date.now() / 1000) + seconds })}.signature`;
};

const PLANS = [
  { id: "free", name: "Free", documentsPerMonth: 5, priceInr: 0, interval: null, perSeat: false, purchasable: false },
  { id: "pro_monthly", name: "Pro", documentsPerMonth: 50, priceInr: 299, interval: "month", perSeat: false, purchasable: true },
  { id: "business_monthly", name: "Business", documentsPerMonth: 100, priceInr: 499, interval: "month", perSeat: true, purchasable: true },
  { id: "lifetime", name: "Lifetime", documentsPerMonth: null, priceInr: null, interval: null, perSeat: false, purchasable: false, legacy: true },
];
const META = { admin: { id: "a1", name: "Site Admin", email: "ops@pactdoc.com", role: "superadmin" }, plans: PLANS, documentStatuses: [], auditEvents: [], paymentKinds: [], jobStatuses: [] };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("the admin session", () => {
  it("is kept for the tab, and is gone the moment it runs out", () => {
    startSession(tokenFor(3600));
    expect(getToken()).toBeTruthy();

    startSession(tokenFor(-10));
    expect(getToken()).toBeNull();
  });

  it("leaves a note for the sign-in page when it ends by itself, and none when the admin signs out", () => {
    startSession(tokenFor(3600));
    endSession("ended");
    expect(takeNote()).toBe("Your session has ended. Sign in again.");
    expect(takeNote()).toBeNull();

    startSession(tokenFor(3600));
    endSession("signed_out");
    expect(takeNote()).toBeNull();
  });

  it("ends when the server refuses the token, on any screen", async () => {
    startSession(tokenFor(3600));
    const refused = { response: { status: 401, data: { error: "ADMIN_AUTH_INVALID: Invalid or expired admin token" } }, config: { url: "/admin/users" } };
    await expect(adminApi.interceptors.response.handlers[0].rejected(refused)).rejects.toBe(refused);
    expect(getToken()).toBeNull();
  });

  it("does not end because a sign-in was refused, or because a request simply failed", async () => {
    startSession(tokenFor(3600));
    const wrongPassword = { response: { status: 401, data: { error: "Invalid admin credentials." } }, config: { url: "/admin/login" } };
    const serverDown = { config: { url: "/admin/users" } };
    const notAllowed = { response: { status: 403, data: { error: "AUDIT_MUTATION_DENIED: no" } }, config: { url: "/admin/audit-logs" } };
    for (const error of [wrongPassword, serverDown, notAllowed]) {
      await expect(adminApi.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error);
    }
    expect(getToken()).toBeTruthy();
  });
});

const Screen = () => {
  const admin = useAdmin();
  return <p>Signed in as {admin.admin.email}; a seat of Business is {admin.planName("business_monthly")}</p>;
};
const SignIn = () => <p>The sign-in page, asked for from {useLocation().state?.from}</p>;

const guarded = () =>
  render(
    <MemoryRouter initialEntries={["/users?plan=pro_monthly"]}>
      <Routes>
        <Route path="/login" element={<SignIn />} />
        <Route element={<RequireAdmin />}>
          <Route path="/users" element={<Screen />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("the guard on every screen", () => {
  it("sends someone who is not signed in to the sign-in page, remembering where they were going", () => {
    const get = vi.spyOn(adminApi, "get");
    guarded();
    expect(screen.getByText("The sign-in page, asked for from /users?plan=pro_monthly")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("shows the screen to an admin, with who they are and the plans as the server names them", async () => {
    startSession(tokenFor(3600));
    vi.spyOn(adminApi, "get").mockResolvedValue({ data: { data: META } });
    guarded();
    expect(await screen.findByText("Signed in as ops@pactdoc.com; a seat of Business is Business")).toBeInTheDocument();
  });

  it("returns to the sign-in page when the session ends", async () => {
    startSession(tokenFor(3600));
    vi.spyOn(adminApi, "get").mockResolvedValue({ data: { data: META } });
    guarded();
    await screen.findByText(/Signed in as/);

    act(() => endSession("ended"));
    expect(await screen.findByText(/The sign-in page/)).toBeInTheDocument();
  });

  it("says the server cannot be reached, and does not call it a refusal", async () => {
    startSession(tokenFor(3600));
    vi.spyOn(adminApi, "get").mockRejectedValue({ config: { url: "/admin/meta" } });
    guarded();
    expect(await screen.findByRole("alert")).toHaveTextContent("The server cannot be reached.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(getToken()).toBeTruthy();
  });
});

describe("changing a plan", () => {
  const blank = { plan: "pro_monthly", custom: false, customQuota: "", seats: "1", days: "", reason: " Pilot customer " };
  const plan = (id) => PLANS.find((p) => p.id === id);

  it("sends no allowance unless a custom one was asked for", () => {
    expect(planGrantPayload(blank, plan("pro_monthly"))).toEqual({ plan: "pro_monthly", reason: "Pilot customer" });
    // A number left in the box does nothing while the box is unticked
    expect(planGrantPayload({ ...blank, customQuota: "5" }, plan("pro_monthly"))).toEqual({ plan: "pro_monthly", reason: "Pilot customer" });
    expect(planGrantPayload({ ...blank, custom: true, customQuota: "500" }, plan("pro_monthly"))).toMatchObject({ customQuota: 500 });
  });

  it("sends days only for a plan that ends, and seats only for a plan sold by the seat", () => {
    expect(planGrantPayload({ ...blank, days: "90" }, plan("pro_monthly"))).toMatchObject({ days: 90 });
    expect(planGrantPayload({ ...blank, days: "90" }, plan("lifetime"))).not.toHaveProperty("days");
    expect(planGrantPayload({ ...blank, days: "90" }, plan("free"))).not.toHaveProperty("days");
    expect(planGrantPayload({ ...blank, seats: "4" }, plan("business_monthly"))).toMatchObject({ seats: 4 });
    expect(planGrantPayload({ ...blank, seats: "4" }, plan("pro_monthly"))).not.toHaveProperty("seats");
  });

  const open = (onSaved = () => {}) =>
    render(<PlanDialog open user={{ id: "u1", name: "Asha Rao", email: "asha@example.test" }} subscription={{ plan: "free", monthlyQuota: 5, seats: 1 }} plans={PLANS} onClose={() => {}} onSaved={onSaved} />);

  it("says what the account will get before anything is saved", async () => {
    const user = userEvent.setup();
    open();
    const dialog = screen.getByRole("dialog", { name: "Change plan" });
    expect(dialog).toHaveTextContent("This plan gives 50 documents a month.");

    await user.selectOptions(screen.getByLabelText("Plan"), "business_monthly");
    await user.clear(screen.getByLabelText("Seats"));
    await user.type(screen.getByLabelText("Seats"), "3");
    expect(dialog).toHaveTextContent("This plan gives 300 documents a month (100 a seat).");
  });

  it("does not save without a reason", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(adminApi, "patch");
    open();

    await user.click(screen.getByRole("button", { name: "Change plan" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Say why the plan is being changed.");
    expect(patch).not.toHaveBeenCalled();
  });

  it("saves the plan with its reason, and nothing about the allowance the account had", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(adminApi, "patch").mockResolvedValue({ data: { message: "Plan changed to Pro" } });
    const onSaved = vi.fn();
    open(onSaved);

    await user.type(screen.getByLabelText("Reason"), "Agreed by email");
    await user.click(screen.getByRole("button", { name: "Change plan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Plan changed to Pro"));
    expect(patch).toHaveBeenCalledWith("/admin/users/u1/plan", { plan: "pro_monthly", reason: "Agreed by email" });
  });
});
