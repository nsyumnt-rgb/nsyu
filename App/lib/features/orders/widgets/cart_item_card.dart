import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/bill_item.dart';
import '../../../providers/catalog_provider.dart';
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
  final _money = NumberFormat('#,##0');
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

  @override
  Widget build(BuildContext context) {
    final it = widget.item;
    final isOrder = widget.isOrder;
    final provider = widget.provider;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Icon + Name / Code / Stock + Delete
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProductItemIcon(
                name: it.desc,
                category: it.category,
                sku: it.code,
                size: 42,
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
                        color: Color(0xFF0F172A),
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
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: it.availableStock < 0
                                ? const Color(0xFFFEE2E2)
                                : (it.availableStock == 0
                                    ? const Color(0xFFFEF3C7)
                                    : const Color(0xFFDCFCE7)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            it.availableStock < 0
                                ? 'Stock: ${it.availableStock}'
                                : (it.availableStock == 0
                                    ? 'Stock: 0'
                                    : 'In Stock: ${it.availableStock}'),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: it.availableStock < 0
                                  ? const Color(0xFFDC2626)
                                  : (it.availableStock == 0
                                      ? const Color(0xFFD97706)
                                      : const Color(0xFF16A34A)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFEF4444)),
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

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Bottom Row: Editable Price TextField + Editable Qty Stepper/TextField + Item Total
          Row(
            children: [
              // 1. Direct Editable Price Input
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Price',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Row(
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(left: 8, right: 2),
                            child: Text(
                              '₹',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF334155),
                              ),
                            ),
                          ),
                          Expanded(
                            child: TextField(
                              controller: _priceCtrl,
                              keyboardType:
                                  const TextInputType.numberWithOptions(decimal: true),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding:
                                    EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                              ),
                              onChanged: (val) {
                                final p =
                                    double.tryParse(val.replaceAll(',', '').trim());
                                if (p != null) {
                                  if (isOrder) {
                                    provider.updateOrderItemPrice(it.code, p);
                                  } else {
                                    provider.updateItemPrice(it.code, p);
                                  }
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // 2. Direct Editable Quantity Input with Stepper [-] [TextField] [+]
              Expanded(
                flex: 5,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Quantity',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () {
                              if (isOrder) {
                                provider.changeOrderQty(it.code, -1);
                              } else {
                                provider.changeQty(it.code, -1);
                              }
                            },
                            borderRadius:
                                const BorderRadius.horizontal(left: Radius.circular(7)),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                              child: Icon(Icons.remove, size: 15, color: Color(0xFF334155)),
                            ),
                          ),
                          Expanded(
                            child: Container(
                              color: Colors.white,
                              child: TextField(
                                controller: _qtyCtrl,
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                                ),
                                onChanged: (val) {
                                  final q = int.tryParse(val.trim());
                                  if (q != null && q > 0) {
                                    if (isOrder) {
                                      provider.updateOrderItemQty(it.code, q);
                                    } else {
                                      provider.updateItemQty(it.code, q);
                                    }
                                  }
                                },
                              ),
                            ),
                          ),
                          InkWell(
                            onTap: () {
                              if (isOrder) {
                                provider.changeOrderQty(it.code, 1);
                              } else {
                                provider.changeQty(it.code, 1);
                              }
                            },
                            borderRadius:
                                const BorderRadius.horizontal(right: Radius.circular(7)),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                              child: Icon(Icons.add, size: 15, color: Color(0xFF334155)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // 3. Item Total (Price * Qty)
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Total',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '₹${_money.format(it.price * it.qty)}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF006837),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
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
