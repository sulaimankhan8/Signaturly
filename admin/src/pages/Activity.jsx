import { Link } from "react-router-dom";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { dateTime, words } from "../lib/format.js";
import { Card, Field, FilterChip, Filters, Mono, PageHeader, Select } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";

// Where the thing an action was about can be opened
const targetLink = (line) => {
  if (!line.targetId) return null;
  if (line.targetType === "user") return `/users/${line.targetId}`;
  if (line.targetType === "document") return `/documents/${line.targetId}`;
  if (line.targetType === "plan") return "/plans";
  if (line.targetType === "enquiry") return "/enquiries";
  return null;
};

export default function Activity() {
  const [query, setQuery] = useQueryState({ action: "", target: "", page: "1" });
  const { data, error, loading, reload } = useFetch("/admin/activity", query);

  const columns = [
    { key: "at", header: "When", className: "whitespace-nowrap text-ink-muted", render: (line) => dateTime(line.at) },
    { key: "admin", header: "Admin", className: "break-all", render: (line) => line.adminEmail || <span className="text-ink-muted">Not signed in</span> },
    {
      key: "what",
      header: "What",
      render: (line) => (
        <>
          <span className="text-ink">{line.summary || words(line.action)}</span>
          {targetLink(line) && (
            <div className="text-xs mt-0.5">
              <Link to={targetLink(line)} className="text-ink-muted underline underline-offset-2 hover:text-ink">
                Open the {line.targetType}
              </Link>
            </div>
          )}
        </>
      ),
    },
    { key: "ip", header: "From", render: (line) => (line.ipAddress ? <Mono>{line.ipAddress}</Mono> : <span className="text-ink-muted">—</span>) },
  ];

  return (
    <>
      <PageHeader title="Admin activity" note="What admins did in this app, newest first: sign-ins, plan changes, accounts and documents opened, files downloaded. Lines can be added and never changed." />

      <Filters>
        <Field label="Action">
          <Select value={query.action} onChange={(event) => setQuery({ action: event.target.value })}>
            <option value="">All actions</option>
            {(data?.actions || []).map((action) => (
              <option key={action} value={action}>
                {words(action)}
              </option>
            ))}
          </Select>
        </Field>
        {query.target && <FilterChip onClear={() => setQuery({ target: "" })}>About one account or document</FilterChip>}
      </Filters>

      <Card flush>
        <DataTable label="Admin activity" columns={columns} rows={data?.items} loading={loading} error={error} onRetry={reload} empty="Nothing has been recorded." />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>
    </>
  );
}
