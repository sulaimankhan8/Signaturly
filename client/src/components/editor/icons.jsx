// Stroke drawings that take the colour of the text around them

const PATHS = {
  signature: <path d="M3 17c3-1 4-6 6-6s1 5 3 5 2-3 4-3 2 2 5 2M3 21h18" />,
  initials: <path d="M5 18V6M5 6l3 6 3-6v12M15 6h4M17 6v12M15 18h4" />,
  stamp: (
    <>
      <path d="M9 3h6l-1 7h-4z" />
      <path d="M5 14h14v3H5zM4 21h16" />
    </>
  ),
  name: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  date: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </>
  ),
  text: <path d="M4 6h16M12 6v14M8 20h8" />,
  dropdown: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M14 11l2 2 2-2" />
    </>
  ),
  checkbox: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),
};

export function FieldIcon({ type, className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[type] || PATHS.text}
    </svg>
  );
}

const icon =
  (paths, strokeWidth = 2.2) =>
  ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  );

export const UI = {
  undo: icon(<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />),
  redo: icon(<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />),
  zoomIn: icon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </>
  ),
  zoomOut: icon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </>
  ),
  fit: icon(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />),
  pages: icon(
    <>
      <rect x="4" y="3" width="11" height="14" rx="1" />
      <path d="M9 21h10V8" />
    </>
  ),
  back: icon(<path d="M19 12H5M11 18l-6-6 6-6" />),
  next: icon(<path d="M5 12h14M13 6l6 6-6 6" />),
  close: icon(<path d="M6 6l12 12M18 6L6 18" />),
  check: icon(<path d="M5 13l4 4L19 7" />, 3),
  copy: icon(
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  trash: icon(<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />),
  layers: icon(<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />),
  plus: icon(<path d="M12 5v14M5 12h14" />),
  menu: icon(<path d="M4 6h16M4 12h16M4 18h16" />),
  sliders: icon(<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" />),
  eye: icon(
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  send: icon(<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />),
  pen: icon(<path d="M15 5l4 4L8 20H4v-4L15 5z" />),
  alignLeft: icon(<path d="M4 3v18M8 7h10v4H8zM8 14h6v4H8z" />),
  alignCenter: icon(<path d="M12 3v18M7 7h10v4H7zM9 14h6v4H9z" />),
  alignRight: icon(<path d="M20 3v18M6 7h10v4H6zM10 14h6v4h-6z" />),
  alignTop: icon(<path d="M3 4h18M7 8v10h4V8zM14 8v6h4V8z" />),
  alignMiddle: icon(<path d="M3 12h18M7 7v10h4V7zM14 9v6h4V9z" />),
  alignBottom: icon(<path d="M3 20h18M7 6v10h4V6zM14 10v6h4v-6z" />),
};
