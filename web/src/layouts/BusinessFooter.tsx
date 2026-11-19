import { Link } from "react-router-dom";

export default function BusinessFooter() {
  return (
    <footer className="bg-[#064E3B] text-emerald-100 border-t border-emerald-900 mt-auto shadow-inner">
      {/* Main Footer Content */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Col 1: Brand & Description */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-800/80 border border-emerald-600/60 flex items-center justify-center text-white shadow-sm">
                <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <span className="font-black text-white text-base tracking-tight block">NSYU Business</span>
                <span className="text-[10.5px] text-emerald-300 font-semibold block -mt-0.5">Shop Management System</span>
              </div>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed font-normal">
              Unified retail and wholesale commerce platform powering real-time inventory tracking, 
              point-of-sale billing, digital catalogs, and multi-shop ledger control.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-semibold pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All systems operational & synced</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-3.5">Quick Links</h3>
            <ul className="space-y-2 text-xs font-medium text-emerald-100/90">
              <li>
                <Link to="/app" className="hover:text-white hover:underline transition">Home Dashboard</Link>
              </li>
              <li>
                <Link to="/app/catalog" className="hover:text-white hover:underline transition">Product Catalog</Link>
              </li>
              <li>
                <Link to="/app/products" className="hover:text-white hover:underline transition">Products Master</Link>
              </li>
              <li>
                <Link to="/app/orders" className="hover:text-white hover:underline transition">Orders Management</Link>
              </li>
              <li>
                <Link to="/app/sales" className="hover:text-white hover:underline transition">Sales & POS Billing</Link>
              </li>
              <li>
                <Link to="/app/inventory" className="hover:text-white hover:underline transition">Inventory & Stock</Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Customer Care & Info */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-3.5">Support & Company</h3>
            <ul className="space-y-2 text-xs font-medium text-emerald-100/90">
              <li>
                <a href="https://www.nsyu.com" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline transition">About NSYU</a>
              </li>
              <li>
                <a href="mailto:support@nsyu.com" className="hover:text-white hover:underline transition">Contact Support</a>
              </li>
              <li>
                <Link to="/portal/login" className="hover:text-white hover:underline transition">Customer Portal</Link>
              </li>
              <li>
                <Link to="/app/reports" className="hover:text-white hover:underline transition">Business Analytics</Link>
              </li>
              <li>
                <span className="text-emerald-300/70 block text-[11px]">Mon – Sat: 9:00 AM – 9:00 PM IST</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-3.5">Contact Us</h3>
            <div className="space-y-2.5 text-xs text-emerald-200">
              <a
                href="tel:+919045917913"
                className="flex items-center gap-2 hover:text-white transition group"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-800/60 border border-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-700">
                  <svg className="w-3.5 h-3.5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <span>+91 9045917913</span>
              </a>

              <a
                href="mailto:support@nsyu.com"
                className="flex items-center gap-2 hover:text-white transition group"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-800/60 border border-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-700">
                  <svg className="w-3.5 h-3.5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <span>support@nsyu.com</span>
              </a>

              <a
                href="https://www.nsyu.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition group"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-800/60 border border-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-700">
                  <svg className="w-3.5 h-3.5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <span>www.nsyu.com</span>
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright, Terms, Privacy */}
        <div className="mt-8 pt-6 border-t border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-emerald-300/80">
          <div>
            © 2026 NSYU Business. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-white transition cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-white transition cursor-pointer">Terms & Conditions</span>
            <span>•</span>
            <span className="hover:text-white transition cursor-pointer">Security Guaranteed</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
