import React from "react";

export default function DashboardToolbar({
  stats,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}) {
  return (
    <>
      {/* Compact Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-[#13151f] border-2 border-white/20 rounded-xl p-3 sm:p-3.5 flex items-center space-x-3 shadow-[3px_3px_0px_0px_#ef4444]">
          <div className="w-9 h-9 rounded-lg bg-red-600 text-white border-2 border-black flex items-center justify-center font-black shadow-[1px_1px_0px_0px_#000] shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">Total Docs</p>
            <p className="text-xl font-black text-white font-mono leading-tight">{stats.total}</p>
          </div>
        </div>

        <div className="bg-[#13151f] border-2 border-white/20 rounded-xl p-3 sm:p-3.5 flex items-center space-x-3 shadow-[3px_3px_0px_0px_#3b82f6]">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white border-2 border-black flex items-center justify-center font-black shadow-[1px_1px_0px_0px_#000] shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">In Progress</p>
            <p className="text-xl font-black text-blue-400 font-mono leading-tight">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-[#13151f] border-2 border-white/20 rounded-xl p-3 sm:p-3.5 flex items-center space-x-3 shadow-[3px_3px_0px_0px_#22c55e]">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white border-2 border-black flex items-center justify-center font-black shadow-[1px_1px_0px_0px_#000] shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">Completed</p>
            <p className="text-xl font-black text-emerald-400 font-mono leading-tight">{stats.signed}</p>
          </div>
        </div>

        <div className="bg-[#13151f] border-2 border-white/20 rounded-xl p-3 sm:p-3.5 flex items-center space-x-3 shadow-[3px_3px_0px_0px_#facc15]">
          <div className="w-9 h-9 rounded-lg bg-yellow-400 text-black border-2 border-black flex items-center justify-center font-black shadow-[1px_1px_0px_0px_#000] shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">Drafts</p>
            <p className="text-xl font-black text-yellow-400 font-mono leading-tight">{stats.drafts}</p>
          </div>
        </div>
      </div>

      {/* Compact Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between bg-[#13151f] p-2.5 sm:p-3 rounded-xl border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]">
        {/* Search Box */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#090a0f] border-2 border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-xs font-bold transition-colors"
          />
          <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-[#090a0f] p-1 rounded-lg border-2 border-white/20 w-full md:w-auto overflow-x-auto gap-1">
          {[
            { id: "all", label: "All Docs" },
            { id: "pending", label: "In Progress" },
            { id: "signed", label: "Completed" },
            { id: "draft", label: "Drafts" },
            { id: "declined", label: "Declined/Void" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-md whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
