import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getMarketCategories } from "../api/marketplace";
import { resolveAssetUrl } from "../api/client";

interface CategoryItem {
  name: string;
  count: number;
  imageUrl?: string | null;
  icon?: string | null;
}

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

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMarketCategories()
      .then((cats) => {
        setCategories(cats);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <aside className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
      {/* Sidebar Header with Green Bar */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 font-extrabold text-navy-900 text-[13.5px] tracking-tight">
        <span className="w-1.5 h-4 rounded-full bg-[#047857] inline-block" />
        <span>Categories</span>
      </div>

      {/* Dynamic Category List */}
      <nav className="space-y-1">
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No categories found</div>
        ) : (
          categories.map((cat) => {
            const isActive = currentCategory.toLowerCase() === cat.name.toLowerCase();
            const targetUrl = `/market/search?category=${encodeURIComponent(cat.name)}`;

            return (
              <Link
                key={cat.name}
                to={targetUrl}
                onClick={(e) => {
                  if (onSelectCategory) {
                    e.preventDefault();
                    onSelectCategory(cat.name);
                  }
                }}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 font-bold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {cat.imageUrl ? (
                    <img
                      src={resolveAssetUrl(cat.imageUrl) ?? undefined}
                      alt={cat.name}
                      className="w-5 h-5 object-cover rounded-md shrink-0 bg-slate-50 border border-slate-100"
                    />
                  ) : (
                    <span className="text-sm shrink-0">{cat.icon || "📦"}</span>
                  )}
                  <span className="truncate">{cat.name}</span>
                  {cat.count !== undefined && cat.count > 0 && (
                    <span className="text-[10px] text-slate-400 font-normal">({cat.count})</span>
                  )}
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 ${
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
          })
        )}
      </nav>
    </aside>
  );
}
