import { cloneElement, useId } from "react";
import { Link } from "react-router-dom";

/**
 * The small pieces every screen is built from. Each is written once, here.
 *
 * Colour has one meaning throughout: red is a failure or a destructive action, amber wants
 * attention, green is finished or healthy, blue is under way, grey is neutral.
 *
 * The shapes are the customer app's, turned down: a 2px edge, a hard offset shadow, bold
 * small capitals for labels. What can be pressed sinks into its shadow when pressed.
 */

const cx = (...parts) => parts.filter(Boolean).join(" ");

const BUTTON = {
  primary: "bg-ink text-surface-page border-black shadow-hard-sm hover:bg-white",
  secondary: "bg-surface-raised text-ink border-edge shadow-hard-sm hover:border-ink",
  danger: "bg-red-600 text-white border-black shadow-hard-sm hover:bg-red-500",
  quiet: "text-ink-muted border-transparent hover:text-ink hover:bg-white/5",
};
const PRESS = "transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transform-none";
const BUTTON_SIZE = { md: "h-9 px-3.5 text-sm", sm: "h-8 px-3 text-xs" };
const buttonClass = (variant, size, className) =>
  cx("inline-flex items-center justify-center gap-2 rounded-lg border-2 font-bold whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none", PRESS, BUTTON[variant], BUTTON_SIZE[size], className);

export function Button({ variant = "secondary", size = "md", busy = false, disabled = false, className, children, type = "button", ...rest }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={busy || disabled} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", className, children, ...rest }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

const TONE = {
  neutral: "bg-white/5 text-ink-muted border-edge",
  green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/70",
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/70",
  red: "bg-red-500/10 text-red-300 border-red-500/70",
  blue: "bg-sky-400/10 text-sky-300 border-sky-400/70",
};

export function Badge({ tone = "neutral", children }) {
  return <span className={cx("inline-flex items-center rounded-md border-2 px-1.5 py-px text-[11px] font-bold uppercase tracking-wide whitespace-nowrap", TONE[tone])}>{children}</span>;
}

// The mark, as it stands at the top of the frame and of the sign-in screen
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-red border-2 border-black shadow-[2px_2px_0_0_#f3f4f6] font-display text-base font-bold text-white" aria-hidden="true">
        P
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-ink">PactDoc</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted border-2 border-edge rounded-md px-1.5 py-px">Admin</span>
    </div>
  );
}

export function Card({ title, note, actions, children, className, flush = false }) {
  return (
    <section className={cx("panel", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b-2 border-edge">
          <div>
            <h2 className="font-display text-base font-bold text-ink">{title}</h2>
            {note && <p className="text-xs text-ink-muted mt-0.5">{note}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, note, back, actions, children }) {
  return (
    <div className="space-y-3">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink break-words">{title}</h1>
          {note && <div className="text-sm text-ink-muted mt-1">{note}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// One figure with what it is and, underneath, what it is measured against
export function StatCard({ label, value, note, to }) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="font-display text-3xl font-bold tracking-tight text-ink mt-1.5">{value}</p>
      {note && <p className="text-xs text-ink-faint mt-1.5">{note}</p>}
    </>
  );
  const className = "panel block p-5";
  return to ? (
    <Link to={to} className={cx(className, "transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-ink hover:shadow-hard-ink motion-reduce:transform-none")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Skeleton({ className = "h-4 w-24" }) {
  return <span className={cx("skeleton inline-block rounded bg-white/10 align-middle", className)} aria-hidden="true" />;
}

export function EmptyState({ children }) {
  return <p className="text-sm text-ink-muted text-center py-10 px-4">{children}</p>;
}

// Something could not be loaded. Says what, and offers to try again.
export function ErrorNote({ children, onRetry }) {
  return (
    <div role="alert" className="notice notice-red flex flex-wrap items-center justify-between gap-3">
      <span>{children}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// Label and value pairs, for the detail pages
export function Details({ rows }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-x-6 gap-y-2.5 text-sm">
      {rows
        .filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== "")
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-ink min-w-0 break-words">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

// Ids, hashes and addresses: the only text set in the monospace face
export function Mono({ children, title }) {
  return (
    <span className="font-mono text-xs text-ink-muted break-all" title={title}>
      {children}
    </span>
  );
}

const fieldClass = "h-9 rounded-lg bg-surface-panel border-2 border-edge px-3 text-sm text-ink placeholder:text-ink-faint transition-shadow focus:border-ink focus:shadow-hard-sm focus:outline-none disabled:opacity-60";

// Full width, unless the caller names a width of its own
const widthOf = (className) => (/(^|\s)w-/.test(className || "") ? "" : "w-full");

export function Input({ className, ...rest }) {
  return <input className={cx(fieldClass, widthOf(className), className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cx(fieldClass, widthOf(className), "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx(fieldClass, widthOf(className), "h-auto py-2 leading-relaxed", className)} {...rest} />;
}

/**
 * A labelled control, with a line of help or of error underneath. It takes one control as its
 * child. The label names the control and nothing else; the help and the error describe it.
 */
export function Field({ label, help, error, children, className }) {
  const id = useId();
  const noteId = `${id}-note`;
  const hasNote = Boolean(error || help);
  return (
    <div className={cx("text-sm", className)}>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": hasNote ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={noteId} className="text-xs text-red-300 mt-1.5" role="alert">
          {error}
        </p>
      ) : (
        help && (
          <p id={noteId} className="text-xs text-ink-faint mt-1.5">
            {help}
          </p>
        )
      )}
    </div>
  );
}

// A row of filters above a table
export function Filters({ children }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

// A filter that came from a link ("documents of this account"), with a way to drop it
export function FilterChip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 h-9 rounded-lg border-2 border-edge bg-white/5 pl-3 pr-1 text-sm text-ink">
      {children}
      <button type="button" onClick={onClear} className="h-6 w-6 rounded-md text-ink-muted hover:text-ink hover:bg-white/10" aria-label="Remove this filter">
        <span aria-hidden="true">×</span>
      </button>
    </span>
  );
}
