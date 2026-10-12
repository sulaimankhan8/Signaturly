import { useState } from "react";
import { adminApi, errorText } from "../api/admin.api.js";
import { count, inr, plural, yearlySaving } from "../lib/format.js";
import Dialog from "./ui/Dialog.jsx";
import { Button, Field, Input, Select } from "./ui/basics.jsx";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A new plan starts as a monthly plan of the first paid level, with what that level gives.
// `plan.yearly` is the plan's yearly price, where it has one.
const formOf = (plan, tiers) => {
  const from = plan || { ...tiers.find((tier) => tier.id !== "free"), name: "", interval: "month", perSeat: false, priceInr: null, priceIsFrom: false, documentsPerMonth: undefined, purchasable: false, legacy: false, sellSubscription: true, sellPrepaid: true };
  return {
    id: "",
    name: from.name,
    tagline: plan?.tagline || "",
    highlight: Boolean(plan?.highlight),
    // The yearly price, and whether it is on sale. Empty: the plan is sold by the month only.
    yearlyPriceInr: plan?.yearly?.priceInr ? String(plan.yearly.priceInr) : "",
    yearlyOnSale: plan?.yearly ? Boolean(plan.yearly.purchasable) : true,
    tier: plan ? plan.tier : from.id,
    interval: from.interval || "month",
    perSeat: from.perSeat,
    priceInr: from.priceInr === null ? "" : String(from.priceInr),
    priceIsFrom: from.priceIsFrom,
    documentsPerMonth: from.documentsPerMonth ? String(from.documentsPerMonth) : "",
    noLimit: from.documentsPerMonth === null,
    purchasable: from.purchasable,
    legacy: from.legacy,
    // How it is sold while on sale. A plan that does not say is sold both ways.
    sellSubscription: from.sellSubscription !== false,
    sellPrepaid: from.sellPrepaid !== false,
    features: { ...from.features },
    bulkSendMax: String(from.limits.bulkSendMax),
  };
};

// The form's boxes as the server wants them: numbers, and null for "none"
const valuesOf = (form) => ({
  name: form.name.trim(),
  tagline: form.tagline.trim(),
  highlight: form.highlight,
  tier: form.tier,
  interval: form.interval,
  perSeat: form.perSeat,
  priceInr: form.priceInr === "" ? null : Number(form.priceInr),
  priceIsFrom: form.priceIsFrom,
  documentsPerMonth: form.noLimit || form.documentsPerMonth === "" ? null : Number(form.documentsPerMonth),
  purchasable: form.purchasable && !form.legacy,
  legacy: form.legacy,
  sellSubscription: form.sellSubscription,
  sellPrepaid: form.sellPrepaid,
  features: form.features,
  limits: { bulkSendMax: Number(form.bulkSendMax) || 0 },
});

/**
 * What is sent to change a plan: only what may be changed on it and is different now, so a
 * save that touches the name does not also re-send the price.
 *
 * A new level brings what that level gives, so with a new level the features and the limit
 * are always sent as the form shows them. A limit on bulk send is sent only for a plan that
 * has bulk send.
 */
// The plan's yearly price as the form has it: null where the plan is sold by the month only.
// It is sold the same ways as the monthly price, and never while the plan is off sale or retired.
const yearlyOf = (form) => {
  if (form.yearlyPriceInr === "" || form.priceIsFrom) return null;
  return { priceInr: Number(form.yearlyPriceInr), purchasable: form.yearlyOnSale && form.purchasable && !form.legacy, sellSubscription: form.sellSubscription, sellPrepaid: form.sellPrepaid };
};
// The yearly price the plan has now, in the same shape
const yearlyNow = (plan) => (plan.yearly ? { priceInr: plan.yearly.priceInr, purchasable: Boolean(plan.yearly.purchasable), sellSubscription: plan.yearly.sellSubscription !== false, sellPrepaid: plan.yearly.sellPrepaid !== false } : null);
// A plan sold by the month, and not priced "from" an amount, can have a yearly price as well
const mayHaveYearly = (form, plan) => (!plan || plan.canChange.includes("interval")) && (plan ? plan.interval === "month" : true);

// eslint-disable-next-line react-refresh/only-export-components
export const planEditPayload = (form, plan) => {
  const values = valuesOf(form);
  const newLevel = plan.canChange.includes("tier") && values.tier !== plan.tier;
  const sent = plan.canChange.filter((field) => {
    if (field === "limits") return form.features.bulkSend && (newLevel || !same(values.limits, plan.limits));
    if (field === "features") return newLevel || !same(values.features, plan.features);
    if (field === "tagline") return values.tagline !== (plan.tagline || "");
    if (field === "highlight") return values.highlight !== Boolean(plan.highlight);
    return values[field] !== plan[field];
  });
  const payload = Object.fromEntries(sent.map((field) => [field, values[field]]));
  // The yearly price goes with the plan, when it is not what the plan has now. A plan with
  // one that is taken off sale keeps the price it had, for the accounts still paying it.
  if (mayHaveYearly(form, plan)) {
    const [wanted, now] = [yearlyOf(form), yearlyNow(plan)];
    const gone = !wanted && now && !now.purchasable;
    if (!same(wanted, now) && !gone) payload.yearly = wanted;
  }
  return payload;
};

// eslint-disable-next-line react-refresh/only-export-components
export const planCreatePayload = (form) => {
  const { legacy: _legacy, limits, tagline, highlight, ...values } = valuesOf(form);
  const yearly = yearlyOf(form);
  return { id: form.id.trim(), ...values, ...(form.features.bulkSend ? { limits } : {}), ...(tagline ? { tagline } : {}), ...(highlight ? { highlight } : {}), ...(yearly ? { yearly } : {}) };
};

// What has to be put right before anything is sent. The server checks again.
const problemWith = (form, plan) => {
  const may = (field) => !plan || plan.canChange.includes(field);
  const whole = (text) => Number.isInteger(Number(text)) && Number(text) >= 1;
  if (!plan && !/^[a-z][a-z0-9_]{2,39}$/.test(form.id.trim())) return "The id is 3 to 40 lowercase letters, digits or underscores, starting with a letter.";
  if (!form.name.trim()) return "Give the plan a name.";
  if (may("priceInr") && form.priceInr !== "" && !whole(form.priceInr)) return "The price is a whole number of rupees, 1 or more.";
  if (mayHaveYearly(form, plan) && form.yearlyPriceInr !== "" && !form.priceIsFrom) {
    if (!whole(form.yearlyPriceInr)) return "The yearly price is a whole number of rupees, 1 or more.";
    if (form.priceInr === "") return "A plan with a yearly price needs a monthly price too.";
    if (Number(form.yearlyPriceInr) > Number(form.priceInr) * 12) return "The yearly price is more than twelve months at the monthly price. Lower it, or leave it empty to sell the plan by the month only.";
  }
  if (may("documentsPerMonth") && !form.noLimit && !whole(form.documentsPerMonth)) return "Enter how many documents a month the plan allows, or tick “No monthly limit”.";
  if (form.features.bulkSend && !whole(form.bulkSendMax)) return "Enter how many people one bulk send may go to.";
  if (may("purchasable") && form.purchasable && !form.legacy) {
    if (form.priceInr === "") return "A plan on sale needs a price.";
    if (form.priceIsFrom) return "A plan priced “from” an amount is agreed with each customer, so it cannot be on sale.";
    if (!form.sellSubscription && !form.sellPrepaid) return "A plan on sale has to be sold at least one way: as a subscription, or for one period.";
  }
  return "";
};

const Tick = ({ checked, onChange, disabled, children }) => (
  <label className={`flex items-start gap-2 ${disabled ? "text-ink-faint" : "text-ink"}`}>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
    <span>{children}</span>
  </label>
);

const Part = ({ title, children }) => (
  <fieldset className="space-y-3 border-t-2 border-edge pt-4">
    <legend className="float-left w-full font-display text-sm font-bold text-ink mb-3">{title}</legend>
    <div className="clear-both space-y-3">{children}</div>
  </fieldset>
);

/**
 * Adds a plan, or changes one, in full: its name, what it costs and how it is sold, how many
 * documents it allows, and what it includes. With `plan` it changes that plan and shows only
 * what may be changed on it; without, it asks for everything a new plan needs.
 *
 * A plan is said once and has up to two prices: one a month, and optionally one a year.
 * `plan.yearly` is the yearly one. Only its price and whether it is on sale are set here;
 * everything else about it is the plan's.
 *
 * `tiers` is what each level gives by itself and `features` the features a plan can have,
 * both as the server lists them.
 */
export default function PlanFormDialog({ open, plan, tiers, features, onClose, onSaved }) {
  const [form, setForm] = useState(() => formOf(plan, tiers));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const setFeature = (id) => (event) => setForm((old) => ({ ...old, features: { ...old.features, [id]: event.target.checked } }));
  // Choosing a level sets the features to what it gives; they can then be set apart from it
  const setLevel = (event) => {
    const level = tiers.find((tier) => tier.id === event.target.value);
    setForm((old) => ({ ...old, tier: level.id, features: { ...level.features }, bulkSendMax: String(level.limits.bulkSendMax) }));
  };

  const may = (field) => !plan || plan.canChange.includes(field);
  const free = plan?.id === "free";
  const level = tiers.find((tier) => tier.id === form.tier);
  const ownFeatures = level && (!same(form.features, level.features) || (form.features.bulkSend && Number(form.bulkSendMax) !== level.limits.bulkSendMax));
  const perSeat = may("perSeat") ? form.perSeat : plan.perSeat;
  const interval = may("interval") ? form.interval : plan.interval;
  const held = plan?.accounts > 0 || plan?.yearly?.accounts > 0;
  const yearlyToo = mayHaveYearly(form, plan) && interval === "month";
  const saving = yearlyToo ? yearlySaving(Number(form.priceInr), Number(form.yearlyPriceInr)) : null;

  const submit = async (event) => {
    event.preventDefault();
    const problem = problemWith(form, plan);
    if (problem) return setError(problem);
    const payload = plan ? planEditPayload(form, plan) : planCreatePayload(form);
    if (plan && Object.keys(payload).length === 0) return onClose();
    try {
      setBusy(true);
      setError("");
      const res = plan ? await adminApi.patch(`/admin/plans/${plan.id}`, payload) : await adminApi.post("/admin/plans", payload);
      onSaved(res.data.message, res.data.data);
    } catch (err) {
      setError(errorText(err, plan ? "The plan could not be changed." : "The plan could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={plan ? `Change ${plan.name}` : "Add a plan"}
      onClose={onClose}
      busy={busy}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="plan-form" busy={busy}>
            {busy ? "Saving…" : plan ? "Save changes" : "Add the plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-5" noValidate>
        {error && (
          <p role="alert" className="notice notice-red">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!plan && (
            <Field label="Id" help="How subscriptions and payments name the plan, for example startup_monthly. It cannot be changed later.">
              <Input value={form.id} onChange={set("id")} maxLength={40} autoCapitalize="none" spellCheck={false} className="font-mono" data-autofocus />
            </Field>
          )}
          <Field label="Name" help="What customers see on the pricing page and on invoices." className={plan ? "sm:col-span-2" : ""}>
            <Input value={form.name} onChange={set("name")} maxLength={40} data-autofocus={plan ? true : undefined} />
          </Field>
          {may("tagline") && (
            <Field label="Who it is for" help="One line under the name on the pricing page, for example “For teams that send documents together”." className="sm:col-span-2">
              <Input value={form.tagline} onChange={set("tagline")} maxLength={90} />
            </Field>
          )}
        </div>
        {may("highlight") && (
          <Tick checked={form.highlight} onChange={set("highlight")}>
            Mark as “Most popular” on the pricing page
          </Tick>
        )}

        {may("priceInr") && (
          <Part title="Price">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`Price in rupees${perSeat ? ", a seat" : ""}${interval ? `, a ${interval}` : ""}`} help="GST included. Leave empty for a plan with no price, which only an admin can give.">
                <Input type="number" inputMode="numeric" min="1" step="1" value={form.priceInr} onChange={set("priceInr")} />
              </Field>
              {yearlyToo && (
                <Field
                  label={`Yearly price in rupees${perSeat ? ", a seat" : ""}`}
                  help={
                    form.priceIsFrom
                      ? "A plan priced “from” an amount has no yearly price."
                      : saving
                        ? `${inr(saving.perMonthInr)} a month${saving.percent > 0 ? `, ${saving.percent}% less than twelve months${saving.monthsFree ? ` (${plural(saving.monthsFree, "month")} free)` : ""}` : ", no saving over twelve months"}.`
                        : "Optional. Leave empty to sell the plan by the month only."
                  }
                >
                  <Input type="number" inputMode="numeric" min="1" step="1" value={form.priceIsFrom ? "" : form.yearlyPriceInr} onChange={set("yearlyPriceInr")} disabled={form.priceIsFrom} />
                </Field>
              )}
            </div>
            <Tick checked={form.priceIsFrom} onChange={set("priceIsFrom")}>
              This is a “from” price: the real one is agreed with each customer
            </Tick>
            {may("perSeat") && (
              <Tick checked={form.perSeat} onChange={set("perSeat")} disabled={held}>
                Sold by the seat: the price and the documents are for one seat, and every seat's documents are pooled
                {held && " (can be changed only while no account is on the plan)"}
              </Tick>
            )}
          </Part>
        )}

        {may("documentsPerMonth") && (
          <Part title="Documents">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <Field label={`Documents a month${perSeat ? ", a seat" : ""}`}>
                <Input type="number" inputMode="numeric" min="1" step="1" value={form.noLimit ? "" : form.documentsPerMonth} onChange={set("documentsPerMonth")} disabled={form.noLimit} placeholder={form.noLimit ? "No monthly limit" : ""} />
              </Field>
              {!free && (
                <div className="pb-2">
                  <Tick checked={form.noLimit} onChange={set("noLimit")}>
                    No monthly limit
                  </Tick>
                </div>
              )}
            </div>
          </Part>
        )}

        <Part title="What it includes">
          {may("tier") ? (
            <Field label="Level" help="Template packs, the “Signed with PactDoc” line and single sign-on follow the level. Choosing a level sets the features below to what it gives; they can then be changed one by one.">
              <Select value={form.tier} onChange={setLevel}>
                {tiers
                  .filter((tier) => tier.id !== "free")
                  .map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <p className="text-ink-muted">{level?.name || "Free"} level, which this plan keeps. Its features can be set below.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {features.map((feature) => (
              <Tick key={feature.id} checked={Boolean(form.features[feature.id])} onChange={setFeature(feature.id)}>
                {feature.label}
              </Tick>
            ))}
          </div>
          {form.features.bulkSend && (
            <Field label="People in one bulk send, at most" className="sm:w-1/2">
              <Input type="number" inputMode="numeric" min="1" step="1" value={form.bulkSendMax} onChange={set("bulkSendMax")} />
            </Field>
          )}
          <p className="text-xs text-ink-faint">
            {ownFeatures ? `Set apart from what the ${level.name} level gives.` : `As the ${level?.name || "Free"} level gives.`}
            {plan && " A change here reaches every account on the plan at once."}
          </p>
        </Part>

        {may("purchasable") && (
          <Part title="Sale">
            <Tick checked={form.purchasable && !form.legacy} onChange={set("purchasable")} disabled={form.legacy}>
              On sale: customers can buy it
            </Tick>
            {form.purchasable && !form.legacy && may("sellSubscription") && (
              <div className="ml-6 space-y-2 border-l-2 border-edge pl-4">
                <Tick checked={form.sellSubscription} onChange={set("sellSubscription")}>
                  As a subscription: it renews by itself each {interval || "period"} until the customer turns that off. It is created at Razorpay when you save.
                </Tick>
                <Tick checked={form.sellPrepaid} onChange={set("sellPrepaid")}>
                  Prepaid: one {interval || "period"} paid for up front, which ends unless the customer buys more
                </Tick>
                {yearlyToo && form.yearlyPriceInr !== "" && !form.priceIsFrom && (
                  <Tick checked={form.yearlyOnSale} onChange={set("yearlyOnSale")}>
                    Also sold by the year, at the yearly price and in the same ways
                  </Tick>
                )}
              </div>
            )}
            {plan && (
              <Tick checked={form.legacy} onChange={set("legacy")}>
                Retired: kept for the accounts that hold it, and no longer listed or sold
              </Tick>
            )}
          </Part>
        )}

        {plan && (
          <p className="notice leading-relaxed">
            {free
              ? `${plural(plan.accounts, "account")} on Free. A new allowance reaches at once every one of them still on the standard allowance; an account given its own allowance keeps it.`
              : `${plan.accounts === 0 ? "No account holds" : `${count(plan.accounts)} ${plan.accounts === 1 ? "account holds" : "accounts hold"}`} this plan${plan.yearly?.accounts > 0 ? ` by the month, and ${count(plan.yearly.accounts)} by the year` : ""}. A new price is charged from the next checkout; an account already renewing automatically keeps the price it subscribed at. A new allowance reaches a paying account when its next period starts.`}
          </p>
        )}
      </form>
    </Dialog>
  );
}
