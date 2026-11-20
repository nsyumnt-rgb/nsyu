-- 11_product_live_price_category_alias.sql
-- Adds live_price for products (customer online rate) and alias for categories (e.g. CH, NB, PB)

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS live_price NUMERIC(12, 2);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS alias VARCHAR(20);

COMMENT ON COLUMN public.products.live_price IS 'Live online storefront selling price visible to customers';
COMMENT ON COLUMN public.categories.alias IS 'Short category code badge (e.g. CH for Charger, NB for Neck Band, PB for Power Bank)';
