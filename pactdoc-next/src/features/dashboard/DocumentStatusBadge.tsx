import React from "react";

interface DocumentStatusBadgeProps {
  status: string;
}

export default function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  switch (status) {
    case "signed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-seal-emerald/40 bg-seal-emerald/10 text-seal-emerald shadow-elevation-1">
          <svg className="w-3 h-3 text-seal-emerald stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Signed &amp; Sealed
        </span>
      );
    case "pending":
    case "partially_signed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-seal-blue/40 bg-seal-blue/10 text-seal-blue shadow-elevation-1">
          <svg className="w-3 h-3 text-seal-blue stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          In Progress
        </span>
      );
    case "declined":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-crimson/40 bg-crimson/10 text-crimson shadow-elevation-1">
          <svg className="w-3 h-3 text-crimson stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Declined
        </span>
      );
    case "voided":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-content-subtle bg-surface-card text-content-muted shadow-elevation-1">
          <svg className="w-3 h-3 text-content-muted stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Voided
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-seal-purple/40 bg-seal-purple/10 text-seal-purple shadow-elevation-1">
          Draft
        </span>
      );
  }
}
