import React from "react";
import DocumentStatusBadge from "./DocumentStatusBadge";

export default function DocumentCard({
  doc,
  navigate,
  handleOpenRecipients,
  handleOpenAudit,
  handleVoid,
  handleDelete,
  deletingId,
}) {
  const docId = doc._id || doc.id;
  const isSigned = doc.status === "signed";
  const createdDate = new Date(doc.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-[#13151f] border-2 border-white/20 hover:border-red-500 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#ef4444] group space-y-5">
      <div className="space-y-4">
        {/* Top Row: PDF Icon & Status Badge */}
        <div className="flex items-start justify-between">
          <div className="px-3 py-1 bg-red-600 text-white border-2 border-black rounded-lg font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]">
            PDF
          </div>
          <DocumentStatusBadge status={doc.status} />
        </div>

        {/* Title & Metadata */}
        <div>
          <h3
            className="text-base font-black text-white group-hover:text-yellow-400 transition-colors line-clamp-1"
            title={doc.originalFileName}
          >
            {doc.originalFileName}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 font-mono">
            <span>
              {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
            </span>
            <span>•</span>
            <span>{createdDate}</span>
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="pt-4 border-t-2 border-white/10 flex items-center justify-between gap-2 flex-wrap">
        {/* If Completed: Primary Download Button */}
        {isSigned && doc.signedUrl ? (
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}${doc.signedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#facc15] hover:shadow-[3px_3px_0px_0px_#fff] border-2 border-black"
            title="Download Final Executed PDF"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Executed PDF</span>
          </a>
        ) : doc.status === "pending" || doc.status === "partially_signed" ? (
          /* If In-Progress: Track Signers Primary */
          <button
            onClick={() => handleOpenRecipients(docId)}
            className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] border-2 border-black"
            title="Track Signers & Progress"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Signers</span>
          </button>
        ) : (
          /* Draft: Self-Sign / Editor */
          <button
            onClick={() => navigate(`/editor/${docId}`)}
            className="py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#facc15] hover:shadow-[3px_3px_0px_0px_#fff] border-2 border-black"
            title="Self Sign Document"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Sign</span>
          </button>
        )}

        {/* Send for multi-signature (if draft or completed re-send) */}
        {doc.status === "draft" && (
          <button
            onClick={() => navigate(`/send/${docId}`)}
            className="py-2 px-3 bg-[#1e2235] hover:bg-[#282d47] text-white border-2 border-white/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff]"
            title="Send to Multiple Recipients"
          >
            <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>Send</span>
          </button>
        )}

        {/* View Latest In-Progress Signed PDF */}
        {!isSigned && doc.signedUrl && (
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}${doc.signedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all"
            title="Preview Latest Signed PDF"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </a>
        )}

        {/* View Audit Trail */}
        <button
          onClick={() => handleOpenAudit(docId)}
          className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all"
          title="View Cryptographic Audit Trail"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </button>

        {/* Track Signers & Remind (if not already main button) */}
        {isSigned && (
          <button
            onClick={() => handleOpenRecipients(docId)}
            className="w-8 h-8 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all"
            title="View Completed Signers"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        )}

        {/* Void Document (Prominent button for In-Progress Envelopes) */}
        {(doc.status === "pending" || doc.status === "partially_signed") && (
          <button
            onClick={() => handleVoid(docId, doc.originalFileName)}
            disabled={deletingId === docId}
            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-black border-2 border-amber-500/40 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#f59e0b] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            title="Legally Void & Revoke Agreement"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="text-[11px] font-bold uppercase">Void</span>
          </button>
        )}

        {/* Delete / Purge Workspace */}
        <button
          onClick={() => handleDelete(docId, doc.originalFileName)}
          disabled={deletingId === docId}
          className="w-8 h-8 bg-red-950 hover:bg-red-800 text-red-400 hover:text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all disabled:opacity-50 ml-auto"
          title="Purge Document from Workspace"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
