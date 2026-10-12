import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { day, inr, plural } from "../lib/format.js";
import { Badge, Card, Field, Filters, Mono, PageHeader, Select } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";

// How a subscription stands, with the colour that says so
const STATES = {
  active: ["green", "Renewing"],
  overdue: ["amber", "Payment overdue"],
  ending: ["neutral", "Turned off, running out"],
};

/**
 * Every account whose plan renews by itself, and those that turned that off and are running
 * out the time they paid for. Turning auto-renew off for a customer is done from their page.
 */
export default function Subscriptions() {
  const admin = useAdmin();
  const [query, setQuery] = useQueryState({ state: "", plan: "", page: "1" });
  const { data, error, loading, reload } = useFetch("/admin/subscriptions", query);

  const columns = [
    {
      key: "account",
      header: "Account",
      render: (sub) =>
        sub.account ? (
          <>
            <Link to={`/users/${sub.account.id}`} className="font-medium text-ink hover:underline">
              {sub.account.name}
            </Link>
            <div className="text-xs text-ink-muted break-all">{sub.account.email}</div>
          </>
        ) : (
          <span className="text-ink-muted">Account closed</span>
        ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (sub) => (
        <>
          <span className="text-ink">{admin.planName(sub.plan)}</span>
          {sub.seats && <span className="text-ink-faint"> · {plural(sub.seats, "seat")}</span>}
        </>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (sub) => {
        const [tone, label] = STATES[sub.state] || STATES.active;
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      key: "amount",
      header: "Each renewal",
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      render: (sub) => (sub.amountInr !== null ? inr(sub.amountInr) : <span className="text-ink-muted">—</span>),
    },
    {
      key: "when",
      header: "Next charge, or last day",
      className: "whitespace-nowrap",
      render: (sub) => (
        <>
          <span className="text-ink">{day(sub.periodEnd) || "—"}</span>
          {sub.state === "overdue" && sub.gracePeriodEnd && <div className="text-xs text-amber-300">Returns to Free on {day(sub.gracePeriodEnd)}</div>}
          {sub.state === "ending" && <div className="text-xs text-ink-muted">Ends then</div>}
        </>
      ),
    },
    {
      key: "provider",
      header: "At the provider",
      render: (sub) =>
        sub.simulated ? <span className="text-ink-muted">Simulated</span> : sub.providerSubscriptionId ? <Mono title={sub.provider}>{sub.providerSubscriptionId}</Mono> : <span className="text-ink-muted">—</span>,
    },
  ];

  return (
    <>
      <PageHeader title="Subscriptions" note="Plans that renew by themselves. The payment provider charges each period and tells this service, which extends the plan." />

      <Filters>
        <Field label="State">
          <Select value={query.state} onChange={(event) => setQuery({ state: event.target.value })}>
            <option value="">All</option>
            {Object.entries(STATES).map(([state, [, label]]) => (
              <option key={state} value={state}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plan">
          <Select value={query.plan} onChange={(event) => setQuery({ plan: event.target.value })}>
            <option value="">All plans</option>
            {admin.plans
              .filter((plan) => plan.id !== "free")
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label || plan.name}
                </option>
              ))}
          </Select>
        </Field>
      </Filters>

      <Card flush>
        <DataTable
          label="Subscriptions"
          columns={columns}
          rows={data?.items}
          rowTo={(sub) => (sub.account ? `/users/${sub.account.id}` : undefined)}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No subscription matches."
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>
    </>
  );
}
