import { Link } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { downloadFile, errorText } from "../api/admin.api.js";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { dateTime, inr, labelOf, plural, toneOf, words } from "../lib/format.js";
import { Badge, Button, Card, Field, FilterChip, Filters, Input, PageHeader, Select } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";
import { useToast } from "../components/ui/Toast.jsx";

export default function Payments() {
  const admin = useAdmin();
  const toast = useToast();
  const [query, setQuery] = useQueryState({ kind: "", provider: "", user: "", from: "", to: "", page: "1" });
  const { data, error, loading, reload } = useFetch("/admin/payments", query);

  const what = (payment) => {
    if (payment.plan) return `${admin.planName(payment.plan)}${payment.seats ? `, ${plural(payment.seats, "seat")}` : ""}`;
    return payment.item ? words(payment.item) : "";
  };

  const columns = [
    { key: "when", header: "When", className: "whitespace-nowrap text-ink-muted", render: (payment) => dateTime(payment.occurredAt) },
    {
      key: "account",
      header: "Account",
      render: (payment) =>
        payment.account ? (
          <>
            <Link to={`/users/${payment.account.id}`} className="text-ink hover:underline">
              {payment.account.name}
            </Link>
            <div className="text-xs text-ink-muted break-all">{payment.account.email}</div>
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "kind",
      header: "For",
      render: (payment) => (
        <>
          <Badge tone={toneOf("payment", payment.kind)}>{labelOf("payment", payment.kind)}</Badge>
          <div className="text-xs text-ink-muted mt-1">{what(payment)}</div>
        </>
      ),
    },
    { key: "provider", header: "Through", className: "text-ink-muted", render: (payment) => words(payment.provider) },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      render: (payment) => (String(payment.currency).toUpperCase() === "INR" ? inr(payment.amount) : `${payment.amount} ${String(payment.currency).toUpperCase()}`),
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (payment) =>
        payment.invoice ? (
          <Button
            size="sm"
            onClick={() => downloadFile(`/admin/invoices/${payment.invoice.id}/pdf`, `${payment.invoice.number.replace(/\//g, "-")}.pdf`).catch((err) => toast.error(errorText(err, "The invoice could not be downloaded.")))}
          >
            {payment.invoice.number}
          </Button>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Payments" note="What the payment providers reported, newest first. Refunds are made in the provider's own dashboard." />

      <Filters>
        <Field label="For">
          <Select value={query.kind} onChange={(event) => setQuery({ kind: event.target.value })}>
            <option value="">Everything</option>
            {admin.paymentKinds.map((kind) => (
              <option key={kind} value={kind}>
                {labelOf("payment", kind)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Through">
          <Select value={query.provider} onChange={(event) => setQuery({ provider: event.target.value })}>
            <option value="">Any provider</option>
            <option value="razorpay">Razorpay</option>
            <option value="stripe">Stripe</option>
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={query.from} max={query.to || undefined} onChange={(event) => setQuery({ from: event.target.value })} />
        </Field>
        <Field label="To">
          <Input type="date" value={query.to} min={query.from || undefined} onChange={(event) => setQuery({ to: event.target.value })} />
        </Field>
        {query.user && <FilterChip onClear={() => setQuery({ user: "" })}>One account's payments</FilterChip>}
      </Filters>

      <Card flush>
        <DataTable label="Payments" columns={columns} rows={data?.items} loading={loading} error={error} onRetry={reload} empty="No payment matches." />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>
    </>
  );
}
