import { lazy, Suspense, useEffect, useState } from "react";
import { OUT_OF_DOCUMENTS } from "../utils/outOfDocuments";

// Fetched only when it is first needed, so pages that never send anything do not carry it
const UpgradeModal = lazy(() => import("./UpgradeModal").then((module) => ({ default: module.UpgradeModal })));

/**
 * Wherever a document cannot be sent because the month's documents are used up, the sender is
 * shown the same two ways forward: add documents with one payment, or move to a bigger plan.
 *
 * The server refuses the send; api/axios.js notices that refusal on any request and says so
 * with an event, and this listens for it. So every screen that sends gets this without
 * handling it itself. Nothing is bought automatically: the sender chooses, and then sends again.
 */
export default function OutOfDocumentsPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OUT_OF_DOCUMENTS, show);
    return () => window.removeEventListener(OUT_OF_DOCUMENTS, show);
  }, []);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <UpgradeModal isOpen outOfDocuments onClose={() => setOpen(false)} />
    </Suspense>
  );
}
