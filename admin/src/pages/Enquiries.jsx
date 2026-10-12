import { useState } from "react";
import { adminApi, errorText } from "../api/admin.api.js";
import { useFetch, useQueryState } from "../lib/hooks.js";
import { dateTime, plural } from "../lib/format.js";
import { Badge, Button, Card, Details, Field, Filters, PageHeader, Select, Textarea } from "../components/ui/basics.jsx";
import DataTable, { Pagination } from "../components/ui/DataTable.jsx";
import Dialog from "../components/ui/Dialog.jsx";
import { useToast } from "../components/ui/Toast.jsx";

// How far an enquiry has got, with the colour that says so
const STATUSES = {
  new: ["amber", "New"],
  contacted: ["blue", "Contacted"],
  closed: ["neutral", "Closed"],
};

const SIZES = { "1-10": "1 to 10 people", "11-50": "11 to 50 people", "51-200": "51 to 200 people", "201+": "More than 200 people" };

// One enquiry in full, with where it has got to and what was noted about it
function EnquiryDialog({ enquiry, onClose, onSaved }) {
  const [status, setStatus] = useState(enquiry.status);
  const [note, setNote] = useState(enquiry.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    const changes = { ...(status !== enquiry.status ? { status } : {}), ...(note.trim() !== (enquiry.note || "") ? { note: note.trim() } : {}) };
    if (Object.keys(changes).length === 0) return onClose();
    try {
      setBusy(true);
      setError("");
      const res = await adminApi.patch(`/admin/sales-enquiries/${enquiry.id}`, changes);
      onSaved(res.data.message);
    } catch (err) {
      setError(errorText(err, "The enquiry could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title={`Enquiry from ${enquiry.name}`}
      onClose={onClose}
      busy={busy}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="enquiry-form" busy={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="enquiry-form" onSubmit={save} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="notice notice-red">
            {error}
          </p>
        )}
        <Details
          rows={[
            [
              "Email",
              <a key="email" href={`mailto:${enquiry.email}`} className="text-ink underline underline-offset-2 hover:text-white break-all">
                {enquiry.email}
              </a>,
            ],
            enquiry.company && ["Company", enquiry.company],
            enquiry.teamSize && ["Who would use it", SIZES[enquiry.teamSize] || enquiry.teamSize],
            enquiry.planName && ["Asked about", enquiry.planName],
            ["Sent", dateTime(enquiry.createdAt)],
          ].filter(Boolean)}
        />
        {enquiry.message && <p className="notice whitespace-pre-wrap leading-relaxed">{enquiry.message}</p>}

        <Field label="Where it has got to">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(STATUSES).map(([value, [, label]]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" help="For the other admins: who replied, what was agreed, what happens next.">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} />
        </Field>
      </form>
    </Dialog>
  );
}

/**
 * People who sent the "Contact sales" form, on the pricing page or on Billing, about a plan
 * that is agreed with us and not bought with a button. Each is answered by email, and marked
 * here so that none is answered twice or left waiting.
 */
export default function Enquiries() {
  const toast = useToast();
  const [query, setQuery] = useQueryState({ status: "", page: "1" });
  const { data, error, loading, reload } = useFetch("/admin/sales-enquiries", query);
  const [opened, setOpened] = useState(null);

  const columns = [
    {
      key: "who",
      header: "From",
      render: (enquiry) => (
        <>
          <span className="font-medium text-ink">{enquiry.name}</span>
          <div className="text-xs text-ink-muted break-all">{enquiry.email}</div>
        </>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (enquiry) =>
        enquiry.company || enquiry.teamSize ? (
          <>
            <span className="text-ink">{enquiry.company || "—"}</span>
            {enquiry.teamSize && <div className="text-xs text-ink-muted">{SIZES[enquiry.teamSize] || enquiry.teamSize}</div>}
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    { key: "message", header: "Message", className: "max-w-sm", render: (enquiry) => <span className="line-clamp-2 text-ink-muted">{enquiry.message || "—"}</span> },
    {
      key: "status",
      header: "Status",
      render: (enquiry) => {
        const [tone, label] = STATUSES[enquiry.status] || STATUSES.new;
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    { key: "sent", header: "Sent", className: "whitespace-nowrap text-ink-muted", render: (enquiry) => dateTime(enquiry.createdAt) },
    {
      key: "action",
      header: "",
      align: "right",
      render: (enquiry) => (
        <Button size="sm" onClick={() => setOpened(enquiry)} aria-label={`Open the enquiry from ${enquiry.name}`}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Enquiries"
        note={`People who asked to talk to sales about a plan.${data ? ` ${data.waiting === 0 ? "None is waiting for an answer." : `${plural(data.waiting, "enquiry", "enquiries")} waiting for an answer.`}` : ""}`}
      />

      <Filters>
        <Field label="Status">
          <Select value={query.status} onChange={(event) => setQuery({ status: event.target.value })}>
            <option value="">All</option>
            {Object.entries(STATUSES).map(([status, [, label]]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </Filters>

      <Card flush>
        <DataTable label="Enquiries" columns={columns} rows={data?.items} loading={loading} error={error} onRetry={reload} empty="No enquiry matches." />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ page })} />}
      </Card>

      {opened && (
        <EnquiryDialog
          enquiry={opened}
          onClose={() => setOpened(null)}
          onSaved={(message) => {
            setOpened(null);
            toast.ok(message);
            reload();
          }}
        />
      )}
    </>
  );
}
