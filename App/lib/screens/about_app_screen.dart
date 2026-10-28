import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AboutAppScreen extends StatelessWidget {
  const AboutAppScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('About App', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Center(
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1565C0),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1565C0).withOpacity(0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text(
                      'NSYU',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'NSYU Business Management',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Version 1.0.0 (Build 1)',
                  style: TextStyle(fontSize: 13, color: AppColors.muted, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Application Architecture',
                      style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  _specRow('App Name', 'nsyu_catalog_app'),
                  _specRow('Framework', 'Flutter 3 (Dart 3.x)'),
                  _specRow('Database', 'Supabase PostgreSQL'),
                  _specRow('Connection Pooler', 'aws-0-ap-south-1.pooler.supabase.com:5432'),
                  _specRow('API Backend', 'Node.js Express + Sequelize Pooler'),
                  _specRow('Local Storage', 'SharedPreferences & Offline Cache'),
                  _specRow('State Architecture', 'Provider ChangeNotifier Architecture'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Modules & Capabilities',
                      style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  _featureBullet('Point of Sale (POS) Billing & Thermal/PDF Invoice Printing'),
                  _featureBullet('Catalog & Multi-Shop Inventory Management'),
                  _featureBullet('Customer Ledger & Running Balance Tracking'),
                  _featureBullet('Inter-Shop Stock Transfer & Adjustment Audit Trail'),
                  _featureBullet('Automatic Margin & Selling Price Calculations'),
                  _featureBullet('Atomic Backup, Validation, and Transactional Restore'),
                  _featureBullet('Excel / CSV Catalog Import and Multi-Table Export'),
                  _featureBullet('Role-Based Access Control (Owner, Manager, Staff Permissions)'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Center(
            child: Text(
              '© 2026 NSYU Mobile Accessories. All rights reserved.',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ),
        ],
      ),
    );
  }

  Widget _specRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
          ),
        ],
      ),
    );
  }

  Widget _featureBullet(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 12.5, color: Color(0xFF334155))),
          ),
        ],
      ),
    );
  }
}
