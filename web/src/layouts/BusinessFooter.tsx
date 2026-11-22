export default function BusinessFooter() {
  return (
    <footer className="bg-[#064E3B] text-white border-t border-emerald-900 mt-auto py-3.5 px-4 sm:px-8 shadow-inner">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-800/90 border border-emerald-600/70 flex items-center justify-center text-white shadow-xs">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <span className="font-black text-white text-sm tracking-tight block">NSYU Business</span>
            <span className="text-[10px] text-emerald-300 font-semibold block -mt-0.5">Shop Management System</span>
          </div>
        </div>

        {/* Center: Contact Info */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-emerald-100 font-medium">
          <a href="tel:+919045917913" className="flex items-center gap-1.5 hover:text-white transition">
            <span>📞</span>
            <span>+91 9045917913</span>
          </a>
          <span className="hidden sm:inline text-emerald-700">|</span>
          <a href="mailto:support@nsyu.com" className="flex items-center gap-1.5 hover:text-white transition">
            <span>✉</span>
            <span>support@nsyu.com</span>
          </a>
          <span className="hidden sm:inline text-emerald-700">|</span>
          <a href="https://www.nsyu.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white transition">
            <span>🌐</span>
            <span>www.nsyu.in</span>
          </a>
        </div>

        {/* Right: Copyright */}
        <div className="text-[11px] text-emerald-300/80">
          © 2026 NSYU Business. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
