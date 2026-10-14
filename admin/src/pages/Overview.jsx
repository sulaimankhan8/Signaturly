import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { count, dateTime, day, inr, labelOf, planPrice, plural, shortDay, toneOf } from "../lib/format.js";
import { Button, Card, ErrorNote, Icon, Segmented, Skeleton, StatCard } from "../components/ui/basics.jsx";
import { ICONS } from "../components/ui/icons.js";
import BarChart from "../components/ui/BarChart.jsx";

const RANGES = [
  ["7d", "7D", "Last 7 days"],
  ["14d", "14D", "Last 14 days"],
  ["30d", "30D", "Last 30 days"],
  ["90d", "90D", "Last 90 days"],
];

const VIEWS = [
  ["pulse", "Platform pulse", ICONS.pulse],
  ["business", "Business health", ICONS.trend],
];

// One colour per chart; each chart has one series, so its title names what it draws
const SERIES = {
  signups: "#3b82f6",
  received: "#e5a823",
  documentsCreated: "#8b5cf6",
  documentsCompleted: "#10b981",
};

const DOCUMENT_SERIES = [
  ["documentsCompleted", "Completed"],
  ["documentsCreated", "Created"],
];

// The bar colour of each status tone in the pipeline
const TONE_BAR = { neutral: "#6b7280", blue: "#38bdf8", green: "#34d399", amber: "#fbbf24", red: "#f87171" };

// The change from `before` to `now` in per cent; nothing when there was nothing before
const change = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

// Things that will not fix themselves, each with where to go to deal with it
const attentionOf = (a) =>
  [
    a.failedJobs > 0 && { n: a.failedJobs, text: `${plural(a.failedJobs, "background job")} gave up`, to: "/operations?status=failed" },
    a.unsealed > 0 && { n: a.unsealed, text: `${plural(a.unsealed, "completed document")} still without a sealed copy`, to: "/documents?status=signed" },
    a.failedDeliveries24h > 0 && { n: a.failedDeliveries24h, text: `${plural(a.failedDeliveries24h, "webhook delivery", "webhook deliveries")} failed in the last 24 hours`, to: "/operations" },
    a.pastDue > 0 && { n: a.pastDue, text: `${plural(a.pastDue, "subscription")} with a payment overdue`, to: "/users" },
    a.unreviewedTemplates > 0 && { n: a.unreviewedTemplates, text: `${plural(a.unreviewedTemplates, "published template")} not reviewed by a lawyer`, to: "/templates" },
  ].filter(Boolean);

// Morning, afternoon or evening, by the clock in India
const greeting = (date) => {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(date));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const firstNameOf = (admin) => (admin.name ? admin.name.trim().split(/\s+/)[0] : (admin.email || "").split("@")[0]);

// The days on screen, as a spreadsheet
const exportDays = (data) => {
  const rows = [["Day", "New accounts", "Documents created", "Documents completed", "Received (INR)"], ...data.days.map((d) => [d.day, d.signups, d.documentsCreated, d.documentsCompleted, d.received])];
  const csv = rows.map((row) => row.join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `pactdoc-overview-${data.range}-${data.days[data.days.length - 1]?.day || "today"}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

function Tiles({ data, view, days }) {
  const against = `vs previous ${days} days`;
  if (view === "business") {
    const share = data.accounts.total ? (data.accounts.onPaidPlan / data.accounts.total) * 100 : 0;
    const complimentary = data.plans.reduce((sum, row) => sum + row.complimentary, 0);
    return (
      <>
        <StatCard tone="amber" icon={ICONS.rupee} label="Received in period" value={inr(data.period.received)} delta={change(data.period.received, data.previous.received)} deltaNote={against} note={`Last ${days} days`} to="/payments" />
        <StatCard tone="green" icon={ICONS.payments} label="Received this month" value={inr(data.money.receivedThisMonth)} note={`Last month ${inr(data.money.receivedLastMonth)}`} to="/payments" />
        <StatCard tone="violet" icon={ICONS.trend} label="MRR, estimated" value={inr(data.money.mrrEstimate)} note={data.money.mrrUsesFromPrice ? "At list price; Enterprise at its lowest" : "Paying subscriptions at list price"} />
        <StatCard tone="blue" icon={ICONS.star} label="On a paid plan" value={count(data.accounts.onPaidPlan)} note={`${share.toFixed(1)}% of accounts${complimentary ? ` · ${count(complimentary)} given` : ""}`} to="/subscriptions" />
        <StatCard tone="red" icon={ICONS.warning} label="Failed payments" value={count(data.money.failedPayments30d)} note="In the last 30 days" to="/payments?kind=failed" />
      </>
    );
  }
  const before = data.accounts.total - data.period.signups;
  return (
    <>
      <StatCard tone="red" icon={ICONS.users} label="Total accounts" value={count(data.accounts.total)} delta={change(data.accounts.total, before)} deltaNote={`grew in ${days} days`} note="Lifetime overall" to="/users" />
      <StatCard tone="green" icon={ICONS.userPlus} label="New accounts" value={count(data.period.signups)} delta={change(data.period.signups, data.previous.signups)} deltaNote={against} note={`Last ${days} days`} />
      <StatCard tone="blue" icon={ICONS.documents} label="New documents" value={count(data.period.documentsCreated)} delta={change(data.period.documentsCreated, data.previous.documentsCreated)} deltaNote={against} note={`Last ${days} days`} to="/documents" />
      <StatCard tone="violet" icon={ICONS.check} label="Fully signed" value={count(data.period.documentsCompleted)} delta={change(data.period.documentsCompleted, data.previous.documentsCompleted)} deltaNote={against} note={`Last ${days} days`} />
      <StatCard tone="sky" icon={ICONS.pulse} label="Last 24 hours" value={plural(data.accounts.new24h, "signup")} note={`${plural(data.documents.completed24h, "document")} completed`} />
    </>
  );
}

// A chart's heading, with the period's total set large beside it
function ChartHead({ title, note, total, color }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <p className="text-sm text-ink-muted mt-0.5">{note}</p>
      </div>
      {total !== undefined && (
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-ink leading-none">{total}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />
            In period
          </p>
        </div>
      )}
    </div>
  );
}

export default function Overview() {
  const admin = useAdmin();
  const [query, setQuery] = useQueryState({ range: "30d", view: "pulse", docs: "documentsCompleted" });
  const { data, error, loading, reload } = useFetch("/admin/overview", { range: query.range });

  const days = Number.parseInt(query.range, 10) || 30;
  const attention = data ? attentionOf(data.attention) : [];
  const docSeries = DOCUMENT_SERIES.find(([id]) => id === query.docs) || DOCUMENT_SERIES[0];
  const series = (key) => (data ? data.days.map((d) => ({ key: d.day, label: shortDay(d.day), value: d[key] })) : []);
  const statuses = data ? admin.documentStatuses.filter((status) => data.documents.byStatus[status]) : [];
  const largestStatus = data ? Math.max(1, ...statuses.map((s) => data.documents.byStatus[s])) : 1;
  const paidTotal = data ? Math.max(1, data.plans.reduce((sum, row) => sum + row.accounts, 0)) : 1;

  return (
    <>
      {/* The greeting, and what the whole page is about */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            {greeting(new Date())},{" "}
            <span className="whitespace-nowrap">
              {firstNameOf(admin.admin)} <span aria-hidden="true">👋</span>
            </span>
          </h1>
          <p className="text-base text-ink-muted mt-2">Here&apos;s what&apos;s happening on PactDoc{data ? `, as of ${dateTime(data.asOf)}` : ""}.</p>
        </div>

        <div className="panel self-start flex flex-wrap items-center gap-2 p-2">
          <span className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-surface-panel border border-edge text-sm text-ink tabular-nums">
            <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {data ? (
              <>
                {day(`${data.days[0].day}T12:00:00Z`)} <span className="text-ink-faint">→</span> {day(`${data.days[data.days.length - 1].day}T12:00:00Z`)}
              </>
            ) : (
              <Skeleton className="h-3 w-40" />
            )}
          </span>
          <Segmented label="Period" options={RANGES} value={query.range} onChange={(range) => setQuery({ range })} />
          <Button onClick={reload} busy={loading} title="Refresh">
            <Icon d={ICONS.refresh} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
          <Button variant="primary" onClick={() => exportDays(data)} disabled={!data}>
            <Icon d={ICONS.download} className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}

      {/* Which set of figures */}
      <div role="tablist" aria-label="Figures" className="flex items-center gap-6 border-b border-line">
        {VIEWS.map(([id, label, icon]) => {
          const on = query.view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setQuery({ view: id })}
              className={`relative -mb-px inline-flex items-center gap-2 pb-3 text-xs font-bold uppercase tracking-[0.12em] transition ${on ? "text-accent" : "text-ink-muted hover:text-ink"}`}
            >
              <Icon d={icon} className="w-4 h-4" />
              {label}
              {on && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {data ? (
          <Tiles data={data} view={query.view} days={days} />
        ) : (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="panel p-5 space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24 block" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="panel p-5 sm:p-6">
          <ChartHead title="Account growth" note="New accounts each day" total={data ? count(data.period.signups) : undefined} color={SERIES.signups} />
          <div className="mt-4">{data ? <BarChart variant="area" label="New accounts" color={SERIES.signups} data={series("signups")} /> : <Skeleton className="h-60 w-full block" />}</div>
        </section>
        <section className="panel p-5 sm:p-6">
          <ChartHead title="Revenue" note="Money received each day, in rupees" total={data ? inr(data.period.received) : undefined} color={SERIES.received} />
          <div className="mt-4">{data ? <BarChart label="Money received" format={inr} color={SERIES.received} data={series("received")} /> : <Skeleton className="h-60 w-full block" />}</div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="panel p-5 sm:p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Document activity</h2>
              <p className="text-sm text-ink-muted mt-0.5">Documents {docSeries[1].toLowerCase()} each day, counted by the day in India</p>
            </div>
            <Segmented size="sm" label="Which documents" options={DOCUMENT_SERIES} value={docSeries[0]} onChange={(docs) => setQuery({ docs })} />
          </div>
          <div className="mt-4">
            {data ? <BarChart variant="area" label={`Documents ${docSeries[1].toLowerCase()}`} color={SERIES[docSeries[0]]} height={330} data={series(docSeries[0])} /> : <Skeleton className="h-60 w-full block" />}
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">Document pipeline</h2>
          <p className="text-sm text-ink-muted mt-0.5">{data ? `${count(data.documents.total)} in all, not counting deleted or test documents` : "Loading…"}</p>
          {data && statuses.length === 0 && <p className="text-sm text-ink-muted mt-6">None yet.</p>}
          <ul className="mt-5 space-y-4">
            {statuses.map((status) => {
              const n = data.documents.byStatus[status];
              const tone = toneOf("document", status);
              return (
                <li key={status}>
                  <Link to={`/documents?status=${status}&show=live`} className="group block">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-ink group-hover:text-white">
                        <span className="w-2 h-2 rounded-full" style={{ background: TONE_BAR[tone] }} aria-hidden="true" />
                        {labelOf("document", status)}
                      </span>
                      <span className="tabular-nums text-ink font-bold">
                        {count(n)}
                        <span className="ml-2 text-xs font-normal text-ink-faint">{((n / Math.max(1, data.documents.total)) * 100).toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden" aria-hidden="true">
                      <div className="h-full rounded-full transition-all group-hover:brightness-125" style={{ width: `${Math.max(2, (n / largestStatus) * 100)}%`, background: TONE_BAR[tone] }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {data && (
        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          <Card title="Plans" note="Accounts whose plan is active or has a payment overdue." className="2xl:col-span-2" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="thead-row whitespace-nowrap">
                    <th scope="col" className="px-6 py-3">Plan</th>
                    <th scope="col" className="px-6 py-3">Price</th>
                    <th scope="col" className="px-6 py-3 text-right">Accounts</th>
                    <th scope="col" className="px-6 py-3 text-right">Given by an admin</th>
                    <th scope="col" className="px-6 py-3 text-right">Worth a month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3.5 text-ink">{admin.planName("free")}</td>
                    <td className="px-6 py-3.5 text-ink-muted whitespace-nowrap">{planPrice(admin.planOf("free"))}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{count(data.accounts.free)}</td>
                    <td className="px-6 py-3.5 text-right text-ink-muted">—</td>
                    <td className="px-6 py-3.5 text-right text-ink-muted">—</td>
                  </tr>
                  {data.plans.map((row) => {
                    const plan = admin.planOf(row.plan);
                    return (
                      <tr key={row.plan} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-3.5 text-ink whitespace-nowrap">
                          <Link to={`/users?plan=${row.plan}`} className="font-medium hover:text-white hover:underline underline-offset-2">
                            {admin.planName(row.plan)}
                          </Link>
                          {plan?.legacy && <span className="text-ink-faint"> · no longer sold</span>}
                          <div className="mt-1.5 h-1 w-28 rounded-full bg-white/[0.05] overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-accent/80" style={{ width: `${(row.accounts / paidTotal) * 100}%` }} />
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-ink-muted whitespace-nowrap">{planPrice(plan)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums whitespace-nowrap">
                          {count(row.accounts)}
                          {plan?.perSeat && row.accounts > 0 && <span className="text-ink-faint"> · {plural(row.seats, "seat")}</span>}
                          {row.pastDue > 0 && <span className="text-amber-300"> · {count(row.pastDue)} overdue</span>}
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums">{row.complimentary ? count(row.complimentary) : <span className="text-ink-muted">—</span>}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums font-medium">{row.monthlyValue ? inr(row.monthlyValue) : <span className="text-ink-muted font-normal">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">Needs attention</h2>
              {attention.length > 0 && <span className="rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-xs font-bold text-amber-300">{attention.length}</span>}
            </div>
            {attention.length === 0 ? (
              <div className="mt-6 flex flex-col items-center text-center py-6">
                <span className="grid place-items-center w-12 h-12 rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30">
                  <Icon d={ICONS.check} className="w-6 h-6" />
                </span>
                <p className="mt-3 text-sm font-bold text-ink">All clear</p>
                <p className="text-sm text-ink-muted">Nothing needs attention.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {attention.map((item) => (
                  <li key={item.text}>
                    <Link to={item.to} className="group flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2.5 text-sm hover:border-amber-400/40 hover:bg-amber-400/[0.09]">
                      <span className="grid place-items-center w-8 h-8 shrink-0 rounded-lg bg-amber-400/15 text-amber-300">
                        <Icon d={ICONS.warning} className="w-4 h-4" />
                      </span>
                      <span className="flex-1 text-ink">{item.text}</span>
                      <span className="text-ink-faint group-hover:text-ink">
                        <Icon d={ICONS.arrowRight} className="w-4 h-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
