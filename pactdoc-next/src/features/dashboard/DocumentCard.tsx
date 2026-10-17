import React from "react";
import Link from "next/link";
import DocumentStatusBadge from "./DocumentStatusBadge";

export interface DocumentData {
  _id?: string;
  id?: string;
  originalFileName: string;
  pageCount?: number;
  status: string;
  createdAt: string;
  signedUrl?: string;
}

interface DocumentCardProps {
  doc: DocumentData;
  onOpenAudit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

export default function DocumentCard({ doc, onOpenAudit, onDelete }: DocumentCardProps) {
  const docId = doc._id || doc.id || "";
  const isSigned = doc.status === "signed";
  const createdDate = new Date(doc.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-surface-card border border-surface-border hover:border-crimson/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-elevation-1 hover:shadow-elevation-2 space-y-5 group">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="px-2.5 py-1 bg-crimson/10 border border-crimson/30 text-crimson rounded-lg font-black text-[10px] uppercase tracking-wider">
            PDF
          </div>
          <DocumentStatusBadge status={doc.status} />
        </div>

        <div>
          <h3
            className="text-sm font-black text-white group-hover:text-crimson transition-colors line-clamp-1"
            title={doc.originalFileName}
          >
            {doc.originalFileName}
          </h3>
          <p className="text-[11px] text-content-muted mt-1 flex items-center gap-2 font-mono">
            <span>
              {doc.pageCount || 1} {(doc.pageCount || 1) === 1 ? "page" : "pages"}
            </span>
            <span>•</span>
            <span>{createdDate}</span>
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-surface-border flex items-center justify-between gap-2 flex-wrap">
        {isSigned ? (
          <Link
            href={`/editor/${docId}`}
            className="py-2 px-3 bg-seal-emerald hover:bg-seal-emerald/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-elevation-1"
          >
            View Executed
          </Link>
        ) : (
          <Link
            href={`/editor/${docId}`}
            className="py-2 px-3 bg-crimson hover:bg-crimson-hover text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-elevation-1"
          >
            Sign / Edit
          </Link>
        )}

        <button
          onClick={() => onOpenAudit(docId)}
          className="w-8 h-8 rounded-xl bg-surface-elevated hover:bg-white/10 text-content-secondary hover:text-white flex items-center justify-center transition-colors border border-surface-border"
          title="Cryptographic Audit Certificate"
        >
          <svg className="w-4 h-4 text-seal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </button>

        <button
          onClick={() => onDelete(docId, doc.originalFileName)}
          className="w-8 h-8 rounded-xl bg-surface-elevated hover:bg-red-950/60 text-content-muted hover:text-crimson flex items-center justify-center transition-colors border border-surface-border ml-auto"
          title="Purge Document"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
