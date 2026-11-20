import { useNavigate } from "react-router-dom";

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_STOPS = [
  {
    title: "1. Customer journey",
    desc: "Browse products, add to cart, checkout with Pay Later & partial payment.",
    path: "/market/search",
    role: "customer",
  },
  {
    title: "2. Owner accepts the order",
    desc: "Approve credit, stock is deducted, invoice is posted once to ledger.",
    path: "/app/orders",
    role: "owner",
  },
  {
    title: "3. POS counter sale",
    desc: "Bill a walk-in or named customer, part-pay, and watch instant stock deduction.",
    path: "/app/billing",
    role: "owner",
  },
  {
    title: "4. Customer credit ledger & Khata",
    desc: "Opening, bills, payments, outstanding balance, and WhatsApp reminders.",
    path: "/app/khata",
    role: "owner",
  },
  {
    title: "5. Publish and unpublish inventory",
    desc: "Toggle product listing status (Live / Offline / Draft) and check storefront visibility.",
    path: "/app/inventory",
    role: "owner",
  },
  {
    title: "6. B2B wholesale marketplace",
    desc: "Buy bulk wholesale accessories with volume discounts and purchase orders.",
    path: "/app/b2b-market",
    role: "buyer",
  },
  {
    title: "7. Super Admin approval",
    desc: "Approve newly registered shops, suspend non-compliant sellers, manage platform permissions.",
    path: "/admin/shops",
    role: "admin",
  },
  {
    title: "8. Mobile app wireframe",
    desc: "Explore customer and owner experiences in an interactive smartphone preview frame.",
    path: "/mobile",
    role: "mobile",
  },
];

export default function DemoGuideModal({ isOpen, onClose }: DemoGuideModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-fadeIn">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900">Demo guide</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Eight key stops that demonstrate the full end-to-end commerce platform.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="py-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {GUIDE_STOPS.map((stop, i) => (
            <div
              key={stop.title}
              className="p-3 rounded-xl border border-gray-100 hover:border-emerald-200 bg-white hover:bg-emerald-50/40 transition flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-900 truncate">{stop.title}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 pl-7 leading-relaxed">{stop.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(stop.path);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#064E3B] text-white text-xs font-bold shrink-0 transition cursor-pointer"
              >
                Go →
              </button>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Demo logins and OTPs are pre-filled automatically.</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
