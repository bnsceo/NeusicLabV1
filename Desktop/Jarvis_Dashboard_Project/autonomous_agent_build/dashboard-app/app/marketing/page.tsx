'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';

type ScreenshotSlotProps = {
  src: string;
  alt: string;
  title: string;
  caption: string;
};

function ScreenshotSlot({ src, alt, title, caption }: ScreenshotSlotProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const image = new window.Image();

    image.onload = () => setStatus('ready');
    image.onerror = () => setStatus('failed');
    image.src = src;
  }, [src]);

  return (
    <div className="cyvora-glass overflow-hidden rounded-[2rem] border border-white/10">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/80">{title}</p>
        <p className="mt-1 text-sm text-slate-300">{caption}</p>
      </div>
      <div className="bg-slate-950/30 p-4">
        {status === 'ready' ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/60 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <Image
              src={src}
              alt={alt}
              width={1440}
              height={900}
              className="h-auto w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-dashed border-cyan-200/20 bg-[radial-gradient(circle_at_top,_rgba(141,223,255,0.12),_transparent_55%),linear-gradient(180deg,_rgba(10,17,28,0.9),_rgba(4,10,18,0.96))] p-8 text-center">
            <div className="max-w-md">
              <p className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/70">Screenshot slot</p>
              <p className="mt-3 text-lg font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Drop a live capture from localhost:3003 at <span className="font-mono text-cyan-200">{src}</span> and this card will render it automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const featurePoints = [
  'Entire UI/UX showcased without private access codes.',
  'No execution endpoints, secrets, or internal API routes exposed.',
  'Public landing copy framed for founders, not internal operators.',
  'Screenshot-first layout so the app feels real before signup.',
];

const steps = [
  {
    title: 'Launch the public page',
    body: 'Give visitors one obvious entry point that explains what Cyvora is and what it is not.',
  },
  {
    title: 'Show the real UI',
    body: 'Replace the placeholder frames with actual captures from the live app shell, headquarters, and security views.',
  },
  {
    title: 'Keep the runtime private',
    body: 'Do not link hidden execution routes, unlock codes, or worker entrypoints from the marketing surface.',
  },
  {
    title: 'Move serious users into the app',
    body: 'Use the landing page to route qualified visitors into the live experience rather than a chat demo.',
  },
];

export default function MarketingPage() {
  return (
    <main className="min-h-screen">
      <NavBar />

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div className="cyvora-glass overflow-hidden rounded-[2.25rem] border border-white/10">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-center p-6 sm:p-8 md:p-10">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-[12px] uppercase tracking-[0.28em] text-cyan-100">
                Public landing page · privacy-safe
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                The Operating System for Autonomous Business
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Cyvora turns business objectives into structured companies, departments, teams, and agents. This public page shows the product shell, not the private runtime.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="cyvora-tactile rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
                >
                  Open live app
                </Link>
                <Link
                  href="/security"
                  className="cyvora-chip rounded-xl px-5 py-3 text-sm font-semibold text-slate-100 transition hover:translate-y-[-1px]"
                >
                  View security
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {featurePoints.map((point) => (
                  <div key={point} className="cyvora-chip rounded-2xl px-4 py-3 text-sm leading-6 text-slate-200">
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-950/35 p-4 sm:p-6 lg:border-l lg:border-t-0">
              <div className="cyvora-tactile overflow-hidden rounded-[2rem] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/80">Live app preview</p>
                    <p className="mt-1 text-lg font-semibold text-white">Screenshot-ready showcase</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[12px] text-emerald-100">
                    No secrets exposed
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(141,223,255,0.18),_transparent_50%),linear-gradient(180deg,_rgba(10,17,28,0.9),_rgba(7,12,20,0.98))] p-4">
                    <p className="text-sm font-medium text-white">What this page will show</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                      <li>• Mission Control with the current mode strip and activity state.</li>
                      <li>• Headquarters hierarchy showing companies, departments, teams, and agents.</li>
                      <li>• War Room and approval surfaces without private access paths.</li>
                    </ul>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-sm font-medium text-white">Where to place screenshots</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Save live captures from the app into <span className="font-mono text-cyan-200">public/showcase/</span> and point the slots below at those files.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 md:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <ScreenshotSlot
            src="/showcase/mission-control.png"
            alt="Cyvora mission control screenshot"
            title="Mission Control"
            caption="Founder objective, mode strip, approval state, and current company status."
          />
          <ScreenshotSlot
            src="/showcase/headquarters.png"
            alt="Cyvora headquarters screenshot"
            title="Headquarters"
            caption="Live hierarchy view for companies, departments, teams, and agents."
          />
          <ScreenshotSlot
            src="/showcase/war-room.png"
            alt="Cyvora war room screenshot"
            title="War Room"
            caption="Operational status, alerts, and controls that stay private in the live app."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 md:px-6">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="cyvora-glass rounded-[2rem] border border-white/10 p-6">
            <p className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/80">Positioning</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">This is a landing page, not a product dump.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              It should feel like a serious public front door: concise headline, visual proof, clear value, and a clean exit into the live app.
            </p>
            <div className="mt-6 space-y-3">
              {steps.map((step, index) => (
                <div key={step.title} className="cyvora-chip rounded-2xl px-4 py-4">
                  <p className="text-[12px] uppercase tracking-[0.24em] text-cyan-200/70">Step {index + 1}</p>
                  <p className="mt-1 text-base font-semibold text-white">{step.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="cyvora-glass rounded-[2rem] border border-white/10 p-6">
            <p className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/80">Trust boundaries</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Public visibility without runtime exposure</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-4">
                <p className="text-sm font-semibold text-emerald-100">Shown publicly</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                  <li>• Product narrative</li>
                  <li>• Branded screenshots</li>
                  <li>• Architecture summary</li>
                  <li>• Founder-first CTA</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-rose-300/15 bg-rose-300/8 p-4">
                <p className="text-sm font-semibold text-rose-100">Kept private</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                  <li>• Private access codes</li>
                  <li>• Execution endpoints</li>
                  <li>• Worker runtimes</li>
                  <li>• Internal tenant data</li>
                </ul>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Next move</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Add the live captures to <span className="font-mono text-cyan-200">public/showcase/</span>, then the marketing page will look like a real product launch instead of a placeholder.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/" className="cyvora-tactile rounded-xl px-4 py-2 text-sm font-semibold text-white">
                  Open app
                </Link>
                <Link href="/headquarters" className="cyvora-chip rounded-xl px-4 py-2 text-sm font-semibold text-slate-100">
                  View hierarchy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
