import { useEffect, useState } from "react";

const HINGLISH_MAP: Record<string, string> = {
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
  "Search by name, SKU or scan barcode": "Naam, brand ya barcode se khojein",
  "Customers": "Grahak",
  "Invoices": "Bill",
  "Payments": "Bhugtaan",
  "Add customer": "Naya grahak",
  "Shopping cart": "Aapki cart",
  "Marketplace": "Marketplace (bazaar)",
  "All categories": "Saari categories",
};

export default function HinglishToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;

    const translateNode = (node: Node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode: Node | null;
      while ((textNode = walker.nextNode())) {
        const val = textNode.nodeValue?.trim() || "";
        if (HINGLISH_MAP[val] && textNode.parentElement && !textNode.parentElement.closest("#hl")) {
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
  }, [active]);

  return (
    <button
      id="hl"
      type="button"
      onClick={() => setActive((v) => !v)}
      className="fixed left-4 bottom-4 z-40 bg-[#0F7A55] hover:bg-[#064E3B] text-white text-xs font-bold px-3.5 py-2 rounded-full shadow-lg transition active:scale-95 border border-white/20 cursor-pointer flex items-center gap-1.5"
      title="Toggle Hinglish / Hindi shopkeeper labels"
    >
      <span>🌐</span>
      <span>हिंदी / Hinglish: {active ? "On" : "Off"}</span>
    </button>
  );
}
