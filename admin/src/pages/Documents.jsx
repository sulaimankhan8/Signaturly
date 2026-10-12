import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { useFetch, useQueryState, useSearchBox } from "../lib/hooks.js";
import { count, day, labelOf, toneOf } from "../lib/format.js";
import { Badge, Card, Field, FilterChip, Filters, Input, PageHeader, Select } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";

export default function Documents() {
  const admin = useAdmin();
  const [query, setQuery] = useQueryState({ search: "", status: "", show: "", owner: "", page: "1" });
  const [search, setSearch] = useSearchBox(query.search, (text) => setQuery({ search: text }));
  const { data, error, loading, reload } = useFetch("/admin/documents", query);

  const columns = [
    {
      key: "name",
      header: "Document",
      render: (doc) => (
        <>
          <Link to={`/documents/${doc.id}`} className="font-medium text-ink hover:underline break-all">
            {doc.name}
          </Link>
          {doc.template && <div className="text-xs text-ink-muted">From the template {doc.template}</div>}
        </>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (doc) =>
        doc.owner ? (
          <>
            <Link to={`/users/${doc.owner.id}`} className="text-ink hover:underline">
              {doc.owner.name}
            </Link>
            <div className="text-xs text-ink-muted break-all">{doc.owner.email}</div>
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (doc) => (
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={toneOf("document", doc.status)}>{labelOf("document", doc.status)}</Badge>
          {doc.deletedAt && <Badge>Deleted</Badge>}
          {doc.testMode && <Badge>Test</Badge>}
        </span>
      ),
    },
    { key: "signers", header: "Signers", align: "right", className: "tabular-nums", render: (doc) => count(doc.signers) },
    { key: "sealed", header: "Sealed", render: (doc) => (doc.sealed ? "Yes" : doc.status === "signed" ? <span className="text-amber-300">Not yet</span> : <span className="text-ink-muted">—</span>) },
    { key: "createdAt", header: "Created", className: "whitespace-nowrap text-ink-muted", render: (doc) => day(doc.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Documents" note="Details of every document. What a document says is never shown here." />

      <Filters>
        <Field label="Search" className="w-full sm:w-72">
          <Input type="search" placeholder="File name, or the owner's name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={query.status} onChange={(event) => setQuery({ status: event.target.value })}>
            <option value="">All statuses</option>
            {admin.documentStatuses.map((status) => (
              <option key={status} value={status}>
                {labelOf("document", status)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Show">
          <Select value={query.show} onChange={(event) => setQuery({ show: event.target.value })}>
            <option value="">Everything</option>
            <option value="live">Not deleted, not test</option>
            <option value="deleted">Deleted by the owner</option>
            <option value="test">Made with a test API key</option>
          </Select>
        </Field>
        {query.owner && <FilterChip onClear={() => setQuery({ owner: "" })}>One account's documents</FilterChip>}
      </Filters>

      <Card flush>
        <DataTable label="Documents" columns={columns} rows={data?.items} rowTo={(doc) => `/documents/${doc.id}`} loading={loading} error={error} onRetry={reload} empty="No document matches." />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>
    </>
  );
}
