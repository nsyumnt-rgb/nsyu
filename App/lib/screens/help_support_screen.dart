import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../config/supabase_config.dart';
import '../theme/app_theme.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  bool _checkingHealth = false;
  String _healthStatus = 'Unknown';
  bool _isHealthy = false;

  @override
  void initState() {
    super.initState();
    _checkServerHealth();
  }

  Future<void> _checkServerHealth() async {
    setState(() => _checkingHealth = true);
    try {
      final res = await http.get(Uri.parse('${SupabaseConfig.apiUrl.replaceAll('/api', '')}/health'));
      if (res.statusCode == 200) {
        setState(() {
          _healthStatus = 'Connected to Supabase PostgreSQL Backend';
          _isHealthy = true;
          _checkingHealth = false;
        });
      } else {
        setState(() {
          _healthStatus = 'Server responded with code ${res.statusCode}';
          _isHealthy = false;
          _checkingHealth = false;
        });
      }
    } catch (e) {
      setState(() {
        _healthStatus = 'Connection check: $e';
        _isHealthy = false;
        _checkingHealth = false;
      });
    }
  }

  Future<void> _launchCall(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _launchWhatsApp(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('https://wa.me/91$cleanPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchEmail(String email) async {
    final uri = Uri.parse('mailto:$email?subject=NSYU%20Support%20Request');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    const supportPhone = '8800503662';
    const supportEmail = 'nsyu.mnt@gmail.com';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Help & Support', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Quick Contact Card
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Direct Contact Channels',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Get in touch directly with NSYU technical & business support.',
                    style: TextStyle(fontSize: 13, color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  _contactButton(
                    icon: Icons.phone_in_talk_rounded,
                    title: 'Call Support',
                    subtitle: '+91 $supportPhone',
                    color: const Color(0xFF1565C0),
                    onTap: () => _launchCall(supportPhone),
                  ),
                  const SizedBox(height: 10),
                  _contactButton(
                    icon: Icons.chat_rounded,
                    title: 'WhatsApp Support',
                    subtitle: '+91 $supportPhone (Quick Chat)',
                    color: const Color(0xFF16A34A),
                    onTap: () => _launchWhatsApp(supportPhone),
                  ),
                  const SizedBox(height: 10),
                  _contactButton(
                    icon: Icons.email_outlined,
                    title: 'Email Support',
                    subtitle: supportEmail,
                    color: const Color(0xFF7C3AED),
                    onTap: () => _launchEmail(supportEmail),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // System Diagnostics Card
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'System & Connection Status',
                        style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.refresh, size: 20),
                        onPressed: _checkServerHealth,
                        tooltip: 'Check Connection',
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _isHealthy ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _isHealthy ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isHealthy ? Icons.check_circle : Icons.error_outline,
                          color: _isHealthy ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _checkingHealth ? 'Checking backend connectivity...' : _healthStatus,
                            style: TextStyle(
                              color: _isHealthy ? const Color(0xFF166534) : const Color(0xFF991B1B),
                              fontWeight: FontWeight.w600,
                              fontSize: 12.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('• Database: Supabase PostgreSQL (aws-0-ap-south-1.pooler.supabase.com:5432)',
                      style: TextStyle(fontSize: 12, color: AppColors.muted)),
                  const SizedBox(height: 4),
                  Text('• API Endpoint: ${SupabaseConfig.apiUrl}',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // FAQs & Guides
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Frequently Asked Questions',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 12),
                  _faqItem(
                    question: 'How do I generate and print a bill?',
                    answer:
                        'Navigate to the "Bills" tab, select your customer, add products from the catalog, enter any discounts or payments, and tap "Generate & Print Bill" to download or share the PDF invoice.',
                  ),
                  _faqItem(
                    question: 'How do product margins work?',
                    answer:
                        'In Inventory, each product has a Purchase Price and Margin Price. The Selling Price is automatically calculated as: Selling Price = Purchase Price + Margin Price. Updating margin immediately syncs to the database.',
                  ),
                  _faqItem(
                    question: 'How do I safeguard business records?',
                    answer:
                        'Go to Profile > Backup & Restore to generate a verified JSON backup file. You can share or store it securely, and restore it whenever needed.',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _contactButton({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.muted),
          ],
        ),
      ),
    );
  }

  Widget _faqItem({required String question, required String answer}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        title: Text(question, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 10),
        children: [
          Text(answer, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.4)),
        ],
      ),
    );
  }
}
