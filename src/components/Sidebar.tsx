// Building blocks for the sidebar: section labels, icon rows with count badges, and a
// switch, so every list in it shares one look.

export function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-5 flex items-center justify-between px-2.5">
      <p className="text-[12px] font-medium text-faint">{children}</p>
      {aside}
    </div>
  );
}

export function Badge({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "free" | "accent" | "active" }) {
  const tones = {
    plain: "border-line-strong bg-surface text-muted",
    free: "border-free/30 bg-free-soft text-free",
    accent: "border-accent/40 bg-accent-soft text-fg",
    active: "border-transparent bg-fg text-bg",
  };
  return (
    <span className={`grid h-[22px] min-w-[22px] place-items-center rounded-md border px-1.5 font-mono text-[11px] font-semibold tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function NavRow({
  icon,
  label,
  hint,
  badge,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className={`shrink-0 ${active ? "text-fg" : "text-faint group-hover:text-muted"}`}>{icon}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-[11.5px] font-normal text-faint">{hint}</span>}
      </span>
      {badge}
    </>
  );
  const cls = `group flex w-full items-center gap-3 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] transition-colors ${
    active ? "bg-surface-2 font-medium text-fg" : "text-muted"
  }`;
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} disabled={disabled} className={`${cls} enabled:hover:bg-surface enabled:hover:text-fg disabled:opacity-50`}>
      {body}
    </button>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-2"}`}
    >
      <span className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-all ${on ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}
