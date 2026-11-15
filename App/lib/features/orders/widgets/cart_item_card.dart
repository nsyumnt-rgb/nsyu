import 'package:flutter/material.dart';
import '../../../models/bill_item.dart';
import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/product_item_icon.dart';

class CartItemCard extends StatefulWidget {
  final BillItem item;
  final bool isOrder;
  final CatalogProvider provider;

  const CartItemCard({
    super.key,
    required this.item,
    required this.isOrder,
    required this.provider,
  });

  @override
  State<CartItemCard> createState() => _CartItemCardState();
}

class _CartItemCardState extends State<CartItemCard> {
  late TextEditingController _priceCtrl;
  late TextEditingController _qtyCtrl;

  @override
  void initState() {
    super.initState();
    _priceCtrl = TextEditingController(
      text: widget.item.price % 1 == 0
          ? widget.item.price.toInt().toString()
          : widget.item.price.toStringAsFixed(2),
    );
    _qtyCtrl = TextEditingController(text: widget.item.qty.toString());
  }

  @override
  void didUpdateWidget(covariant CartItemCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final parsedPrice = double.tryParse(_priceCtrl.text.replaceAll(',', '').trim());
    if (parsedPrice == null || (parsedPrice - widget.item.price).abs() > 0.001) {
      final newText = widget.item.price % 1 == 0
          ? widget.item.price.toInt().toString()
          : widget.item.price.toStringAsFixed(2);
      if (_priceCtrl.text != newText) {
        _priceCtrl.text = newText;
      }
    }

    final parsedQty = int.tryParse(_qtyCtrl.text.trim());
    if (parsedQty != widget.item.qty) {
      _qtyCtrl.text = widget.item.qty.toString();
    }
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    _qtyCtrl.dispose();
    super.dispose();
  }

  void _updateQty(int newQty) {
    if (newQty < 1) return;
    setState(() {
      widget.item.qty = newQty;
      _qtyCtrl.text = newQty.toString();
    });
    if (widget.isOrder) {
      widget.provider.updateOrderItemQty(widget.item.code, newQty);
    } else {
      widget.provider.updateItemQty(widget.item.code, newQty);
    }
  }

  @override
  Widget build(BuildContext context) {
    final it = widget.item;
    final isOrder = widget.isOrder;
    final provider = widget.provider;

    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Thumbnail + Title / Stock + Delete Button
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProductItemIcon(
                name: it.desc,
                category: it.category,
                sku: it.code,
                size: 44,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      it.desc.trim(),
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.25,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Text(
                          it.code,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: it.availableStock > 0
                                ? AppColors.successBg
                                : (it.availableStock == 0 ? AppColors.warningBg : AppColors.dangerBg),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            it.availableStock > 0
                                ? 'Stock: ${it.availableStock}'
                                : (it.availableStock == 0 ? 'Stock: 0' : 'Stock: ${it.availableStock}'),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: it.availableStock > 0
                                  ? AppColors.success
                                  : (it.availableStock == 0 ? AppColors.warning : AppColors.danger),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, size: 21, color: AppColors.danger),
                onPressed: () {
                  if (isOrder) {
                    provider.removeOrderItem(it.code);
                  } else {
                    provider.removeItem(it.code);
                  }
                },
                tooltip: 'Remove',
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
            ],
          ),

          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 10),

          // Bottom Row: Rate + Stepper + Line Total
          Row(
            children: [
              // Rate / Unit Price Input
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Rate (₹)',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.bg,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: TextField(
                        controller: _priceCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.navy900,
                        ),
                        decoration: const InputDecoration(
                          prefixText: ' ₹ ',
                          prefixStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.navy900),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                        ),
                        onChanged: (val) {
                          final p = double.tryParse(val.replaceAll(',', '').trim());
                          if (p != null) {
                            setState(() {
                              it.price = p;
                            });
                            provider.updateOrderItemPrice(it.code, p);
                            provider.updateItemPrice(it.code, p);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Quantity Stepper: [-] [qty] [+]
              Expanded(
                flex: 5,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Quantity',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () => _updateQty(it.qty - 1),
                            borderRadius: const BorderRadius.horizontal(left: Radius.circular(8)),
                            child: Container(
                              width: 30,
                              height: 36,
                              alignment: Alignment.center,
                              child: const Icon(Icons.remove, size: 16, color: AppColors.textPrimary),
                            ),
                          ),
                          Expanded(
                            child: TextField(
                              controller: _qtyCtrl,
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(horizontal: 2, vertical: 8),
                              ),
                              onChanged: (val) {
                                final q = int.tryParse(val.trim());
                                if (q != null && q >= 1) {
                                  setState(() {
                                    it.qty = q;
                                  });
                                  if (isOrder) {
                                    provider.updateOrderItemQty(it.code, q);
                                  } else {
                                    provider.updateItemQty(it.code, q);
                                  }
                                }
                              },
                            ),
                          ),
                          InkWell(
                            onTap: () => _updateQty(it.qty + 1),
                            borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
                            child: Container(
                              width: 30,
                              height: 36,
                              alignment: Alignment.center,
                              child: const Icon(Icons.add, size: 16, color: AppColors.navy900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Line Total
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Total',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 6),
                    AmountText(
                      amount: it.price * it.qty,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy900,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
