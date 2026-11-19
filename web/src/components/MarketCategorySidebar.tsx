import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getMarketCategories } from "../api/marketplace";

interface CategoryItem {
  name: string;
  count?: number;
  icon: string;
}

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { name: "Electronics", icon: "💻" },
  { name: "Accessories", icon: "🎧" },
  { name: "Home & Living", icon: "🏠" },
  { name: "Fashion", icon: "👕" },
  { name: "Beauty & Personal Care", icon: "🪷" },
  { name: "Health & Wellness", icon: "❤️" },
  { name: "Sports & Fitness", icon: "🏀" },
  { name: "More Categories", icon: "•••" },
];

export default function MarketCategorySidebar({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentCategory = selectedCategory || searchParams.get("category") || "";

  const [dbCategories, setDbCategories] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    getMarketCategories()
      .then((cats) => setDbCategories(cats))
      .catch(() => {});
  }, []);

  // Merge default showcase categories with database categories
  const categoriesToDisplay = DEFAULT_CATEGORIES.map((cat) => {
    const matched = dbCategories.find(
      (c) => c.name.toLowerCase() === cat.name.toLowerCase()
    );
    return {
      ...cat,
      count: matched ? matched.count : undefined,
    };
  });

  return (
    <aside className="w-full bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3">
      {/* Sidebar Header with Green Bar */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 font-black text-gray-900 text-[13.5px] tracking-tight">
        <span className="w-1.5 h-4 rounded-full bg-[#047857] inline-block" />
        <span>Categories</span>
      </div>

      {/* Category List */}
      <nav className="space-y-1">
        {categoriesToDisplay.map((cat) => {
          const isActive =
            currentCategory.toLowerCase() === cat.name.toLowerCase();

          const targetUrl =
            cat.name === "More Categories"
              ? "/market/search"
              : `/market/search?category=${encodeURIComponent(cat.name)}`;

          return (
            <Link
              key={cat.name}
              to={targetUrl}
              onClick={(e) => {
                if (onSelectCategory && cat.name !== "More Categories") {
                  e.preventDefault();
                  onSelectCategory(cat.name);
                }
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? "bg-emerald-50 text-emerald-800 font-bold"
                  : "text-gray-700 hover:bg-gray-50 hover:text-emerald-700"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm shrink-0">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
                {cat.count !== undefined && cat.count > 0 && (
                  <span className="text-[10px] text-gray-400 font-normal">
                    ({cat.count})
                  </span>
                )}
              </div>
              <svg
                className={`w-3.5 h-3.5 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 ${
                  isActive ? "text-emerald-700" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
