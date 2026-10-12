import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { useFetch, useQueryState, useSearchBox } from "../lib/hooks.js";
import { count, day, labelOf, toneOf } from "../lib/format.js";
import { Badge, Card, Field, Filters, Input, PageHeader, Select } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";

const STATES = ["active", "unverified", "suspended", "closed"];

export default function Users() {
  const admin = useAdmin();
  const [query, setQuery] = useQueryState({ search: "", plan: "", status: "", sort: "createdAt", order: "desc", page: "1" });
  const [search, setSearch] = useSearchBox(query.search, (text) => setQuery({ search: text }));
  const { data, error, loading, reload } = useFetch("/admin/users", query);

  const columns = [
    {
      key: "name",
      header: "Account",
      sort: "name",
      render: (user) => (
        <>
          <Link to={`/users/${user.id}`} className="font-medium text-ink hover:underline">
            {user.name}
          </Link>
          <div className="text-xs text-ink-muted break-all">{user.email}</div>
        </>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sort: "plan",
      render: (user) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ink">{admin.planName(user.plan)}</span>
          {user.complimentary && <Badge>Given by an admin</Badge>}
          {user.planStatus === "past_due" && <Badge tone="amber">{labelOf("subscription", "past_due")}</Badge>}
        </div>
      ),
    },
    {
      key: "used",
      header: "Used this month",
      render: (user) =>
        user.unlimited ? (
          <span className="text-ink-muted">{count(user.usedThisMonth)} · no limit</span>
        ) : (
          <span className={user.usedThisMonth >= user.monthlyQuota ? "text-amber-300" : "text-ink"}>
            {count(user.usedThisMonth)} of {count(user.monthlyQuota)}
          </span>
        ),
    },
    {
      key: "documents",
      header: "Documents",
      align: "right",
      className: "tabular-nums",
      render: (user) => (
        <>
          {count(user.documents.total)} <span className="text-ink-faint">· {count(user.documents.signed)} completed</span>
        </>
      ),
    },
    { key: "state", header: "State", render: (user) => <Badge tone={toneOf("account", user.state)}>{labelOf("account", user.state)}</Badge> },
    { key: "createdAt", header: "Joined", sort: "createdAt", className: "whitespace-nowrap text-ink-muted", render: (user) => day(user.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Users" note="Customer accounts. Admin accounts are not listed." />

      <Filters>
        <Field label="Search" className="w-full sm:w-72">
          <Input type="search" placeholder="Name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Field>
        <Field label="Plan">
          <Select value={query.plan} onChange={(event) => setQuery({ plan: event.target.value })}>
            <option value="">All plans</option>
            {admin.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.label || plan.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="State">
          <Select value={query.status} onChange={(event) => setQuery({ status: event.target.value })}>
            <option value="">All states</option>
            {STATES.map((state) => (
              <option key={state} value={state}>
                {labelOf("account", state)}
              </option>
            ))}
          </Select>
        </Field>
      </Filters>

      <Card flush>
        <DataTable
          label="Users"
          columns={columns}
          rows={data?.items}
          rowTo={(user) => `/users/${user.id}`}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No account matches."
          sort={query.sort}
          order={query.order}
          onSort={(sort, order) => setQuery({ sort, order })}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>
    </>
  );
}
