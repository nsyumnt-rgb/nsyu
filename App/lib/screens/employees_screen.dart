import 'package:flutter/material.dart';
import '../services/supabase_service.dart';

class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  final SupabaseService _supabaseService = SupabaseService();
  final TextEditingController _searchCtrl = TextEditingController();

  List<Map<String, dynamic>> _employees = [];
  bool _loading = true;
  String? _error;
  String _selectedTab = 'All'; // All, Active, Inactive
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadEmployees();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadEmployees() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final list = await _supabaseService.fetchEmployees();
      if (!mounted) return;
      setState(() {
        _employees = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredEmployees {
    return _employees.where((emp) {
      final status = (emp['status'] ?? 'active').toString().toLowerCase();
      if (_selectedTab == 'Active' && status != 'active') return false;
      if (_selectedTab == 'Inactive' && status == 'active') return false;

      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final name = (emp['name'] ?? '').toString().toLowerCase();
        final code = (emp['reference_code'] ?? emp['id'] ?? '').toString().toLowerCase();
        final phone = (emp['phone'] ?? '').toString().toLowerCase();
        return name.contains(q) || code.contains(q) || phone.contains(q);
      }
      return true;
    }).toList();
  }

  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts[0].isEmpty) return 'EM';
    if (parts.length == 1) return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  String _getRole(Map<String, dynamic> emp) {
    if (emp['shopAssignments'] is List && (emp['shopAssignments'] as List).isNotEmpty) {
      final first = (emp['shopAssignments'] as List).first;
      if (first is Map && first['role'] is Map) {
        return first['role']['name'] ?? 'Staff';
      }
    }
    return emp['role']?.toString() ?? 'Staff';
  }

  void _showAddEmployeeDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final roleCtrl = TextEditingController(text: 'Sales Executive');
    bool saving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.person_add_alt_1, color: Color(0xFF1D4ED8)),
              SizedBox(width: 8),
              Text('Add New Employee', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Full Name *', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email Address *', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Mobile Number', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: roleCtrl,
                  decoration: const InputDecoration(labelText: 'Designation / Role', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: passwordCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password *', border: OutlineInputBorder()),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (nameCtrl.text.trim().isEmpty || emailCtrl.text.trim().isEmpty || passwordCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please fill all required fields')),
                        );
                        return;
                      }

                      setDialogState(() => saving = true);
                      try {
                        await _supabaseService.addEmployee(
                          name: nameCtrl.text.trim(),
                          email: emailCtrl.text.trim(),
                          password: passwordCtrl.text.trim(),
                          phone: phoneCtrl.text.trim(),
                          role: roleCtrl.text.trim(),
                        );
                        if (ctx.mounted) Navigator.pop(ctx);
                        _loadEmployees();
                      } catch (e) {
                        setDialogState(() => saving = false);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
              ),
              child: saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Save Employee'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final list = _filteredEmployees;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Employees',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: InkWell(
              onTap: _showAddEmployeeDialog,
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: Color(0xFF1D4ED8),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Tabs Section matching reference Image 9
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                // Search Bar
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => setState(() => _searchQuery = v.trim()),
                    decoration: InputDecoration(
                      hintText: 'Search employee by name, code...',
                      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: Color(0xFF64748B)),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Filter Tabs: All, Active, Inactive
                Row(
                  children: [
                    _filterChip('All'),
                    const SizedBox(width: 8),
                    _filterChip('Active'),
                    const SizedBox(width: 8),
                    _filterChip('Inactive'),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Employee List View
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8)))
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 40, color: Color(0xFFEF4444)),
                              const SizedBox(height: 12),
                              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadEmployees,
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8), foregroundColor: Colors.white),
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : list.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.badge_outlined, size: 48, color: Color(0xFF94A3B8)),
                                const SizedBox(height: 12),
                                Text(
                                  _searchQuery.isNotEmpty ? 'No employee matches "$_searchQuery"' : 'No employees found in this shop',
                                  style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: _showAddEmployeeDialog,
                                  icon: const Icon(Icons.add, size: 18),
                                  label: const Text('Add Employee'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF1D4ED8),
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            itemCount: list.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72, color: Color(0xFFF1F5F9)),
                            itemBuilder: (context, index) {
                              final emp = list[index];
                              final name = emp['name']?.toString() ?? 'Unnamed';
                              final refCode = emp['reference_code']?.toString() ?? 'EMP-${(emp['id']?.toString() ?? '1').padLeft(4, '0')}';
                              final role = _getRole(emp);
                              final status = (emp['status'] ?? 'active').toString().toLowerCase();
                              final isActive = status == 'active';
                              final initials = _getInitials(name);

                              return Container(
                                color: Colors.white,
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                                  leading: CircleAvatar(
                                    radius: 22,
                                    backgroundColor: const Color(0xFFDBEAFE),
                                    child: Text(
                                      initials,
                                      style: const TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF1D4ED8),
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    name,
                                    style: const TextStyle(
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          refCode,
                                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                        ),
                                        Text(
                                          role,
                                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                                        ),
                                      ],
                                    ),
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          isActive ? 'Active' : 'Inactive',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: isActive ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
                                    ],
                                  ),
                                  onTap: () {
                                    // Can open employee detail sheet
                                  },
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label) {
    final selected = _selectedTab == label;
    return InkWell(
      onTap: () => setState(() => _selectedTab = label),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1D4ED8) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? const Color(0xFF1D4ED8) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}
