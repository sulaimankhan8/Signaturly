import React from "react";

interface DashboardToolbarProps {
  stats: {
    total: number;
    pending: number;
    signed: number;
    drafts: number;
  };
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export default function DashboardToolbar({
  stats,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}: DashboardToolbarProps) {
  return (
    <div className="space-y-6">
      {/* Metric Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex items-center space-x-4 shadow-elevation-1">
          <div className="w-11 h-11 rounded-xl bg-crimson/10 border border-crimson/30 text-crimson flex items-center justify-center font-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-content-muted">Total Documents</p>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex items-center space-x-4 shadow-elevation-1">
          <div className="w-11 h-11 rounded-xl bg-seal-blue/10 border border-seal-blue/30 text-seal-blue flex items-center justify-center font-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-content-muted">In Progress</p>
            <p className="text-2xl font-black text-seal-blue font-mono mt-0.5">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex items-center space-x-4 shadow-elevation-1">
          <div className="w-11 h-11 rounded-xl bg-seal-emerald/10 border border-seal-emerald/30 text-seal-emerald flex items-center justify-center font-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-content-muted">Completed</p>
            <p className="text-2xl font-black text-seal-emerald font-mono mt-0.5">{stats.signed}</p>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex items-center space-x-4 shadow-elevation-1">
          <div className="w-11 h-11 rounded-xl bg-seal-amber/10 border border-seal-amber/30 text-seal-amber flex items-center justify-center font-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-content-muted">Drafts</p>
            <p className="text-2xl font-black text-seal-amber font-mono mt-0.5">{stats.drafts}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-card p-4 rounded-2xl border border-surface-border shadow-elevation-1">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-canvas border border-surface-border rounded-xl text-white placeholder-content-subtle focus:outline-none focus:border-crimson text-xs font-bold transition-colors"
          />
          <svg className="w-4 h-4 absolute left-3.5 top-3 text-content-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex bg-surface-canvas p-1 rounded-xl border border-surface-border w-full md:w-auto overflow-x-auto gap-1">
          {[
            { id: "all", label: "All Docs" },
            { id: "pending", label: "In Progress" },
            { id: "signed", label: "Completed" },
            { id: "draft", label: "Drafts" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-crimson text-white shadow-elevation-1"
                  : "text-content-muted hover:text-white hover:bg-surface-card"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
