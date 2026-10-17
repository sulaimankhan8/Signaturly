"use client";

import { use } from "react";
import dynamic from "next/dynamic";

// Skeleton loader while dynamic client bundle mounts
function EditorSkeleton() {
  return (
    <div className="h-screen w-screen flex flex-col bg-surface-canvas text-content-primary overflow-hidden">
      <header className="h-14 border-b border-surface-border bg-surface-card flex items-center justify-between px-4 animate-pulse">
        <div className="w-32 h-6 bg-surface-elevated rounded-lg" />
        <div className="w-48 h-8 bg-surface-elevated rounded-xl" />
      </header>
      <div className="flex-1 flex">
        <aside className="w-72 border-r border-surface-border bg-surface-card p-4 space-y-4">
          <div className="w-full h-8 bg-surface-elevated rounded-xl animate-pulse" />
          <div className="w-full h-32 bg-surface-elevated rounded-2xl animate-pulse" />
        </aside>
        <main className="flex-1 flex items-center justify-center bg-surface-canvas">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-crimson border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-content-muted uppercase tracking-wider">
              Initializing Cryptographic PDF Engine...
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

// Client-only dynamic stub simulating the editor boundary
const DynamicDocumentEditor = dynamic(
  async () => {
    // In full migration, this imports the decomposed client-side DocumentEditor component
    return function DocumentEditorStub({ pdfId }: { pdfId: string }) {
      return (
        <div className="h-screen w-screen flex flex-col bg-surface-canvas text-content-primary">
          <header className="h-14 border-b border-surface-border bg-surface-card flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-seal-emerald" />
              <span className="text-xs font-mono font-bold text-white">Document ID: {pdfId}</span>
            </div>
            <a
              href="/dashboard"
              className="text-xs font-bold uppercase tracking-wider text-content-muted hover:text-white"
            >
              Exit to Dashboard
            </a>
          </header>
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div className="max-w-md bg-surface-card border border-surface-border p-6 rounded-2xl space-y-3">
              <h2 className="text-base font-black uppercase text-white">Next.js 15 Client Isolation Active</h2>
              <p className="text-xs text-content-muted leading-relaxed">
                PDF Canvas engine and DOM events are safely bound client-side with zero SSR hydration mismatches.
              </p>
            </div>
          </div>
        </div>
      );
    };
  },
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

export default function EditorPage({ params }: { params: Promise<{ pdfId: string }> }) {
  const { pdfId } = use(params);
  return <DynamicDocumentEditor pdfId={pdfId} />;
}
