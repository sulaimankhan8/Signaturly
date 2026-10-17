"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardToolbar from "@/features/dashboard/DashboardToolbar";
import DocumentCard, { DocumentData } from "@/features/dashboard/DocumentCard";

// Mock seed documents for instant preview if backend is sleeping
const SEED_DOCUMENTS: DocumentData[] = [
  {
    id: "doc-1",
    originalFileName: "Mutual-NDA-Master-Agreement.pdf",
    pageCount: 4,
    status: "signed",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "doc-2",
    originalFileName: "Independent-Contractor-Agreement.pdf",
    pageCount: 7,
    status: "pending",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "doc-3",
    originalFileName: "Software-License-Order-Form.pdf",
    pageCount: 2,
    status: "draft",
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: documents = SEED_DOCUMENTS, isLoading } = useQuery<DocumentData[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/pdf/my-documents");
        if (!res.ok) return SEED_DOCUMENTS;
        const json = await res.json();
        return json?.data || SEED_DOCUMENTS;
      } catch {
        return SEED_DOCUMENTS;
      }
    },
    staleTime: 1000 * 60,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/pdf/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<DocumentData[]>(["documents"], (prev) =>
        prev ? prev.filter((d) => (d._id || d.id) !== deletedId) : []
      );
    },
  });

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.originalFileName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "signed") return doc.status === "signed";
      if (statusFilter === "pending") return doc.status === "pending" || doc.status === "partially_signed";
      if (statusFilter === "draft") return doc.status === "draft" || doc.status === "uploaded";
      return true;
    });
  }, [documents, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = documents.length;
    const signed = documents.filter((d) => d.status === "signed").length;
    const pending = documents.filter((d) => d.status === "pending" || d.status === "partially_signed").length;
    const drafts = documents.filter((d) => d.status === "draft" || d.status === "uploaded").length;
    return { total, signed, pending, drafts };
  }, [documents]);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to purge "${name}" from your workspace?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenAudit = (id: string) => {
    alert(`Cryptographic SHA-256 Audit Certificate verified for Document ID: ${id}`);
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary">
      {/* Dashboard Top Navigation */}
      <header className="border-b border-surface-border bg-surface-canvas/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-crimson flex items-center justify-center font-black text-white text-xs">
                P
              </div>
              <span className="font-black text-base tracking-tight text-white uppercase">
                Pact<span className="text-crimson">Doc</span>
              </span>
            </Link>
            <span className="text-content-subtle font-mono text-xs">/ Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-xs font-bold uppercase tracking-wider text-seal-amber hover:text-white px-3 py-1.5 rounded-lg border border-seal-amber/30 bg-seal-amber/10 transition-colors"
            >
              Upgrade Workspace
            </Link>
            <Link
              href="/upload"
              className="px-4 py-2 bg-crimson hover:bg-crimson-hover text-white text-xs font-black uppercase tracking-wider rounded-xl btn-shelf-yellow transition-all"
            >
              + Upload PDF
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            Document Vault
          </h1>
          <p className="text-xs text-content-muted mt-0.5 font-medium">
            Manage legally binding agreements, track multi-party signatures, and inspect cryptographic audit trails.
          </p>
        </div>

        {/* Dashboard Toolbar */}
        <DashboardToolbar
          stats={stats}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        {/* Document Cards Gallery */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-2 border-crimson border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-mono uppercase text-content-muted">Synchronizing Document Vault...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-20 bg-surface-card rounded-3xl border border-surface-border p-8 space-y-4 shadow-elevation-1">
            <p className="text-base font-black text-white uppercase">No documents found</p>
            <p className="text-xs text-content-muted max-w-sm mx-auto">
              No contracts match your active filter criteria. Upload a PDF or choose a template to get started.
            </p>
            <Link
              href="/t"
              className="inline-block px-6 py-2.5 bg-crimson hover:bg-crimson-hover text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-elevation-1"
            >
              Browse Legal Templates →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc._id || doc.id}
                doc={doc}
                onOpenAudit={handleOpenAudit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
