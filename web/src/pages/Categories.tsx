import { Link } from "react-router-dom";

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  count: number;
  subcategories: { name: string; count: number }[];
}

const CATEGORIES_DATA: CategoryItem[] = [
  {
    id: "c1",
    name: "Mobile Accessories",
    icon: "🔌",
    count: 24,
    subcategories: [
      { name: "Phone Cases", count: 12 },
      { name: "Screen Guards", count: 8 },
      { name: "Car Holders", count: 4 },
    ],
  },
  {
    id: "c2",
    name: "Mobile Phones",
    icon: "📱",
    count: 18,
    subcategories: [
      { name: "5G Smartphones", count: 10 },
      { name: "Budget Phones", count: 6 },
      { name: "Feature Phones", count: 2 },
    ],
  },
  {
    id: "c3",
    name: "Chargers & Adapters",
    icon: "⚡",
    count: 16,
    subcategories: [
      { name: "Fast USB-C", count: 9 },
      { name: "GaN Chargers", count: 4 },
      { name: "Wireless Chargers", count: 3 },
    ],
  },
  {
    id: "c4",
    name: "Data Cables",
    icon: "🧵",
    count: 14,
    subcategories: [
      { name: "Type-C Braided", count: 8 },
      { name: "Lightning Cables", count: 4 },
      { name: "Micro USB", count: 2 },
    ],
  },
  {
    id: "c5",
    name: "Earphones & TWS",
    icon: "🎧",
    count: 20,
    subcategories: [
      { name: "Wireless Earbuds", count: 12 },
      { name: "Wired Earphones", count: 5 },
      { name: "Gaming TWS", count: 3 },
    ],
  },
  {
    id: "c6",
    name: "Neckbands",
    icon: "📿",
    count: 12,
    subcategories: [
      { name: "Fast Charge", count: 7 },
      { name: "Bass Boost", count: 5 },
    ],
  },
  {
    id: "c7",
    name: "Over-Ear Headphones",
    icon: "🎧",
    count: 9,
    subcategories: [
      { name: "Noise Cancelling", count: 5 },
      { name: "Studio Monitor", count: 4 },
    ],
  },
  {
    id: "c8",
    name: "Bluetooth Speakers",
    icon: "🔊",
    count: 15,
    subcategories: [
      { name: "Portable Speakers", count: 9 },
      { name: "Party Speakers", count: 4 },
      { name: "Soundbars", count: 2 },
    ],
  },
  {
    id: "c9",
    name: "Smart Watches",
    icon: "⌚",
    count: 11,
    subcategories: [
      { name: "Bluetooth Calling", count: 7 },
      { name: "Fitness Bands", count: 4 },
    ],
  },
  {
    id: "c10",
    name: "Televisions",
    icon: "📺",
    count: 8,
    subcategories: [
      { name: "Smart TVs", count: 5 },
      { name: "4K Ultra HD", count: 3 },
    ],
  },
  {
    id: "c11",
    name: "Refrigerators",
    icon: "🧊",
    count: 6,
    subcategories: [
      { name: "Double Door", count: 4 },
      { name: "Single Door", count: 2 },
    ],
  },
  {
    id: "c12",
    name: "Washing Machines",
    icon: "🧺",
    count: 7,
    subcategories: [
      { name: "Top Load", count: 4 },
      { name: "Front Load", count: 3 },
    ],
  },
  {
    id: "c13",
    name: "Kitchen Appliances",
    icon: "🍳",
    count: 13,
    subcategories: [
      { name: "Mixer Grinders", count: 7 },
      { name: "Induction Cooktops", count: 6 },
    ],
  },
  {
    id: "c14",
    name: "Home Appliances",
    icon: "🏠",
    count: 10,
    subcategories: [
      { name: "Fans & Coolers", count: 6 },
      { name: "Room Heaters", count: 4 },
    ],
  },
  {
    id: "c15",
    name: "Computer Accessories",
    icon: "💻",
    count: 14,
    subcategories: [
      { name: "Keyboards & Mice", count: 8 },
      { name: "FHD Monitors", count: 4 },
      { name: "USB Hubs", count: 2 },
    ],
  },
];

export default function Categories() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            All categories
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Pick a category to see live products from every active verified shop.
          </p>
        </div>
        <Link
          to="/market/search"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
        >
          View all products →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {CATEGORIES_DATA.map((c) => (
          <div
            key={c.id}
            className="p-4 rounded-2xl bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-md transition flex flex-col justify-between space-y-3 group"
          >
            <div>
              <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100/50 flex items-center justify-center text-4xl mb-3 group-hover:scale-105 transition-transform duration-300">
                {c.icon}
              </div>
              <div className="flex items-center justify-between">
                <Link
                  to={`/market/search?category=${encodeURIComponent(c.name)}`}
                  className="font-extrabold text-sm text-gray-900 group-hover:text-emerald-700 transition"
                >
                  {c.name}
                </Link>
                <span className="text-[11px] text-gray-400 font-semibold">
                  {c.count} items
                </span>
              </div>
            </div>

            {/* Subcategories Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
              {c.subcategories.map((sub) => (
                <Link
                  key={sub.name}
                  to={`/market/search?category=${encodeURIComponent(sub.name)}`}
                  className="px-2 py-0.5 rounded-full bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-800 text-[10.5px] font-semibold border border-gray-200 transition"
                >
                  {sub.name} · {sub.count}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
