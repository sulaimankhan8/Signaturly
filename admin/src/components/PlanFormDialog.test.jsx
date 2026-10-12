import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adminApi } from "../api/admin.api.js";
import PlanFormDialog, { planCreatePayload, planEditPayload } from "./PlanFormDialog.jsx";

// Changing and adding plans from the admin app.

const gives = (ownTemplates, bulkSend, api, workspaces) => ({ "templates.own": ownTemplates, bulkSend, api, workspaces });
const TIERS = [
  { id: "free", name: "Free", features: gives(false, false, false, false), limits: { bulkSendMax: 0 } },
  { id: "pro", name: "Pro", features: gives(true, true, false, false), limits: { bulkSendMax: 25 } },
  { id: "business", name: "Business", features: gives(true, true, false, true), limits: { bulkSendMax: 500 } },
  { id: "enterprise", name: "Enterprise", features: gives(true, true, true, true), limits: { bulkSendMax: 5000 } },
];
const FEATURES = [
  { id: "templates.own", label: "Saving your own templates" },
  { id: "bulkSend", label: "Bulk send" },
  { id: "api", label: "API keys and webhooks" },
  { id: "workspaces", label: "Team workspaces" },
];

const ALL = ["name", "tier", "interval", "perSeat", "documentsPerMonth", "priceInr", "priceIsFrom", "purchasable", "legacy", "features", "limits", "sellSubscription", "sellPrepaid"];
const PRO = { id: "pro_monthly", name: "Pro", tier: "pro", documentsPerMonth: 50, priceInr: 299, priceIsFrom: false, interval: "month", perSeat: false, purchasable: true, legacy: false, sellSubscription: true, sellPrepaid: true, features: TIERS[1].features, limits: TIERS[1].limits, accounts: 12, canChange: ALL };
const FREE = { id: "free", name: "Free", tier: "free", documentsPerMonth: 5, priceInr: 0, priceIsFrom: false, interval: null, perSeat: false, purchasable: false, legacy: false, features: TIERS[0].features, limits: TIERS[0].limits, accounts: 40, canChange: ["name", "documentsPerMonth", "features", "limits"] };

const form = (extra = {}) => ({ id: "", name: "Pro", tagline: "", highlight: false, yearlyPriceInr: "", yearlyOnSale: true, tier: "pro", interval: "month", perSeat: false, priceInr: "299", priceIsFrom: false, documentsPerMonth: "50", noLimit: false, purchasable: true, legacy: false, sellSubscription: true, sellPrepaid: true, features: { ...TIERS[1].features }, bulkSendMax: "25", ...extra });

const dialog = (plan, extra = {}) => render(<PlanFormDialog open plan={plan} tiers={TIERS} features={FEATURES} onClose={() => {}} onSaved={() => {}} {...extra} />);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("what is sent for a plan", () => {
  it("is only what was changed", () => {
    expect(planEditPayload(form(), PRO)).toEqual({});
    expect(planEditPayload(form({ priceInr: "349" }), PRO)).toEqual({ priceInr: 349 });
    expect(planEditPayload(form({ name: " Pro Plus ", noLimit: true, interval: "year" }), PRO)).toEqual({ name: "Pro Plus", interval: "year", documentsPerMonth: null });
  });

  it("carries a feature switched on or off, and the limit on bulk send only for a plan that has it", () => {
    expect(planEditPayload(form({ features: gives(true, true, true, false) }), PRO)).toEqual({ features: gives(true, true, true, false) });
    expect(planEditPayload(form({ bulkSendMax: "60" }), PRO)).toEqual({ limits: { bulkSendMax: 60 } });
    expect(planEditPayload(form({ features: gives(true, false, false, false), bulkSendMax: "60" }), PRO)).toEqual({ features: gives(true, false, false, false) });
  });

  it("sends the features with a new level, even when they are as they were", () => {
    const sent = planEditPayload(form({ tier: "business" }), PRO);
    expect(sent).toEqual({ tier: "business", features: TIERS[1].features, limits: { bulkSendMax: 25 } });
  });

  it("carries how the plan is sold when that is changed", () => {
    expect(planEditPayload(form({ sellPrepaid: false }), PRO)).toEqual({ sellPrepaid: false });
  });

  it("takes a retired plan off sale", () => {
    expect(planEditPayload(form({ legacy: true }), PRO)).toEqual({ purchasable: false, legacy: true });
  });

  it("never sends what may not be changed on the plan", () => {
    const sent = planEditPayload(form({ name: "Starter", tier: "pro", documentsPerMonth: "3", priceInr: "99", purchasable: true, features: gives(false, true, false, false), bulkSendMax: "5" }), FREE);
    expect(sent).toEqual({ name: "Starter", documentsPerMonth: 3, features: gives(false, true, false, false), limits: { bulkSendMax: 5 } });
  });

  it("carries everything a new plan needs, with an empty price as none", () => {
    expect(planCreatePayload(form({ id: " startup_monthly ", name: "Startup", tier: "business", priceInr: "", purchasable: false, perSeat: true, features: gives(true, false, false, true) }))).toEqual({
      id: "startup_monthly",
      name: "Startup",
      tier: "business",
      interval: "month",
      perSeat: true,
      priceInr: null,
      priceIsFrom: false,
      documentsPerMonth: 50,
      purchasable: false,
      sellSubscription: true,
      sellPrepaid: true,
      features: gives(true, false, false, true),
    });
  });
});

describe("the plan dialog", () => {
  it("changes a price, sending that and nothing else", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(adminApi, "patch").mockResolvedValue({ data: { message: "Pro changed", data: { accountsMoved: 0 } } });
    const onSaved = vi.fn();
    dialog(PRO, { onSaved });

    expect(screen.getByRole("dialog", { name: "Change Pro" })).toBeInTheDocument();
    expect(screen.getByText(/12 accounts hold this plan/)).toBeInTheDocument();
    // Seats cannot start or stop being sold on a plan people are on
    expect(screen.getByLabelText(/Sold by the seat/)).toBeDisabled();

    const price = screen.getByLabelText("Price in rupees, a month");
    await user.clear(price);
    await user.type(price, "349");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(patch).toHaveBeenCalledWith("/admin/plans/pro_monthly", { priceInr: 349 });
    expect(onSaved).toHaveBeenCalledWith("Pro changed", { accountsMoved: 0 });
  });

  it("sets the features to what a level gives when the level is chosen, and lets one be changed after", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(adminApi, "patch").mockResolvedValue({ data: { message: "Pro changed", data: {} } });
    dialog(PRO);

    expect(screen.getByLabelText("Team workspaces")).not.toBeChecked();
    expect(screen.getByLabelText("People in one bulk send, at most")).toHaveValue(25);
    expect(screen.getByText(/As the Pro level gives/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Level"), "business");
    expect(screen.getByLabelText("Team workspaces")).toBeChecked();
    expect(screen.getByLabelText("People in one bulk send, at most")).toHaveValue(500);

    await user.click(screen.getByLabelText("API keys and webhooks"));
    expect(screen.getByText(/Set apart from what the Business level gives/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(patch).toHaveBeenCalledWith("/admin/plans/pro_monthly", { tier: "business", features: gives(true, true, true, true), limits: { bulkSendMax: 500 } });
  });

  it("shows for Free its name, its allowance and its features, and nothing about price or sale", async () => {
    const user = userEvent.setup();
    dialog(FREE);
    expect(screen.getByLabelText("Name")).toHaveValue("Free");
    expect(screen.getByLabelText("Documents a month")).toHaveValue(5);
    expect(screen.queryByLabelText(/Price in rupees/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Level")).not.toBeInTheDocument();
    expect(screen.queryByText(/On sale/)).not.toBeInTheDocument();
    expect(screen.queryByText("No monthly limit")).not.toBeInTheDocument();

    // The limit is asked for only once bulk send is on
    expect(screen.queryByLabelText("People in one bulk send, at most")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Bulk send"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter how many people one bulk send may go to.");
  });

  it("stops a new plan that could not be sold before anything is sent, and says why", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(adminApi, "post").mockResolvedValue({ data: { message: "Startup added", data: {} } });
    dialog(null);

    await user.type(screen.getByLabelText("Id"), "startup_monthly");
    await user.type(screen.getByLabelText("Name"), "Startup");
    await user.type(screen.getByLabelText("Documents a month"), "200");
    await user.click(screen.getByLabelText(/On sale/));
    await user.click(screen.getByRole("button", { name: "Add the plan" }));

    expect(screen.getByRole("alert")).toHaveTextContent("A plan on sale needs a price.");
    expect(post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Price in rupees, a month"), "999");
    await user.click(screen.getByRole("button", { name: "Add the plan" }));
    expect(post).toHaveBeenCalledWith("/admin/plans", {
      id: "startup_monthly",
      name: "Startup",
      tier: "pro",
      interval: "month",
      perSeat: false,
      priceInr: 999,
      priceIsFrom: false,
      documentsPerMonth: 200,
      purchasable: true,
      sellSubscription: true,
      sellPrepaid: true,
      features: TIERS[1].features,
      limits: { bulkSendMax: 25 },
    });
  });
});
