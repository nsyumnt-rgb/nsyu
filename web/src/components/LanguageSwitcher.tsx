import { useEffect, useRef, useState } from "react";

export const HINGLISH_MAP: Record<string, string> = {
  // Navigation & Core App
  "POS / Create order": "Billing (POS)",
  "Current bill": "Abhi ka bill",
  "Customer": "Grahak",
  "Walk-in": "Walk-in (bina naam)",
  "Discount": "Chhoot",
  "Subtotal": "Kul (chhoot se pehle)",
  "Total": "Kul bill",
  "Payment": "Bhugtaan",
  "Paid": "Poora paid",
  "Partial": "Aadha-aadha",
  "Pay later": "Udhaar",
  "Method": "Tareeka",
  "Paid now (₹)": "Abhi diya (₹)",
  "Generate invoice": "Bill banayein",
  "Clear bill": "Bill saaf karein",
  "Print": "Print",
  "Download PDF": "PDF download",
  "Record payment": "Paisa mila",
  "Statement": "Statement",
  "WhatsApp reminder": "WhatsApp yaad dilayein",
  "Total udhaar": "Kul udhaar",
  "Customers with udhaar": "Udhaar wale grahak",
  "Over their limit": "Limit ke paar",
  "Search customer name or phone": "Naam ya phone se khojein",
  "Search by name, SKU or barcode": "Naam, brand ya barcode se khojein",
  "Search product by name, SKU or barcode...": "Naam, brand ya barcode se khojein...",
  "Customers": "Grahak",
  "Invoices": "Bill",
  "Payments": "Bhugtaan",
  "Add customer": "Naya grahak",
  "Shopping cart": "Aapki cart",
  "Marketplace": "Marketplace (bazaar)",
  "All categories": "Saari categories",
  "All Categories": "Saari Categories",

  // Inventory & Products
  "Inventory": "Inventory (Stock)",
  "All Products": "Saare Products",
  "Live": "Live (Chalu)",
  "Offline": "Offline (Band)",
  "Low Stock": "Kam Stock",
  "Out of Stock": "Khatam Stock",
  "Stock Movement": "Stock Aana-Jaana",
  "Add Product": "Naya Product",
  "Purchase Price": "Kharid Daam",
  "Selling Price": "Bikri Daam",
  "Gross Margin": "Munafa (Margin)",
  "Total Stock": "Kul Stock",
  "Total Stock Value": "Kul Stock Keemat",
  "Stock Availability": "Stock Maujoodgi",
  "Close": "Band karein",
  "Save": "Save karein",
  "Cancel": "Radd karein",
  "Delete": "Hatayein",
  "Edit Details": "Detail Badlein",
  "Edit Product Details": "Product Detail Badlein",
  "Save Changes": "Badlav Save Karein",
  "Save Product Changes": "Product Save Karein",

  // Common UI
  "Settings": "Settings",
  "Sales": "Bikri (Sales)",
  "Reports": "Reports",
  "Orders": "Orders",
  "Switch Shop": "Dukaan Badlein",
  "Log out": "Log out karein",
};

// Generate reverse map for switching back to English cleanly
export const ENGLISH_MAP: Record<string, string> = {};
Object.entries(HINGLISH_MAP).forEach(([en, hi]) => {
  ENGLISH_MAP[hi] = en;
});

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<"English" | "Hindi">(() => {
    try {
      return localStorage.getItem("nsyu_language") === "Hindi" ? "Hindi" : "English";
    } catch {
      return "English";
    }
  });
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen to language change events from elsewhere
  useEffect(() => {
    const handleLangEvent = (e: any) => {
      if (e.detail === "Hindi" || e.detail === "English") {
        setLang(e.detail);
      }
    };
    window.addEventListener("nsyu_language_change", handleLangEvent);
    return () => window.removeEventListener("nsyu_language_change", handleLangEvent);
  }, []);

  // Live DOM translation engine
  useEffect(() => {
    if (lang === "English") {
      // Revert Hindi translations back to English
      const revertNode = (node: Node) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          const val = textNode.nodeValue?.trim() || "";
          if (ENGLISH_MAP[val] && textNode.parentElement && !textNode.parentElement.closest("#lang-switcher")) {
            textNode.nodeValue = textNode.nodeValue!.replace(val, ENGLISH_MAP[val]);
          }
        }
        if ("querySelectorAll" in node) {
          (node as HTMLElement).querySelectorAll<HTMLInputElement>("input[placeholder]").forEach((input) => {
            if (ENGLISH_MAP[input.placeholder]) {
              input.placeholder = ENGLISH_MAP[input.placeholder];
            }
          });
        }
      };
      revertNode(document.body);
      return;
    }

    // Apply Hindi/Hinglish translations
    const translateNode = (node: Node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode: Node | null;
      while ((textNode = walker.nextNode())) {
        const val = textNode.nodeValue?.trim() || "";
        if (HINGLISH_MAP[val] && textNode.parentElement && !textNode.parentElement.closest("#lang-switcher")) {
          textNode.nodeValue = textNode.nodeValue!.replace(val, HINGLISH_MAP[val]);
        }
      }
      if ("querySelectorAll" in node) {
        (node as HTMLElement).querySelectorAll<HTMLInputElement>("input[placeholder]").forEach((input) => {
          if (HINGLISH_MAP[input.placeholder]) {
            input.placeholder = HINGLISH_MAP[input.placeholder];
          }
        });
      }
    };

    translateNode(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => translateNode(n));
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [lang]);

  const selectLanguage = (newLang: "English" | "Hindi") => {
    setLang(newLang);
    try {
      localStorage.setItem("nsyu_language", newLang);
    } catch {
      // Ignore localStorage restrictions
    }
    setOpen(false);
    window.dispatchEvent(new CustomEvent("nsyu_language_change", { detail: newLang }));
  };

  return (
    <div className="relative" ref={dropdownRef} id="lang-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 px-2 sm:px-2.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
          lang === "Hindi"
            ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-2xs"
            : "bg-white border-slate-200/90 text-slate-700 hover:bg-slate-100/80 shadow-2xs"
        }`}
        title="Change Language / भाषा बदलें"
        aria-label="Change Language"
      >
        <svg
          className="w-4 h-4 text-emerald-600 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="text-[11px] font-black uppercase tracking-wider">
          {lang === "Hindi" ? "हिंदी" : "EN"}
        </span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-fade-in divide-y divide-slate-100">
          <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Language / भाषा
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={() => selectLanguage("English")}
              className={`w-full text-left px-3.5 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                lang === "English"
                  ? "bg-emerald-50 text-emerald-900 font-bold"
                  : "text-slate-700 hover:bg-slate-50 font-medium"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🇬🇧</span>
                <span>English</span>
              </div>
              {lang === "English" && (
                <span className="text-emerald-700 font-black text-xs">✓</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => selectLanguage("Hindi")}
              className={`w-full text-left px-3.5 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                lang === "Hindi"
                  ? "bg-emerald-50 text-emerald-900 font-bold"
                  : "text-slate-700 hover:bg-slate-50 font-medium"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🇮🇳</span>
                <span>हिंदी (Hinglish)</span>
              </div>
              {lang === "Hindi" && (
                <span className="text-emerald-700 font-black text-xs">✓</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
