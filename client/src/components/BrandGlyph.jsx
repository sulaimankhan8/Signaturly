// PactDoc's mark: a P drawn as a page with its corner folded, its stem a pen nib.
// The same drawing as public/favicon.svg and the logo files in public/brand.
// The page takes the text colour; the fold is black, as on the red tile the app shows it in.
const PAGE = "M6 3H19L26 10V22H13V24L9.5 29L6 24Z M13 10H19V16H13Z";
const FOLD = "M19 3V10H26Z";

export default function BrandGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={PAGE} />
      <path fill="#000" d={FOLD} />
    </svg>
  );
}
