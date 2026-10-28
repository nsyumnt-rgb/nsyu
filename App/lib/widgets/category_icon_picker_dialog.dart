import 'package:flutter/material.dart';
import '../utils/category_icon_helper.dart';

/// Interactive modal sheet to select and assign an icon to a product category.
class CategoryIconPickerDialog extends StatefulWidget {
  final String category;
  final VoidCallback onIconSelected;

  const CategoryIconPickerDialog({
    super.key,
    required this.category,
    required this.onIconSelected,
  });

  static Future<void> show(BuildContext context, String category, VoidCallback onIconSelected) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CategoryIconPickerDialog(
        category: category,
        onIconSelected: onIconSelected,
      ),
    );
  }

  @override
  State<CategoryIconPickerDialog> createState() => _CategoryIconPickerDialogState();
}

class _CategoryIconPickerDialogState extends State<CategoryIconPickerDialog> {
  late String _currentKey;

  @override
  void initState() {
    super.initState();
    _currentKey = CategoryIconHelper.getCategoryIconKey(widget.category) ?? '';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Choose Icon for "${widget.category}"',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Select an icon to represent this category across the app',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 340),
            child: GridView.builder(
              shrinkWrap: true,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.15,
              ),
              itemCount: CategoryIconHelper.availableIcons.length,
              itemBuilder: (context, i) {
                final def = CategoryIconHelper.availableIcons[i];
                final isSelected = _currentKey == def.key;

                return InkWell(
                  onTap: () async {
                    setState(() => _currentKey = def.key);
                    final nav = Navigator.of(context);
                    final sm = ScaffoldMessenger.of(context);
                    await CategoryIconHelper.setCategoryIcon(widget.category, def.key);
                    widget.onIconSelected();
                    if (!mounted) return;
                    nav.pop();
                    sm.clearSnackBars();
                    sm.showSnackBar(
                      SnackBar(
                        content: Text('Icon updated for "${widget.category}"'),
                        backgroundColor: const Color(0xFF1D4ED8),
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFE2E8F0),
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          def.icon,
                          size: 26,
                          color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF334155),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          def.label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
