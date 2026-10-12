import { useState } from "react";
import { adminApi, errorText } from "../api/admin.api.js";
import { allowance, count, day, planPrice } from "../lib/format.js";
import Dialog from "./ui/Dialog.jsx";
import { Button, Field, Input, Select, Textarea } from "./ui/basics.jsx";

const DAY_MS = 24 * 60 * 60 * 1000;

// How long a plan lasts when no number of days is given
const ownDays = (plan) => (plan.interval === "year" ? 365 : plan.interval === "month" ? 30 : null);

/**
 * What is sent to the server. The allowance is sent only when the "custom allowance" box
 * is ticked: otherwise the account gets what the plan gives, whatever it had before.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const planGrantPayload = (form, plan) => ({
  plan: plan.id,
  reason: form.reason.trim(),
  ...(form.days && ownDays(plan) ? { days: Number(form.days) } : {}),
  ...(form.custom && form.customQuota ? { customQuota: Number(form.customQuota) } : {}),
  ...(plan.perSeat ? { seats: Math.max(1, Number(form.seats) || 1) } : {}),
});

/**
 * Puts an account on a plan without a payment. Says, before anything is saved, what the
 * account will be allowed and when the plan ends.
 */
export default function PlanDialog({ open, user, subscription, plans, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    plan: subscription.plan === "free" ? plans.find((plan) => plan.purchasable)?.id || plans[0].id : subscription.plan,
    custom: false,
    customQuota: "",
    seats: String(subscription.seats || 1),
    days: "",
    reason: "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The moment the dialog opened, which the end date is counted from
  const [openedAt] = useState(() => Date.now());

  const plan = plans.find((p) => p.id === form.plan) || plans[0];
  const seats = plan.perSeat ? Math.max(1, Number(form.seats) || 1) : 1;
  const lasts = ownDays(plan);
  const days = Number(form.days) || lasts;
  const set = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.reason.trim().length < 3) return setError("Say why the plan is being changed.");
    if (form.custom && !(Number(form.customQuota) >= 1)) return setError("Enter the custom allowance, or untick the box.");
    try {
      setBusy(true);
      setError("");
      const res = await adminApi.patch(`/admin/users/${user.id}/plan`, planGrantPayload(form, plan));
      onSaved(res.data.message);
    } catch (err) {
      setError(errorText(err, "The plan could not be changed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Change plan"
      onClose={onClose}
      busy={busy}
      width="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="plan-form" busy={busy}>
            {busy ? "Saving…" : "Change plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-4">
        <p className="text-ink-muted">
          For <span className="text-ink">{user.name}</span> ({user.email}). No payment is taken, and the change is recorded with your name.
        </p>

        <Field label="Plan">
          <Select value={form.plan} onChange={set("plan")} data-autofocus>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {planPrice(p)}
                {p.legacy ? " · no longer sold" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {plan.perSeat && (
          <Field label="Seats" help="Every seat's documents are pooled into one allowance.">
            <Input type="number" min="1" max="500" value={form.seats} onChange={set("seats")} />
          </Field>
        )}

        <div className="rounded-lg border-2 border-edge bg-surface-panel px-3 py-2.5 space-y-2">
          <p>
            This plan gives{" "}
            <strong className="font-medium text-ink">{plan.documentsPerMonth === null ? "no monthly limit" : `${count(plan.documentsPerMonth * seats)} documents a month`}</strong>
            {plan.perSeat && plan.documentsPerMonth !== null ? ` (${count(plan.documentsPerMonth)} a seat)` : ""}.
          </p>
          <label className="flex items-center gap-2 text-ink-muted">
            <input type="checkbox" checked={form.custom} onChange={set("custom")} className="h-4 w-4 accent-white" />
            Give a different allowance
          </label>
          {form.custom && (
            <Field label="Documents a month">
              <Input type="number" min="1" value={form.customQuota} onChange={set("customQuota")} placeholder={plan.documentsPerMonth === null ? "" : String(plan.documentsPerMonth * seats)} />
            </Field>
          )}
        </div>

        {lasts ? (
          <Field label="Ends after (days)" help={`Ends on ${day(openedAt + days * DAY_MS)}. Nothing renews a plan given here: after that date the account has three days, then returns to Free.`}>
            <Input type="number" min="1" max="3650" value={form.days} onChange={set("days")} placeholder={`${lasts}, the plan's own period`} />
          </Field>
        ) : (
          <p className="text-ink-muted">{plan.id === "free" ? "The Free plan has no end date." : "This plan does not end."}</p>
        )}

        <Field label="Reason" help="Shown in the record of admin actions." error={error}>
          <Textarea rows={2} maxLength={300} value={form.reason} onChange={set("reason")} placeholder="For example: agreed with the customer by email on 11 October" />
        </Field>

        {subscription.plan !== "free" && plan.id !== subscription.plan && (
          <p className="text-ink-muted">
            The account is on {plans.find((p) => p.id === subscription.plan)?.name || subscription.plan} now, with {allowance(subscription.unlimited ? null : subscription.monthlyQuota).toLowerCase()}.
          </p>
        )}
      </form>
    </Dialog>
  );
}
