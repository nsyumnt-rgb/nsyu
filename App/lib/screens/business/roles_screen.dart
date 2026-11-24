import 'package:flutter/material.dart';

import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';

/// Staff roles and what each role may view, create, edit and delete.
class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key});

  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  final _svc = BusinessService();
  Future<List<Map<String, dynamic>>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _svc.roles();
  }

  Future<void> _reload() async {
    final f = _svc.roles();
    setState(() => _future = f);
    await f.catchError((_) => <Map<String, dynamic>>[]);
  }

  Future<void> _create() async {
    final name = TextEditingController();
    final desc = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('New role'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, autofocus: true, textCapitalization: TextCapitalization.words, decoration: bizInput('Role name', hint: 'Cashier')),
          const SizedBox(height: 10),
          TextField(controller: desc, decoration: bizInput('Description (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.emerald), onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || name.text.trim().isEmpty) return;
    try {
      await _svc.createRole(name.text.trim(), desc.text.trim());
      if (!mounted) return;
      bizToast(context, 'Role created');
      _reload();
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Roles & permissions'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.emerald,
        foregroundColor: Colors.white,
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Role'),
      ),
      body: BizListBody<Map<String, dynamic>>(
        future: _future,
        onRefresh: _reload,
        empty: const BizState(icon: Icons.admin_panel_settings_rounded, title: 'No roles yet'),
        builder: (items) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            for (final r in items)
              BizCard(
                onTap: r['code'] == 'owner'
                    ? null
                    : () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => RolePermissionsScreen(role: r)));
                        _reload();
                      },
                child: Row(children: [
                  const CircleAvatar(backgroundColor: AppColors.blue50, child: Icon(Icons.shield_rounded, color: AppColors.emerald, size: 20)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                      if ((r['description'] ?? '').toString().isNotEmpty)
                        Text('${r['description']}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                  if (r['is_system'] == true) const BizPill('System'),
                  if (r['code'] != 'owner') const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}

class RolePermissionsScreen extends StatefulWidget {
  final Map<String, dynamic> role;
  const RolePermissionsScreen({super.key, required this.role});

  @override
  State<RolePermissionsScreen> createState() => _RolePermissionsScreenState();
}

class _RolePermissionsScreenState extends State<RolePermissionsScreen> {
  final _svc = BusinessService();
  List<Map<String, dynamic>> _modules = [];
  final Map<String, Map<String, bool>> _perm = {};
  bool _loading = true;
  bool _saving = false;
  bool _dirty = false;
  String? _error;

  static const _actions = ['can_view', 'can_create', 'can_edit', 'can_delete'];
  static const _actionLabels = ['View', 'Add', 'Edit', 'Delete'];

  int get _roleId => (widget.role['id'] as num).toInt();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final mods = await _svc.modules();
      final existing = ((widget.role['permissions'] ?? widget.role['rolePermissions'] ?? []) as List).map((e) => Map<String, dynamic>.from(e as Map));
      for (final p in existing) {
        _perm['${p['module']}'] = {for (final a in _actions) a: p[a] == true};
      }
      if (!mounted) return;
      setState(() {
        _modules = mods;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _svc.saveRolePermissions(_roleId, [
        for (final m in _modules) {'module': m['code'], ...?_perm['${m['code']}']},
      ]);
      if (!mounted) return;
      bizToast(context, 'Permissions saved');
      setState(() => _dirty = false);
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete role?'),
        content: Text('Staff with “${widget.role['name']}” lose these permissions.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _svc.deleteRole(_roleId);
      if (!mounted) return;
      bizToast(context, 'Role deleted');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('${widget.role['name']}', actions: [
        if (widget.role['is_system'] != true) IconButton(icon: const Icon(Icons.delete_outline_rounded), onPressed: _delete),
      ]),
      bottomNavigationBar: _loading || _error != null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: bizPrimaryButton(label: _saving ? 'Saving…' : (_dirty ? 'Save permissions' : 'Saved'), onPressed: _dirty && !_saving ? _save : null),
              ),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load', text: _error, error: true)
              : ListView(padding: const EdgeInsets.all(16), children: [
                  for (final m in _modules)
                    BizCard(
                      padding: const EdgeInsets.fromLTRB(14, 10, 8, 6),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${m['name'] ?? m['code']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        Wrap(spacing: 4, children: [
                          for (var i = 0; i < _actions.length; i++)
                            FilterChip(
                              label: Text(_actionLabels[i]),
                              selected: _perm['${m['code']}']?[_actions[i]] == true,
                              selectedColor: AppColors.blue100,
                              showCheckmark: true,
                              onSelected: (v) => setState(() {
                                final row = _perm.putIfAbsent('${m['code']}', () => {for (final a in _actions) a: false});
                                row[_actions[i]] = v;
                                if (v && i > 0) row['can_view'] = true; // any action needs view
                                if (!v && i == 0) {
                                  for (final a in _actions) {
                                    row[a] = false;
                                  }
                                }
                                _dirty = true;
                              }),
                            ),
                        ]),
                      ]),
                    ),
                ]),
    );
  }
}
