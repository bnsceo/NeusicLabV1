import type { ReactNode } from 'react';

type CyvoraPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export default function CyvoraPageHeader({ eyebrow, title, description, children }: CyvoraPageHeaderProps) {
  return (
    <section className="cyvora-glass-strong rounded-2xl p-5 md:p-7">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">{eyebrow}</p>
            <h1 className="mt-1 text-[20px] font-semibold">{title}</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.26em] text-slate-500">AI Command Center</p>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
        </div>
        {children ? <div className="flex flex-wrap items-start justify-start gap-3 lg:justify-end">{children}</div> : null}
      </div>
    </section>
  );
}
