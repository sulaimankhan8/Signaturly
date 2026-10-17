import React from "react";

export default function DocumentStatusBadge({ status }) {
  switch (status) {
    case "completed":
      return (
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-emerald-500 text-black shadow-[2px_2px_0px_0px_#fff] flex items-center gap-1 w-max">
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Executed
        </span>
      );
    case "pending":
      return (
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#ef4444] flex items-center gap-1 w-max">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
          Awaiting Signers
        </span>
      );
    case "voided":
      return (
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-red-600 text-white shadow-[2px_2px_0px_0px_#fff] flex items-center gap-1 w-max">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Voided
        </span>
      );
    case "expired":
      return (
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-gray-600 text-white shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 w-max">
          Expired
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-purple-500 text-white shadow-[2px_2px_0px_0px_#fff] flex items-center gap-1 w-max">
          Draft
        </span>
      );
  }
}
