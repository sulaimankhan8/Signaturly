import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadFile, errorText } from "../api/admin.api.js";
import { useFetch } from "../lib/hooks.js";
import { count, dateTime, labelOf, plural, toneOf, words } from "../lib/format.js";
import { Badge, Button, ButtonLink, Card, Details, EmptyState, ErrorNote, Mono, PageHeader, Skeleton } from "../components/ui/basics.jsx";
import { useToast } from "../components/ui/Toast.jsx";

// The result of checking the audit chain just now, said as it is
function ChainResult({ chain }) {
  if (chain.entries === 0) {
    return <div className="notice">This document has no audit entries yet.</div>;
  }
  return chain.intact ? (
    <div role="status" className="notice notice-green">
      <strong className="font-bold">Audit chain intact.</strong> {plural(chain.entries, "entry", "entries")} checked just now: each links to the one before it and none has been altered.
    </div>
  ) : (
    <div role="alert" className="notice notice-red">
      <strong className="font-bold">Audit chain broken{chain.brokenAtSeq ? ` at entry ${chain.brokenAtSeq}` : ""}.</strong> {chain.reason}. The log of this document cannot be relied on from that point.
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, error, reload } = useFetch(`/admin/documents/${id}`);
  const [downloading, setDownloading] = useState(false);

  const downloadCertificate = async () => {
    try {
      setDownloading(true);
      await downloadFile(`/admin/documents/${id}/bsa-certificate`, `evidence-certificate-${id}.pdf`);
    } catch (err) {
      toast.error(errorText(err, "The certificate could not be made."));
    } finally {
      setDownloading(false);
    }
  };

  if (error && !data) {
    return (
      <>
        <PageHeader title="Document" back={{ to: "/documents", label: "Documents" }} />
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-64" />} back={{ to: "/documents", label: "Documents" }} />
        <Card>
          <Skeleton className="h-40 w-full block" />
        </Card>
      </>
    );
  }

  const { document: doc, recipients, trail, chain } = data;

  return (
    <>
      <PageHeader
        title={doc.name}
        back={{ to: "/documents", label: "Documents" }}
        note={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={toneOf("document", doc.status)}>{labelOf("document", doc.status)}</Badge>
            {doc.deletedAt && <Badge>Deleted by the owner on {dateTime(doc.deletedAt)}</Badge>}
            {doc.testMode && <Badge>Made with a test API key</Badge>}
          </span>
        }
        actions={
          <Button onClick={downloadCertificate} busy={downloading}>
            {downloading ? "Making the certificate…" : "Download evidence certificate"}
          </Button>
        }
      />

      <ChainResult chain={chain} />

      <Card title="Details">
        <Details
          rows={[
            [
              "Owner",
              doc.owner ? (
                <Link key="owner" to={`/users/${doc.owner.id}`} className="underline underline-offset-2 hover:text-white">
                  {doc.owner.name} ({doc.owner.email})
                </Link>
              ) : (
                "—"
              ),
            ],
            doc.workspace && ["Team", doc.workspace],
            ["Created", dateTime(doc.createdAt)],
            ["Last changed", dateTime(doc.updatedAt)],
            ["Pages", count(doc.pageCount)],
            doc.template && ["Made from", `The template ${doc.template}, version ${doc.templateVersion}`],
            ["Signing order", doc.signingOrder ? "One after another" : "Any order"],
            doc.expiresAt && ["Expires", dateTime(doc.expiresAt)],
            doc.declineReason && ["Reason for declining", doc.declineReason],
            ["Sealed", doc.sealed ? dateTime(doc.sealedAt) : doc.status === "signed" ? "Not yet, though signing is complete" : "No"],
            ["Hash of the original", <Mono key="hash">{doc.originalHash}</Mono>],
            doc.sealedHash && ["Hash of the sealed copy", <Mono key="sealed">{doc.sealedHash}</Mono>],
          ]}
        />
      </Card>

      <Card title="Signers" flush>
        {recipients.length === 0 ? (
          <EmptyState>Nobody has been asked to sign this document.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="thead-row">
                  <th scope="col" className="px-5 py-3 font-medium">Signer</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium">Invitation</th>
                  <th scope="col" className="px-5 py-3 font-medium">Identity checked by</th>
                  <th scope="col" className="px-5 py-3 font-medium">Opened</th>
                  <th scope="col" className="px-5 py-3 font-medium">Signed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <span className="text-ink">
                        {doc.signingOrder ? `${r.signingOrder}. ` : ""}
                        {r.name}
                      </span>
                      <div className="text-xs text-ink-muted break-all">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>
                      {r.role !== "signer" && <div className="text-xs text-ink-faint">{words(r.role)}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={toneOf("signer", r.status)}>{labelOf("signer", r.status)}</Badge>
                      {r.declineReason && <div className="text-xs text-ink-muted mt-1">{r.declineReason}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {r.delivery === "failed" ? <Badge tone="red">Not delivered</Badge> : <span className="text-ink-muted">{words(r.delivery || "") || "—"} by {r.channel}</span>}
                      {r.deliveryError && <div className="text-xs text-ink-muted mt-1">{r.deliveryError}</div>}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{words(r.authMethod)}{r.signatureType === "aadhaar" ? " · Aadhaar eSign" : ""}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">{dateTime(r.viewedAt) || "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">{dateTime(r.signedAt) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Audit trail"
        note="Every recorded event for this document, oldest first."
        actions={
          <ButtonLink size="sm" to={`/audit?document=${id}`}>
            Open in the audit log
          </ButtonLink>
        }
        flush
      >
        {trail.length === 0 ? (
          <EmptyState>No event has been recorded.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="thead-row">
                  <th scope="col" className="px-5 py-3 font-medium text-right">No.</th>
                  <th scope="col" className="px-5 py-3 font-medium">When</th>
                  <th scope="col" className="px-5 py-3 font-medium">Event</th>
                  <th scope="col" className="px-5 py-3 font-medium">Who</th>
                  <th scope="col" className="px-5 py-3 font-medium">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {trail.map((entry) => (
                  <tr key={entry.id} className={!chain.intact && chain.brokenAtSeq === entry.seq ? "bg-red-500/10" : ""}>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-muted">{entry.seq ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">{dateTime(entry.at)}</td>
                    <td className="px-5 py-3">
                      <span className="text-ink">{words(entry.event)}</span>
                      {entry.description && <div className="text-xs text-ink-muted">{entry.description}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {entry.actorName || entry.actorEmail ? (
                        <>
                          {entry.actorName}
                          {entry.actorEmail && <div className="text-xs text-ink-muted break-all">{entry.actorEmail}</div>}
                        </>
                      ) : (
                        <span className="text-ink-muted">The service</span>
                      )}
                    </td>
                    <td className="px-5 py-3">{entry.ipAddress ? <Mono>{entry.ipAddress}</Mono> : <span className="text-ink-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
