import React from "react";

export default function RecipientStatusModal({
  isOpen,
  onClose,
  isLoading,
  recipientsDoc,
  remindingRecipientId,
  onSendReminder,
  onVoid,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Signer Roster &amp; Real-Time Status
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
            <div className="w-10 h-10 border-4 border-white/10 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : recipientsDoc ? (
          <div className="space-y-4 text-xs text-gray-300 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-[#08090d] p-4 rounded-xl space-y-1 border border-white/10">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Document</p>
              <p className="text-white font-semibold text-sm">{recipientsDoc.originalFileName}</p>
            </div>

            <div className="space-y-3">
              {(recipientsDoc.recipients || []).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recipients assigned yet.</p>
              ) : (
                recipientsDoc.recipients.map((rec) => {
                  const isSigned = rec.status === "signed";
                  return (
                    <div
                      key={rec._id}
                      className="bg-[#08090d] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/10"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: rec.color || "#ef4444" }}
                          />
                          <span className="font-bold text-white text-sm">{rec.name}</span>
                          <span className="text-gray-400 text-xs">({rec.email})</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3">
                          <span>
                            Role: <strong className="text-gray-300">{rec.role || "Signer"}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Status:{" "}
                            <strong className={isSigned ? "text-emerald-400" : "text-amber-400"}>
                              {rec.status?.toUpperCase()}
                            </strong>
                          </span>
                          {rec.lastRemindedAt && (
                            <>
                              <span>•</span>
                              <span>Reminded: {new Date(rec.lastRemindedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {!isSigned && (
                        <button
                          disabled={remindingRecipientId === rec._id}
                          onClick={() => onSendReminder(rec._id)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
                        >
                          {remindingRecipientId === rec._id ? "Sending..." : "Send Reminder"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          {recipientsDoc && (recipientsDoc.status === "pending" || recipientsDoc.status === "partially_signed") ? (
            <button
              onClick={() => {
                onClose();
                onVoid(recipientsDoc._id, recipientsDoc.originalFileName);
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>Void &amp; Cancel Agreement</span>
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
