import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { adminApi, errorText } from "../api/admin.api.js";
import { useFetch } from "../lib/hooks.js";
import { allowance, count, dateTime, inr, planPrice, plural, yearlySaving } from "../lib/format.js";
import { Badge, Button, Card, Mono, PageHeader } from "../components/ui/basics.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import PlanFormDialog from "../components/PlanFormDialog.jsx";
import AddOnFormDialog from "../components/AddOnFormDialog.jsx";

/**
 * The price list: what is sold, for how much, how, and what each plan includes.
 *
 * A plan is one row. It is said once, and has a monthly price and, where it is sold by the
 * year too, a yearly one. The server keeps the yearly price as a record of its own (with its
 * own accounts and its own plan at Razorpay); here it is shown, and changed, with its plan.
 *
 * Three things are sold. A plan as a subscription renews by itself; a plan prepaid is one
 * period paid up front; a top-up is a pack of extra documents bought with one payment.
 * Changes made here are what checkout charges, what accounts are allowed and what the
 * pricing page shows; nothing has to be deployed. This list is the one that counts: a plan
 * sold as a subscription is created at Razorpay from here.
 */
export default function Plans() {
  const admin = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch("/admin/plans");
  // null: closed. "new": adding. Otherwise the plan, or the pack, being changed.
  const [editing, setEditing] = useState(null);
  const [editingPack, setEditingPack] = useState(null);
  // The id of the plan being sent to Razorpay
  const [sending, setSending] = useState("");

  // Each plan with its yearly price beside it; a yearly price is not a row of its own
  const rows = data?.plans.filter((plan) => !plan.yearlyOf).map((plan) => ({ ...plan, yearly: data.plans.find((other) => other.yearlyOf === plan.id) || null }));

  const levelOf = (plan) => data.tiers.find((tier) => tier.id === plan.tier);
  // The features a plan has, in a line: "Bulk send to 25"
  const included = (plan) => data.features.filter((feature) => plan.features[feature.id]).map((feature) => (feature.id === "bulkSend" ? `${feature.label} to ${count(plan.limits.bulkSendMax)}` : feature.label));
  const setApart = (plan) => {
    const level = levelOf(plan);
    return data.features.some((feature) => plan.features[feature.id] !== level.features[feature.id]) || (plan.features.bulkSend && plan.limits.bulkSendMax !== level.limits.bulkSendMax);
  };

  // What Razorpay made of a plan saved or sent to it, said in the corner
  const sayRazorpay = (saved, razorpay) => {
    if (razorpay?.state === "failed") toast.error(`${saved}, but Razorpay did not take the plan: ${razorpay.reason}`);
    else if (razorpay?.state === "synced") toast.ok(`${saved}. It is at Razorpay as ${razorpay.providerPlanId}.`);
    else toast.ok(saved);
  };

  const sendToRazorpay = async (plan) => {
    try {
      setSending(plan.id);
      const res = await adminApi.post(`/admin/plans/${plan.id}/razorpay`);
      const razorpay = res.data.data.razorpay;
      if (razorpay.state === "synced") toast.ok(res.data.message);
      else toast.error(res.data.message);
      reload();
    } catch (err) {
      toast.error(errorText(err, "The plan could not be sent to Razorpay."));
    } finally {
      setSending("");
    }
  };

  // How one price of a plan is sold: retired, not on sale, or the ways it can be bought
  const soldAs = (record) =>
    record.legacy ? (
      <Badge tone="amber">Retired</Badge>
    ) : !record.billing.subscription && !record.billing.prepaid ? (
      <Badge>Not on sale</Badge>
    ) : (
      <span className="flex flex-wrap gap-1.5">
        {record.billing.subscription && <Badge tone="green">Subscription</Badge>}
        {record.billing.prepaid && <Badge tone="green">Prepaid</Badge>}
      </span>
    );

  // Where one price of a plan stands at Razorpay
  const atRazorpay = (record) => {
    const razorpay = record.razorpay;
    // Prices the plan was subscribed to at before, which still renew for those customers
    const earlier = razorpay.versions.filter((version) => !version.current && version.subscribers > 0);
    return (
      <>
        {razorpay.current ? (
          <>
            <Badge tone="green">Created</Badge>
            <div>
              <Mono>{razorpay.current.providerPlanId}</Mono>
            </div>
            {razorpay.current.subscribers > 0 && <div className="text-xs text-ink-muted">{plural(razorpay.current.subscribers, "account")} renewing</div>}
          </>
        ) : razorpay.configured ? (
          <>
            <Badge tone="amber">Not created yet</Badge>
            <div className="mt-1.5">
              <Button size="sm" onClick={() => sendToRazorpay(record)} busy={sending === record.id} disabled={Boolean(sending)} aria-label={`Create ${record.label} (${record.id}) on Razorpay`}>
                {sending === record.id ? "Creating…" : "Create on Razorpay"}
              </Button>
            </div>
          </>
        ) : (
          <span className="text-xs text-ink-muted">This server has no Razorpay keys</span>
        )}
        {earlier.map((version) => (
          <div key={version.providerPlanId} className="text-xs text-ink-faint">
            {inr(version.priceInr)} a {version.interval}: {plural(version.subscribers, "account")} still renewing
          </div>
        ))}
      </>
    );
  };

  const accountsOn = (record) =>
    record.accounts > 0 ? (
      <Link to={`/users?plan=${record.id}`} className="underline underline-offset-2 hover:text-white">
        {count(record.accounts)}
      </Link>
    ) : (
      <span className="text-ink-muted">0</span>
    );

  const columns = [
    {
      key: "plan",
      header: "Plan",
      className: "min-w-[12rem]",
      render: (plan) => (
        <>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">{plan.name}</span>
            {plan.highlight && <Badge tone="green">Most popular</Badge>}
            {!plan.shipped && <Badge tone="blue">Added here</Badge>}
            {plan.shipped && plan.changedAt && <Badge>Changed</Badge>}
          </span>
          {plan.tagline && <div className="text-xs text-ink-muted">{plan.tagline}</div>}
          <div className="font-mono text-xs text-ink-muted">{plan.id}</div>
          {plan.changedAt && <div className="text-xs text-ink-faint">{plan.shipped ? "Changed" : "Last saved"} {dateTime(plan.changedAt)}</div>}
        </>
      ),
    },
    {
      key: "includes",
      header: "Includes",
      className: "max-w-xs",
      render: (plan) => (
        <>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink">{levelOf(plan).name} level</span>
            {setApart(plan) && <Badge tone="blue">Own features</Badge>}
          </span>
          <div className="text-xs text-ink-muted">{included(plan).join(" · ") || "None of the features"}</div>
        </>
      ),
    },
    {
      key: "price",
      header: "Monthly",
      className: "whitespace-nowrap",
      render: (plan) => (
        <>
          {planPrice(plan)}
          <div className="text-xs text-ink-muted">{`${allowance(plan.documentsPerMonth)}${plan.perSeat && plan.documentsPerMonth !== null ? ", a seat" : ""}`}</div>
          <div className="mt-1.5">{soldAs(plan)}</div>
        </>
      ),
    },
    {
      key: "yearly",
      header: "Yearly",
      className: "whitespace-nowrap",
      render: (plan) => {
        if (!plan.yearly) return <span className="text-ink-muted">{plan.interval === "month" && plan.canChange.includes("interval") ? "Not sold by the year" : "—"}</span>;
        const saving = yearlySaving(plan.priceInr, plan.yearly.priceInr);
        return (
          <>
            {planPrice(plan.yearly)}
            {saving && (
              <div className="text-xs text-ink-muted">
                {inr(saving.perMonthInr)} a month{saving.percent > 0 ? ` · ${saving.percent}% off` : ""}
              </div>
            )}
            <div className="mt-1.5">{soldAs(plan.yearly)}</div>
          </>
        );
      },
    },
    {
      key: "razorpay",
      header: "At Razorpay",
      render: (plan) => {
        const needed = [plan, plan.yearly].filter((record) => record?.razorpay.needed);
        if (needed.length === 0) return <span className="text-ink-muted">—</span>;
        return (
          <div className="space-y-2">
            {needed.map((record) => (
              <div key={record.id}>
                {plan.yearly && <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{record.yearlyOf ? "Yearly" : "Monthly"}</div>}
                {atRazorpay(record)}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "accounts",
      header: "Accounts",
      align: "right",
      className: "tabular-nums",
      render: (plan) => (
        <>
          {accountsOn(plan)}
          {plan.yearly && <div className="text-xs text-ink-muted">{accountsOn(plan.yearly)} yearly</div>}
        </>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (plan) => (
        <Button size="sm" onClick={() => setEditing(plan)} aria-label={`Change ${plan.name} (${plan.id})`}>
          Change
        </Button>
      ),
    },
  ];

  const packColumns = [
    {
      key: "pack",
      header: "Pack",
      render: (pack) => (
        <>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">{count(pack.documents)} extra documents</span>
            {!pack.shipped && <Badge tone="blue">Added here</Badge>}
            {pack.shipped && pack.changedAt && <Badge>Changed</Badge>}
          </span>
          <div className="font-mono text-xs text-ink-muted">{pack.id}</div>
        </>
      ),
    },
    { key: "price", header: "Price", className: "whitespace-nowrap", render: (pack) => `${inr(pack.priceInr)}, one payment` },
    { key: "each", header: "A document", className: "whitespace-nowrap text-ink-muted", render: (pack) => inr(Math.round((pack.priceInr / pack.documents) * 100) / 100) },
    { key: "sale", header: "Sale", render: (pack) => (pack.onSale ? <Badge tone="green">On sale</Badge> : <Badge>Not on sale</Badge>) },
    {
      key: "action",
      header: "",
      align: "right",
      render: (pack) => (
        <Button size="sm" onClick={() => setEditingPack(pack)} aria-label={`Change the pack ${pack.id}`}>
          Change
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Plans"
        note="What is sold, for how much, how it is paid for, and what each plan includes. Prices are in whole rupees and include GST."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")} disabled={!data}>
            Add a plan
          </Button>
        }
      />

      <div className="notice">
        A plan is set once and has a monthly price and, if you give it one, a <strong className="text-ink">yearly price</strong>; what it includes is the same at both. It can be sold as a{" "}
        <strong className="text-ink">subscription</strong>, which renews by itself, or <strong className="text-ink">prepaid</strong> for one period, or both. A change here is what checkout charges and what accounts on the plan
        are allowed from the moment it is saved, and is written to{" "}
        <Link to="/activity" className="text-ink underline underline-offset-2 hover:text-white">
          Admin activity
        </Link>
        . A plan sold as a subscription is created at Razorpay when it is saved; a price cannot be edited there, so a new price is a new plan at Razorpay and the customers already subscribed keep theirs. Who is subscribed is on{" "}
        <Link to="/subscriptions" className="text-ink underline underline-offset-2 hover:text-white">
          Subscriptions
        </Link>
        .
      </div>

      <Card flush>
        <DataTable label="Plans" columns={columns} rows={rows} loading={loading} error={error} onRetry={reload} empty="No plans." />
      </Card>

      <Card
        title="Top-ups"
        note="Packs of extra documents. One payment, at any time and on any plan, or added to a plan while it is bought. They are used after the month's allowance and never expire."
        actions={
          <Button onClick={() => setEditingPack("new")} disabled={!data}>
            Add a pack
          </Button>
        }
        flush
      >
        <DataTable label="Top-up packs" columns={packColumns} rows={data?.addOns} loading={loading} error={data ? "" : error} onRetry={reload} empty="No packs." />
      </Card>

      {editing && (
        <PlanFormDialog
          open
          plan={editing === "new" ? null : editing}
          tiers={data.tiers}
          features={data.features}
          onClose={() => setEditing(null)}
          onSaved={(message, result) => {
            setEditing(null);
            // Of the two prices, the one Razorpay refused is the one to hear about
            sayRazorpay(
              result?.accountsMoved ? `${message}. ${count(result.accountsMoved)} Free ${result.accountsMoved === 1 ? "account was" : "accounts were"} moved to the new allowance` : message,
              result?.razorpayYearly?.state === "failed" ? result.razorpayYearly : result?.razorpay
            );
            reload();
            // Plan names and prices on every other screen come from the same list
            admin.refresh();
          }}
        />
      )}

      {editingPack && (
        <AddOnFormDialog
          open
          pack={editingPack === "new" ? null : editingPack}
          onClose={() => setEditingPack(null)}
          onSaved={(message) => {
            setEditingPack(null);
            toast.ok(message);
            reload();
          }}
        />
      )}
    </>
  );
}
