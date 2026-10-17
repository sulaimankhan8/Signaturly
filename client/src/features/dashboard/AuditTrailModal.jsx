import React from "react";

export default function AuditTrailModal({
  isOpen,
  onClose,
  isLoading,
  selectedAudit,
  isCertDownloading,
  onDownloadCertificate,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Cryptographic Audit Trail
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
          </div>
        ) : selectedAudit ? (
          <div className="space-y-4 text-xs text-gray-300 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-[#08090d] p-4 rounded-xl space-y-1 border border-white/10">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Document Title</p>
              <p className="text-white font-semibold text-sm">{selectedAudit.pdf?.originalFileName}</p>
            </div>

            {selectedAudit.auditLogs?.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No audit records logged yet.</p>
            ) : (
              selectedAudit.auditLogs?.map((log, index) => (
                <div key={log._id || index} className="bg-[#08090d] p-4 rounded-xl space-y-2.5 border border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-red-400 capitalize">{log.event || "Signature"} Entry</span>
                    <span className="text-gray-400 font-mono text-[11px]">{new Date(log.signedAt || log.createdAt).toLocaleString()}</span>
                  </div>

                  {log.actorName && (
                    <p className="text-xs text-gray-300">
                      Actor: <strong className="text-white">{log.actorName}</strong> ({log.actorEmail})
                    </p>
                  )}

                  {log.description && (
                    <p className="text-xs text-gray-400 italic">"{log.description}"</p>
                  )}

                  {log.originalHash && (
                    <div>
                      <p className="text-[10px] text-gray-400 font-mono uppercase">Original Document Hash (SHA-256):</p>
                      <p className="text-xs font-mono bg-black/60 p-2 rounded-lg text-emerald-300 break-all border border-emerald-950">
                        {log.originalHash}
                      </p>
                    </div>
                  )}

                  {log.signedHash && (
                    <div>
                      <p className="text-[10px] text-gray-400 font-mono uppercase">Signed Document Hash (SHA-256):</p>
                      <p className="text-xs font-mono bg-black/60 p-2 rounded-lg text-red-400 break-all border border-red-950">
                        {log.signedHash}
                      </p>
                    </div>
                  )}

                  {log.ipAddress && (
                    <p className="text-[10px] font-mono text-gray-500">IP: {log.ipAddress}</p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-xs">No audit trail records found.</p>
        )}

        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          {selectedAudit?.pdf?._id && (
            <button
              type="button"
              disabled={isCertDownloading}
              onClick={() =>
                onDownloadCertificate(
                  selectedAudit.pdf._id,
                  selectedAudit.pdf.originalFileName
                )
              }
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{isCertDownloading ? "Downloading..." : "Download Audit Certificate (PDF)"}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
