import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { count, dateTime, inr, labelOf, planPrice, plural, shortDay, toneOf } from "../lib/format.js";
import { Badge, Button, Card, ErrorNote, PageHeader, Select, Skeleton, StatCard } from "../components/ui/basics.jsx";
import BarChart from "../components/ui/BarChart.jsx";

const RANGES = [
  ["7d", "Last 7 days"],
  ["14d", "Last 14 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
];

const METRICS = [
  { id: "documentsCompleted", label: "Documents completed", format: count },
  { id: "documentsCreated", label: "Documents created", format: count },
  { id: "signups", label: "New accounts", format: count },
  { id: "received", label: "Money received", format: inr },
];

// Things that will not fix themselves, each with where to go to deal with it
const attentionOf = (a) =>
  [
    a.failedJobs > 0 && { text: `${plural(a.failedJobs, "background job")} gave up`, to: "/operations?status=failed" },
    a.unsealed > 0 && { text: `${plural(a.unsealed, "completed document")} still without a sealed copy`, to: "/documents?status=signed" },
    a.failedDeliveries24h > 0 && { text: `${plural(a.failedDeliveries24h, "webhook delivery", "webhook deliveries")} failed in the last 24 hours`, to: "/operations" },
    a.pastDue > 0 && { text: `${plural(a.pastDue, "subscription")} with a payment overdue`, to: "/users" },
    a.unreviewedTemplates > 0 && { text: `${plural(a.unreviewedTemplates, "published template")} not reviewed by a lawyer`, to: "/templates" },
  ].filter(Boolean);

export default function Overview() {
  const admin = useAdmin();
  const [query, setQuery] = useQueryState({ range: "30d", metric: "documentsCompleted" });
  const { data, error, loading, reload } = useFetch("/admin/overview", { range: query.range });

  const metric = METRICS.find((m) => m.id === query.metric) || METRICS[0];
  const attention = data ? attentionOf(data.attention) : [];
  const complimentary = data ? data.plans.reduce((sum, row) => sum + row.complimentary, 0) : 0;

  return (
    <>
      <PageHeader
        title="Overview"
        note={data ? `As of ${dateTime(data.asOf)}` : "Loading…"}
        actions={
          <Button onClick={reload} busy={loading}>
            Refresh
          </Button>
        }
      />

      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {data ? (
          <>
            <StatCard label="Received this month" value={inr(data.money.receivedThisMonth)} note={`Last month ${inr(data.money.receivedLastMonth)}`} to="/payments" />
            <StatCard
              label="Monthly recurring revenue, estimated"
              value={inr(data.money.mrrEstimate)}
              note={`Paying subscriptions at list price${data.money.mrrUsesFromPrice ? "; Enterprise at its lowest price" : ""}`}
            />
            <StatCard
              label="Accounts on a paid plan"
              value={count(data.accounts.onPaidPlan)}
              note={`Of ${plural(data.accounts.total, "account")}${complimentary ? `; ${count(complimentary)} given by an admin` : ""}`}
              to="/users"
            />
            <StatCard label="New accounts, last 24 hours" value={count(data.accounts.new24h)} note={`${plural(data.documents.completed24h, "document")} completed in the same time`} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="panel p-5 space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-24 block" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))
        )}
      </div>

      {data && (
        <Card title="Needs attention">
          {attention.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing needs attention.</p>
          ) : (
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm">
                  <Badge tone="amber">Check</Badge>
                  <Link to={item.to} className="text-ink underline underline-offset-2 hover:text-white">
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card
        title={metric.label}
        note="One bar a day, counted by the day in India."
        actions={
          <>
            <Select aria-label="What to chart" value={metric.id} onChange={(event) => setQuery({ metric: event.target.value })} className="w-auto">
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Period" value={query.range} onChange={(event) => setQuery({ range: event.target.value })} className="w-auto">
              {RANGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </>
        }
      >
        {data ? (
          <BarChart label={metric.label} format={metric.format} data={data.days.map((d) => ({ key: d.day, label: shortDay(d.day), value: d[metric.id] }))} />
        ) : (
          <Skeleton className="h-56 w-full block" />
        )}
      </Card>

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card title="Plans" note="Accounts whose plan is active or has a payment overdue." className="xl:col-span-2" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="thead-row">
                    <th scope="col" className="px-5 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-5 py-3 font-medium">Price</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">Accounts</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">Given by an admin</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">Worth a month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="px-5 py-3 text-ink">{admin.planName("free")}</td>
                    <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{planPrice(admin.planOf("free"))}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{count(data.accounts.free)}</td>
                    <td className="px-5 py-3 text-right text-ink-muted">—</td>
                    <td className="px-5 py-3 text-right text-ink-muted">—</td>
                  </tr>
                  {data.plans.map((row) => {
                    const plan = admin.planOf(row.plan);
                    return (
                      <tr key={row.plan}>
                        <td className="px-5 py-3 text-ink whitespace-nowrap">
                          <Link to={`/users?plan=${row.plan}`} className="underline underline-offset-2 hover:text-white">
                            {admin.planName(row.plan)}
                          </Link>
                          {plan?.legacy && <span className="text-ink-faint"> · no longer sold</span>}
                        </td>
                        <td className="px-5 py-3 text-ink-muted whitespace-nowrap">{planPrice(plan)}</td>
                        <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">
                          {count(row.accounts)}
                          {plan?.perSeat && row.accounts > 0 && <span className="text-ink-faint"> · {plural(row.seats, "seat")}</span>}
                          {row.pastDue > 0 && <span className="text-amber-300"> · {count(row.pastDue)} overdue</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.complimentary ? count(row.complimentary) : <span className="text-ink-muted">—</span>}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{row.monthlyValue ? inr(row.monthlyValue) : <span className="text-ink-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Documents" note={`${count(data.documents.total)} in all, not counting deleted or test documents.`}>
            {Object.keys(data.documents.byStatus).length === 0 ? (
              <p className="text-sm text-ink-muted">None yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {admin.documentStatuses
                  .filter((status) => data.documents.byStatus[status])
                  .map((status) => (
                    <li key={status} className="flex items-center justify-between gap-3 text-sm">
                      <Link to={`/documents?status=${status}&show=live`}>
                        <Badge tone={toneOf("document", status)}>{labelOf("document", status)}</Badge>
                      </Link>
                      <span className="tabular-nums text-ink">{count(data.documents.byStatus[status])}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
