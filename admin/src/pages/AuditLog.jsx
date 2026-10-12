import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { dateTime, words } from "../lib/format.js";
import { Card, Field, FilterChip, Filters, Input, Mono, PageHeader, Select } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";

export default function AuditLog() {
  const admin = useAdmin();
  const [query, setQuery] = useQueryState({ event: "", document: "", from: "", to: "", page: "1" });
  const { data, error, loading, reload } = useFetch("/admin/audit-logs", query);

  const columns = [
    { key: "at", header: "When", className: "whitespace-nowrap text-ink-muted", render: (entry) => dateTime(entry.at) },
    {
      key: "event",
      header: "Event",
      render: (entry) => (
        <>
          <span className="text-ink">{words(entry.event)}</span>
          {entry.description && <div className="text-xs text-ink-muted">{entry.description}</div>}
        </>
      ),
    },
    {
      key: "document",
      header: "Document",
      render: (entry) =>
        entry.document ? (
          <Link to={`/documents/${entry.document.id}`} className="text-ink hover:underline break-all">
            {entry.document.name}
          </Link>
        ) : (
          <span className="text-ink-muted">No longer on record</span>
        ),
    },
    {
      key: "who",
      header: "Who",
      render: (entry) =>
        entry.actorName || entry.actorEmail ? (
          <>
            {entry.actorName}
            {entry.actorEmail && <div className="text-xs text-ink-muted break-all">{entry.actorEmail}</div>}
          </>
        ) : (
          <span className="text-ink-muted">The service</span>
        ),
    },
    { key: "ip", header: "From", render: (entry) => (entry.ipAddress ? <Mono>{entry.ipAddress}</Mono> : <span className="text-ink-muted">—</span>) },
  ];

  return (
    <>
      <PageHeader title="Audit log" note="What happened to every document, newest first. Entries can be added and never changed; a document's page checks its chain." />

      <Filters>
        <Field label="Event">
          <Select value={query.event} onChange={(event) => setQuery({ event: event.target.value })}>
            <option value="">All events</option>
            {admin.auditEvents.map((name) => (
              <option key={name} value={name}>
                {words(name)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={query.from} max={query.to || undefined} onChange={(event) => setQuery({ from: event.target.value })} />
        </Field>
        <Field label="To">
          <Input type="date" value={query.to} min={query.from || undefined} onChange={(event) => setQuery({ to: event.target.value })} />
        </Field>
        {query.document && <FilterChip onClear={() => setQuery({ document: "" })}>One document</FilterChip>}
      </Filters>

      <Card flush>
        <DataTable
          label="Audit log"
          columns={columns}
          rows={data?.items}
          rowTo={(entry) => (entry.document ? `/documents/${entry.document.id}` : null)}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No event matches."
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>
    </>
  );
}
