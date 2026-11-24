const ICONS = {
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm18 2-10 7L2 6",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
};

function FooterIcon({ d }: { d: string }) {
  return (
    <span className="w-7 h-7 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10 flex items-center justify-center text-brand-300 transition-colors group-hover:bg-brand-500/20 group-hover:text-white">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
}

export default function BusinessFooter() {
  const links = [
    { href: "tel:+919045917913", label: "+91 9045917913", icon: ICONS.phone },
    { href: "mailto:support@nsyu.com", label: "support@nsyu.com", icon: ICONS.mail },
    { href: "https://www.nsyu.in", label: "www.nsyu.in", icon: ICONS.globe, external: true },
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-navy-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-brand-sheen opacity-60" aria-hidden />
      <div className="relative max-w-[1700px] mx-auto px-4 sm:px-8 py-5 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient ring-1 ring-inset ring-white/15 flex items-center justify-center font-black text-sm shadow-brand">
            N
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-white text-[14px] tracking-tight block">
              NSYU Business<span className="text-brand-400">.</span>
            </span>
            <span className="text-[11px] text-brand-200/70 font-medium block">Shop management, billing &amp; commerce</span>
          </div>
        </div>

        {/* Contact */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-brand-50/80 font-medium">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-2 hover:text-white transition-colors"
            >
              <FooterIcon d={l.icon} />
              <span>{l.label}</span>
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div className="text-[11.5px] text-brand-100/50">© 2026 NSYU Business. All rights reserved.</div>
      </div>
    </footer>
  );
}
