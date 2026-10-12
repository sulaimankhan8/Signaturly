import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdmin } from "../auth/AdminAuth.jsx";
import { adminApi, downloadFile, errorText } from "../api/admin.api.js";
import { useFetch } from "../lib/hooks.js";
import { allowance, count, dateTime, day, inr, labelOf, paise, plural, toneOf, words } from "../lib/format.js";
import { Badge, Button, ButtonLink, Card, Details, EmptyState, ErrorNote, Field, PageHeader, Skeleton, Textarea } from "../components/ui/basics.jsx";
import Dialog, { ConfirmDialog } from "../components/ui/Dialog.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import PlanDialog from "../components/PlanDialog.jsx";

const yesNo = (value) => (value ? "Yes" : "No");

function Usage({ subscription }) {
  if (subscription.unlimited) return <span>{count(subscription.usedThisMonth)} this month, no limit</span>;
  const share = Math.min(100, Math.round((subscription.usedThisMonth / Math.max(1, subscription.monthlyQuota)) * 100));
  const full = subscription.usedThisMonth >= subscription.monthlyQuota;
  return (
    <div className="max-w-xs">
      <span>
        {count(subscription.usedThisMonth)} of {count(subscription.monthlyQuota)} this month
      </span>
      <div className="mt-1.5 h-3 rounded border-2 border-edge bg-surface-panel overflow-hidden" aria-hidden="true">
        <div className={`h-full ${full ? "bg-amber-400" : "bg-chart"}`} style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams();
  const admin = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(`/admin/users/${id}`);
  // Which dialog is open: "plan", "reset", "suspend", "restore", "stopRenewal" or none
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const close = () => {
    setDialog(null);
    setReason("");
    setReasonError("");
  };

  const act = async (request, fallback) => {
    try {
      setBusy(true);
      const res = await request();
      toast.ok(res.data.message);
      close();
      reload();
    } catch (err) {
      toast.error(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <>
        <PageHeader title="Account" back={{ to: "/users", label: "Users" }} />
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-56" />} back={{ to: "/users", label: "Users" }} />
        <Card>
          <Skeleton className="h-40 w-full block" />
        </Card>
      </>
    );
  }

  const { user, subscription, grants, payments, workspaces, documents } = data;
  const closed = user.state === "closed";
  const suspended = user.state === "suspended";
  const statusCounts = admin.documentStatuses.filter((status) => documents.byStatus[status]);

  return (
    <>
      <PageHeader
        title={user.name}
        back={{ to: "/users", label: "Users" }}
        note={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            <Badge tone={toneOf("account", user.state)}>{labelOf("account", user.state)}</Badge>
          </span>
        }
        actions={
          !closed && (
            <>
              <Button variant="primary" onClick={() => setDialog("plan")}>
                Change plan
              </Button>
              {!subscription.unlimited && (
                <Button onClick={() => setDialog("reset")} disabled={subscription.usedThisMonth === 0}>
                  Reset this month's count
                </Button>
              )}
              {subscription.autoRenew && <Button onClick={() => setDialog("stopRenewal")}>Turn off auto-renew</Button>}
              {suspended ? <Button onClick={() => setDialog("restore")}>Lift suspension</Button> : <Button onClick={() => setDialog("suspend")}>Suspend</Button>}
            </>
          )
        }
      />

      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}
      {suspended && (
        <div className="notice notice-red">
          Suspended on {dateTime(user.suspendedAt)}. Reason: {user.suspendedReason || "none given"}. The account cannot sign in; documents it already sent can still be signed.
        </div>
      )}
      {closed && <div className="notice">This account was closed by its owner on {day(user.closedAt)}. Its name and email were erased; completed agreements and their audit logs are kept.</div>}

      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${loading ? "opacity-70" : ""}`}>
        <Card title="Plan">
          <Details
            rows={[
              [
                "Plan",
                <span key="plan" className="flex flex-wrap items-center gap-1.5">
                  {admin.planName(subscription.plan)}
                  {subscription.plan !== "free" && <Badge tone={toneOf("subscription", subscription.status)}>{labelOf("subscription", subscription.status)}</Badge>}
                  {subscription.complimentary && <Badge>Given by an admin</Badge>}
                </span>,
              ],
              ["Allowance", allowance(subscription.unlimited ? null : subscription.monthlyQuota)],
              ["Used", <Usage key="used" subscription={subscription} />],
              subscription.extraDocuments > 0 && ["Extra documents bought", count(subscription.extraDocuments)],
              admin.planOf(subscription.plan)?.perSeat && ["Seats", count(subscription.seats)],
              subscription.currentPeriodEnd && [subscription.autoRenew ? "Renews automatically on" : subscription.cancelAtPeriodEnd ? "Will not renew, ends on" : "Paid or given until", day(subscription.currentPeriodEnd)],
              // The price when the customer subscribed, which a later change to the plan's price does not alter
              subscription.autoRenew && subscription.renewalAmountInr !== null && ["Each renewal charges", inr(subscription.renewalAmountInr)],
              subscription.gracePeriodEnd && ["Returns to Free on", day(subscription.gracePeriodEnd)],
              ["Count starts again on", day(subscription.quotaResetDate)],
              subscription.provider && ["Billed through", words(subscription.provider)],
              ["Wallet", paise(data.walletBalancePaise)],
            ]}
          />
        </Card>

        <Card title="Account">
          <Details
            rows={[
              ["Joined", dateTime(user.createdAt)],
              ["Email confirmed", yesNo(user.emailVerified)],
              ["Two-step sign-in", yesNo(user.twoFactor)],
              ["Terms accepted", user.termsAcceptedAt ? day(user.termsAcceptedAt) : "No"],
              user.billing?.legalName && ["Name on invoices", user.billing.legalName],
              user.billing?.gstin && ["GSTIN", user.billing.gstin],
              user.billing?.address && ["Billing address", user.billing.address],
              ["API keys in use", count(data.apiKeys)],
              ["Webhooks", count(data.webhooks)],
              [
                "Teams",
                workspaces.length === 0
                  ? "None"
                  : workspaces.map((w) => `${w.name} (${w.role}, ${plural(w.people, "person", "people")}${w.status === "active" ? "" : `, ${words(w.status).toLowerCase()}`})`).join("; "),
              ],
            ]}
          />
        </Card>
      </div>

      <Card
        title="Plan changes made by admins"
        actions={
          <ButtonLink size="sm" to={`/activity?target=${user.id}`}>
            Everything admins did on this account
          </ButtonLink>
        }
        flush
      >
        {grants.length === 0 ? (
          <EmptyState>No admin has changed this account's plan.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="thead-row">
                  <th scope="col" className="px-5 py-3 font-medium">When</th>
                  <th scope="col" className="px-5 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-5 py-3 font-medium">Until</th>
                  <th scope="col" className="px-5 py-3 font-medium">By</th>
                  <th scope="col" className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {grants.map((grant, index) => (
                  <tr key={index}>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">{dateTime(grant.at)}</td>
                    <td className="px-5 py-3">
                      {admin.planName(grant.plan)}
                      {grant.quota !== null && <span className="text-ink-faint"> · {allowance(grant.quota).toLowerCase()}</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{grant.periodEnd ? day(grant.periodEnd) : "—"}</td>
                    <td className="px-5 py-3 break-all">{grant.adminEmail || "—"}</td>
                    <td className="px-5 py-3 text-ink-muted">{grant.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Payments"
        note="The latest 20, as the payment providers reported them."
        actions={
          <ButtonLink size="sm" to={`/payments?user=${user.id}`}>
            All payments
          </ButtonLink>
        }
        flush
      >
        {payments.length === 0 ? (
          <EmptyState>This account has made no payment.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="thead-row">
                  <th scope="col" className="px-5 py-3 font-medium">When</th>
                  <th scope="col" className="px-5 py-3 font-medium">For</th>
                  <th scope="col" className="px-5 py-3 font-medium text-right">Amount</th>
                  <th scope="col" className="px-5 py-3 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">{dateTime(payment.occurredAt)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={toneOf("payment", payment.kind)}>{labelOf("payment", payment.kind)}</Badge>{" "}
                      <span className="text-ink-muted">{payment.plan ? admin.planName(payment.plan) : payment.item || ""}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{String(payment.currency).toUpperCase() === "INR" ? inr(payment.amount) : `${payment.amount} ${payment.currency}`}</td>
                    <td className="px-5 py-3">
                      {payment.invoice ? (
                        <Button
                          size="sm"
                          onClick={() => downloadFile(`/admin/invoices/${payment.invoice.id}/pdf`, `${payment.invoice.number.replace(/\//g, "-")}.pdf`).catch((err) => toast.error(errorText(err, "The invoice could not be downloaded.")))}
                        >
                          {payment.invoice.number}
                        </Button>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Documents"
        note={statusCounts.length === 0 ? "None." : statusCounts.map((status) => `${count(documents.byStatus[status])} ${labelOf("document", status).toLowerCase()}`).join(" · ")}
        actions={
          <ButtonLink size="sm" to={`/documents?owner=${user.id}`}>
            All documents
          </ButtonLink>
        }
        flush
      >
        {documents.recent.length === 0 ? (
          <EmptyState>This account has made no document.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {documents.recent.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link to={`/documents/${doc.id}`} className="text-ink hover:underline break-all">
                  {doc.name}
                </Link>
                <span className="flex items-center gap-2 text-ink-muted whitespace-nowrap">
                  {doc.deletedAt && <Badge>Deleted</Badge>}
                  <Badge tone={toneOf("document", doc.status)}>{labelOf("document", doc.status)}</Badge>
                  {day(doc.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dialog === "plan" && (
        <PlanDialog
          open
          user={user}
          subscription={subscription}
          plans={admin.plans}
          onClose={close}
          onSaved={(message) => {
            toast.ok(message);
            close();
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={dialog === "reset"}
        title="Reset this month's count?"
        confirmText="Reset the count"
        busy={busy}
        onCancel={close}
        onConfirm={() => act(() => adminApi.post(`/admin/users/${id}/reset-quota`), "The count could not be reset.")}
      >
        {user.name} has sent {plural(subscription.usedThisMonth, "document")} this month. The count goes back to 0, so the whole allowance can be used again before it next starts over on {day(subscription.quotaResetDate)}.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "restore"}
        title="Lift the suspension?"
        confirmText="Lift suspension"
        busy={busy}
        onCancel={close}
        onConfirm={() => act(() => adminApi.post(`/admin/users/${id}/restore`), "The suspension could not be lifted.")}
      >
        {user.name} will be able to sign in and send documents again.
      </ConfirmDialog>

      <Dialog
        open={dialog === "stopRenewal"}
        title="Turn off auto-renew?"
        onClose={close}
        busy={busy}
        footer={
          <>
            <Button onClick={close} disabled={busy} data-autofocus>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => {
                if (reason.trim().length < 3) return setReasonError("Give a reason.");
                act(() => adminApi.post(`/admin/users/${id}/auto-renew/stop`, { reason: reason.trim() }), "Auto-renew could not be turned off.");
              }}
            >
              Turn off auto-renew
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-ink-muted leading-relaxed">
            Nothing more is charged to {user.name}. The plan stays as it is until {day(subscription.currentPeriodEnd)}, the end of the time already paid for, and then the account moves to Free. Nothing is refunded; a refund is made in the payment
            provider's own dashboard. The customer is told by email and can subscribe again.
          </p>
          <Field label="Reason" help="Shown in the record of admin actions." error={reasonError}>
            <Textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "suspend"}
        title="Suspend this account?"
        onClose={close}
        busy={busy}
        footer={
          <>
            <Button onClick={close} disabled={busy} data-autofocus>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => {
                if (reason.trim().length < 3) return setReasonError("Give a reason.");
                act(() => adminApi.post(`/admin/users/${id}/suspend`, { reason: reason.trim() }), "The account could not be suspended.");
              }}
            >
              Suspend account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-ink-muted leading-relaxed">
            {user.name} is signed out at once and cannot sign in, and the account's API keys stop working. Documents already sent can still be signed. You can lift the suspension later.
          </p>
          <Field label="Reason" help="Shown in the record of admin actions." error={reasonError}>
            <Textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
