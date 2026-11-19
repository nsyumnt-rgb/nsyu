export default function BusinessFooter() {
  return (
    <footer className="bg-[#064E3B] text-emerald-100 border-t border-emerald-800/80 mt-auto">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium">
        
        {/* Left: Brand & Tagline */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-700/80 border border-emerald-400/40 flex items-center justify-center text-white shadow-xs">
            <svg className="w-4 h-4 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <span className="font-extrabold text-white tracking-tight">NSYU Business</span>
            <span className="text-[10px] text-emerald-300 block -mt-0.5">Shop Management System</span>
          </div>
        </div>

        {/* Center: Contact & Web Information */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-emerald-200 text-xs">
          <a
            href="tel:+919045917913"
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>+91 9045917913</span>
          </a>

          <a
            href="mailto:support@nsyu.com"
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>support@nsyu.com</span>
          </a>

          <a
            href="https://www.nsyu.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>www.nsyu.com</span>
          </a>
        </div>

        {/* Right: Copyright */}
        <div className="text-[11px] text-emerald-300/80 text-center md:text-right">
          © 2026 NSYU Business. All rights reserved.
        </div>

      </div>
    </footer>
  );
}
