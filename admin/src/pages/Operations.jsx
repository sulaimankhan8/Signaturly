import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, errorText } from "../api/admin.api.js";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { count, dateTime, labelOf, toneOf, words } from "../lib/format.js";
import { Badge, Button, Card, Details, ErrorNote, Field, Filters, PageHeader, Select, Skeleton } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";
import { ConfirmDialog } from "../components/ui/Dialog.jsx";
import { useToast } from "../components/ui/Toast.jsx";

const SWITCHES = [
  ["billing", "Taking payments"],
  ["messaging", "SMS and WhatsApp"],
  ["usageCharging", "Charging wallets for messages"],
  ["unreviewedTemplates", "Offering templates no lawyer has reviewed"],
  ["aadhaarEsign", "Aadhaar eSign"],
  ["adminTwoStep", "Two-step sign-in required for admins"],
  ["publicPageRebuild", "Rebuilding public pages when templates change"],
];

const JOB_STATUSES = ["failed", "pending", "running", "done"];

export default function Operations() {
  const toast = useToast();
  const system = useFetch("/admin/system");
  const [query, setQuery] = useQueryState({ status: "", type: "", page: "1", deliveries: "failed", dpage: "1" });
  const jobs = useFetch("/admin/jobs", { status: query.status, type: query.type, page: query.page });
  const deliveries = useFetch("/admin/webhook-deliveries", { status: query.deliveries === "all" ? "" : query.deliveries, page: query.dpage, pageSize: 10 });
  const [retrying, setRetrying] = useState(null);
  const [busy, setBusy] = useState(false);

  const runAgain = async () => {
    try {
      setBusy(true);
      const res = await adminApi.post(`/admin/jobs/${retrying.id}/retry`);
      const result = res.data.data;
      if (result.status === "done") toast.ok("The job ran and finished.");
      else toast.error(`The job was tried and did not finish${result.lastError ? `: ${result.lastError}` : "."} It will be tried again by itself.`);
      setRetrying(null);
      jobs.reload();
      system.reload();
    } catch (err) {
      toast.error(errorText(err, "The job could not be run again."));
    } finally {
      setBusy(false);
    }
  };

  const s = system.data;
  const waitingSince = s?.jobs.oldestWaiting;
  // A due job that has waited more than a few minutes means nothing is running the queue
  const stalled = waitingSince && new Date(s.asOf).getTime() - new Date(waitingSince.since).getTime() > 10 * 60 * 1000;

  const jobColumns = [
    { key: "created", header: "Queued", className: "whitespace-nowrap text-ink-muted", render: (job) => dateTime(job.createdAt) },
    { key: "type", header: "Job", render: (job) => <span className="font-mono text-xs text-ink">{job.type}</span> },
    { key: "status", header: "Status", render: (job) => <Badge tone={toneOf("job", job.status)}>{labelOf("job", job.status)}</Badge> },
    { key: "attempts", header: "Tries", align: "right", className: "tabular-nums", render: (job) => `${job.attempts} of ${job.maxAttempts}` },
    { key: "error", header: "Last error", className: "text-ink-muted max-w-md break-words", render: (job) => job.lastError || "—" },
    {
      key: "action",
      header: "",
      align: "right",
      render: (job) =>
        job.status === "failed" && (
          <Button size="sm" onClick={() => setRetrying(job)}>
            Run again
          </Button>
        ),
    },
  ];

  const deliveryColumns = [
    { key: "created", header: "When", className: "whitespace-nowrap text-ink-muted", render: (d) => dateTime(d.createdAt) },
    { key: "event", header: "Event", render: (d) => <span className="font-mono text-xs text-ink">{d.event}</span> },
    {
      key: "account",
      header: "Account",
      render: (d) =>
        d.account ? (
          <Link to={`/users/${d.account.id}`} className="text-ink hover:underline break-all">
            {d.account.email}
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    { key: "url", header: "Sent to", className: "text-ink-muted break-all max-w-xs", render: (d) => d.url || "A webhook since removed" },
    { key: "status", header: "Status", render: (d) => <Badge tone={toneOf("delivery", d.status)}>{labelOf("delivery", d.status)}</Badge> },
    { key: "error", header: "Answer", className: "text-ink-muted break-words max-w-xs", render: (d) => [d.responseStatus && `HTTP ${d.responseStatus}`, d.lastError].filter(Boolean).join(" · ") || "—" },
  ];

  return (
    <>
      <PageHeader
        title="Operations"
        note={s ? `How the service is running, as of ${dateTime(s.asOf)}` : "How the service is running"}
        actions={
          <Button
            onClick={() => {
              system.reload();
              jobs.reload();
              deliveries.reload();
            }}
            busy={system.loading}
          >
            Refresh
          </Button>
        }
      />

      {system.error && <ErrorNote onRetry={system.reload}>{system.error}</ErrorNote>}
      {stalled && (
        <div role="alert" className="notice notice-amber">
          A {waitingSince.type} job has been due since {dateTime(waitingSince.since)} and has not run. The scheduler that runs the queue may have stopped calling in.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Service">
          {s ? (
            <Details
              rows={[
                ["Database", <Badge key="db" tone={s.database === "connected" ? "green" : "red"}>{words(s.database)}</Badge>],
                ["Running since", dateTime(s.startedAt)],
                ["Version", [s.version, s.revision].filter(Boolean).join(" · ") || "Unknown"],
                ["Environment", words(s.environment)],
                ["Files kept in", s.storage === "local" ? "This server's disk" : words(s.storage)],
                ["Node", s.node],
                ["Jobs", JOB_STATUSES.filter((status) => s.jobs.byStatus[status]).map((status) => `${count(s.jobs.byStatus[status])} ${labelOf("job", status).toLowerCase()}`).join(" · ") || "None on record"],
                ["Webhooks, last 24 hours", ["delivered", "pending", "failed"].filter((status) => s.deliveries24h[status]).map((status) => `${count(s.deliveries24h[status])} ${status}`).join(" · ") || "None sent"],
              ]}
            />
          ) : (
            <Skeleton className="h-48 w-full block" />
          )}
        </Card>

        <Card title="Switched on" note="Set by the server's configuration. Nothing here can be changed from the admin app.">
          {s ? (
            <ul className="space-y-2.5 text-sm">
              {SWITCHES.map(([key, label]) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span className="text-ink">{label}</span>
                  <Badge tone={s.switchedOn[key] ? "green" : "neutral"}>{s.switchedOn[key] ? "On" : "Off"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Skeleton className="h-48 w-full block" />
          )}
        </Card>
      </div>

      <Card
        title="Background jobs"
        note="Emails, messages, sealing and webhooks. Finished jobs are kept for 30 days."
        actions={
          <Filters>
            <Field label="Status">
              <Select value={query.status} onChange={(event) => setQuery({ status: event.target.value })}>
                <option value="">All</option>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {labelOf("job", status)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Job">
              <Select value={query.type} onChange={(event) => setQuery({ type: event.target.value })}>
                <option value="">All</option>
                {(jobs.data?.types || []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
          </Filters>
        }
        flush
      >
        <DataTable label="Background jobs" columns={jobColumns} rows={jobs.data?.items} loading={jobs.loading} error={jobs.error} onRetry={jobs.reload} empty="No job matches." />
        {jobs.data && <Pagination page={jobs.data.page} pageSize={jobs.data.pageSize} total={jobs.data.total} onPage={(page) => setQuery({ page, dpage: query.dpage })} />}
      </Card>

      <Card
        title="Webhook deliveries"
        note="Events sent to customers' own servers. Kept for 30 days; a customer can send one again from their Developer settings."
        actions={
          <Field label="Status">
            <Select value={query.deliveries} onChange={(event) => setQuery({ deliveries: event.target.value || "all", page: query.page })}>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
              <option value="all">All</option>
            </Select>
          </Field>
        }
        flush
      >
        <DataTable label="Webhook deliveries" columns={deliveryColumns} rows={deliveries.data?.items} loading={deliveries.loading} error={deliveries.error} onRetry={deliveries.reload} empty="No delivery matches." />
        {deliveries.data && <Pagination page={deliveries.data.page} pageSize={deliveries.data.pageSize} total={deliveries.data.total} onPage={(dpage) => setQuery({ dpage, page: query.page })} />}
      </Card>

      <ConfirmDialog open={Boolean(retrying)} title="Run this job again?" confirmText="Run again" busy={busy} onCancel={() => setRetrying(null)} onConfirm={runAgain}>
        {retrying && (
          <>
            <span className="font-mono text-xs text-ink">{retrying.type}</span> gave up after {retrying.attempts} tries. It will be given a fresh set of tries and run now.
            {retrying.lastError && <span className="block mt-2">Last error: {retrying.lastError}</span>}
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
