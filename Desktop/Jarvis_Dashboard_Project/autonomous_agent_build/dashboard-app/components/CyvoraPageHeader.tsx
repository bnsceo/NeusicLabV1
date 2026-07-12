import Image from 'next/image';
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
          <div className="flex items-center gap-3">
            <Image src="/cyvora-header-logo.png" alt="Cyvora" width={926} height={854} className="h-14 w-auto shrink-0" priority />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">{eyebrow}</p>
              <h1 className="mt-1 text-3xl font-semibold md:text-5xl">{title}</h1>
              <p className="mt-1 text-[11px] uppercase tracking-[0.26em] text-slate-500">AI Command Center</p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{description}</p>
        </div>
        {children ? <div className="flex flex-wrap items-start justify-start gap-3 lg:justify-end">{children}</div> : null}
      </div>
    </section>
  );
}
