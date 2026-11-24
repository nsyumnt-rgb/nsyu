import 'package:flutter/material.dart';

import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';

/// Product categories: add, rename, switch on/off, delete (same data as the website).
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  final _svc = BusinessService();
  Future<List<Map<String, dynamic>>>? _future;
  String _q = '';

  @override
  void initState() {
    super.initState();
    _future = _svc.categories();
  }

  Future<void> _reload() async {
    final f = _svc.categories();
    setState(() => _future = f);
    await f.catchError((_) => <Map<String, dynamic>>[]);
  }

  Future<void> _edit([Map<String, dynamic>? c]) async {
    final ctrl = TextEditingController(text: c?['name']?.toString() ?? '');
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(c == null ? 'New category' : 'Rename category'),
        content: TextField(controller: ctrl, autofocus: true, textCapitalization: TextCapitalization.words, decoration: bizInput('Category name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.emerald),
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty || !mounted) return;
    try {
      if (c == null) {
        await _svc.createCategory(name);
      } else {
        await _svc.renameCategory((c['id'] as num).toInt(), name);
      }
      if (!mounted) return;
      bizToast(context, c == null ? 'Category added' : 'Category renamed');
      _reload();
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    }
  }

  Future<void> _delete(Map<String, dynamic> c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete category?'),
        content: Text('“${c['name']}” will be removed. Products in it keep their data.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _svc.deleteCategory((c['id'] as num).toInt());
      if (!mounted) return;
      bizToast(context, 'Category deleted');
      _reload();
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Categories'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.emerald,
        foregroundColor: Colors.white,
        onPressed: () => _edit(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Category'),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: bizInput('Search categories', icon: Icons.search_rounded)),
        ),
        Expanded(
          child: BizListBody<Map<String, dynamic>>(
            future: _future,
            onRefresh: _reload,
            empty: const BizState(icon: Icons.category_rounded, title: 'No categories yet', text: 'Add categories to group your products.'),
            builder: (items) {
              final list = items.where((c) => '${c['name']}'.toLowerCase().contains(_q)).toList();
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                itemCount: list.length,
                itemBuilder: (_, i) {
                  final c = list[i];
                  final active = c['status'] != 'inactive';
                  final count = c['productCount'] ?? c['product_count'] ?? (c['products'] is List ? (c['products'] as List).length : null);
                  return BizCard(
                    padding: const EdgeInsets.fromLTRB(14, 6, 4, 6),
                    child: Row(children: [
                      CircleAvatar(
                        backgroundColor: AppColors.blue50,
                        child: Text('${c['name']}'.isEmpty ? '?' : '${c['name']}'[0].toUpperCase(),
                            style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.emerald)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${c['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5), overflow: TextOverflow.ellipsis),
                          if (count != null) Text('$count products', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        ]),
                      ),
                      Switch.adaptive(
                        value: active,
                        activeTrackColor: AppColors.emerald,
                        onChanged: (v) async {
                          try {
                            await _svc.setCategoryStatus((c['id'] as num).toInt(), v);
                            _reload();
                          } catch (e) {
                            if (context.mounted) bizToast(context, '$e', ok: false);
                          }
                        },
                      ),
                      PopupMenuButton<String>(
                        onSelected: (v) => v == 'edit' ? _edit(c) : _delete(c),
                        itemBuilder: (_) => const [
                          PopupMenuItem(value: 'edit', child: Text('Rename')),
                          PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: AppColors.danger))),
                        ],
                      ),
                    ]),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}
