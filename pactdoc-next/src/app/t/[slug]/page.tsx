import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// ISR: Cache pages for 1 hour, revalidating in the background
export const revalidate = 3600;

interface TemplatePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
  const { slug } = await params;
  const formattedTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${formattedTitle} Template (Free E-Signature) — PactDoc`,
    description: `Free, legally binding ${formattedTitle} contract template. Fill out, customize fields, and execute with cryptographic electronic signatures in minutes.`,
    openGraph: {
      title: `${formattedTitle} Template — Free Electronic Signature`,
      description: `Legally compliant ${formattedTitle} agreement ready to sign.`,
    },
  };
}

export default async function TemplateDetail({ params }: TemplatePageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const formattedTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href="/t"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-muted hover:text-white transition-colors"
        >
          ← Back to Template Library
        </Link>

        <div className="bg-surface-card border border-surface-border rounded-3xl p-8 sm:p-10 space-y-6 shadow-elevation-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
            <div>
              <span className="text-[10px] font-mono font-black uppercase text-crimson bg-crimson/10 border border-crimson/30 px-2.5 py-0.5 rounded-full">
                Standard Legal Agreement
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white mt-2 uppercase">
                {formattedTitle}
              </h1>
              <p className="text-xs text-content-muted mt-1 font-mono">
                Verified eIDAS &amp; ESIGN Court Admissible Framework
              </p>
            </div>

            <Link
              href={`/use-template/${slug}`}
              className="px-6 py-3 bg-crimson hover:bg-crimson-hover text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-elevation-1 hover:shadow-crimson-glow transition-all whitespace-nowrap text-center"
            >
              Use This Template →
            </Link>
          </div>

          <div className="prose prose-invert max-w-none text-xs sm:text-sm text-content-secondary leading-relaxed space-y-4">
            <p>
              This {formattedTitle} is pre-configured with standardized signer roles, signature anchors, date
              stamps, and compliance disclosures.
            </p>
            <div className="bg-surface-canvas/60 border border-surface-border rounded-xl p-4 font-mono text-[11px] text-content-muted space-y-2">
              <p className="font-bold text-white uppercase text-[10px]">Standard Pre-configured Roles:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Party A (Disclosing Party / Service Provider)</li>
                <li>Party B (Receiving Party / Client)</li>
                <li>Optional Witness / Compliance Auditor</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
