import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../providers/auth_provider.dart';
import '../../services/messaging_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';

/// Guided setup for where this shop's messages come from: its own email
/// (Gmail App Password or a business mailbox) and its own WhatsApp Business number.
/// Same settings as the website's Settings › Communication.
class SenderSettingsScreen extends StatefulWidget {
  const SenderSettingsScreen({super.key});

  @override
  State<SenderSettingsScreen> createState() => _SenderSettingsScreenState();
}

enum _MailMode { gmail, smtp, platform }

class _Provider {
  final String label, host;
  final int port;
  const _Provider(this.label, this.host, this.port);
}

const _providers = [
  _Provider('Hostinger Email', 'smtp.hostinger.com', 465),
  _Provider('Zoho Mail (India)', 'smtp.zoho.in', 465),
  _Provider('Outlook / Microsoft 365', 'smtp.office365.com', 587),
  _Provider('Yahoo Mail', 'smtp.mail.yahoo.com', 465),
  _Provider('Other (enter details)', '', 465),
];

class _SenderSettingsScreenState extends State<SenderSettingsScreen> {
  final _svc = MessagingService();

  // WhatsApp
  bool _waOn = false;
  final _waNumber = TextEditingController();
  final _waPhoneId = TextEditingController();
  final _waAccountId = TextEditingController();
  final _waToken = TextEditingController();
  final _waTestTo = TextEditingController();
  bool _waTokenSet = false;
  String? _waTokenHint;

  // Email
  bool _emOn = true;
  _MailMode _mode = _MailMode.gmail;
  Map<String, dynamic> _acct = {};
  int _provider = 0;
  final _emUser = TextEditingController();
  final _emPass = TextEditingController();
  final _emHost = TextEditingController();
  final _emPort = TextEditingController(text: '465');
  bool _emSsl = true;
  final _senderName = TextEditingController();
  final _replyTo = TextEditingController();
  final _testTo = TextEditingController();

  Map<String, dynamic> _readiness = {};
  List<Map<String, dynamic>> _library = [];
  bool _loading = true;
  String? _error;
  String _busy = '';

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void initState() {
    super.initState();
    _emPass.addListener(() => setState(() {}));
    _load();
  }

  @override
  void dispose() {
    for (final c in [_waNumber, _waPhoneId, _waAccountId, _waToken, _waTestTo, _emUser, _emPass, _emHost, _emPort, _senderName, _replyTo, _testTo]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _acctConnected => _acct['connected'] == true;
  String get _acctHost => '${_acct['host'] ?? ''}';
  String get _acctUser => '${_acct['user'] ?? ''}';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final s = await _svc.settings();
      final wa = Map<String, dynamic>.from(s['whatsapp'] ?? {});
      final em = Map<String, dynamic>.from(s['email'] ?? {});
      _acct = Map<String, dynamic>.from(em['account'] ?? {});
      _readiness = Map<String, dynamic>.from(s['readiness'] ?? {});
      try {
        _library = await _svc.templateLibrary();
      } catch (_) {
        _library = [];
      }

      _waOn = wa['enabled'] == true;
      _waNumber.text = '${wa['displayNumber'] ?? ''}';
      _waPhoneId.text = '${wa['phoneNumberId'] ?? ''}';
      _waAccountId.text = '${wa['businessAccountId'] ?? ''}';
      _waToken.clear();
      _waTokenSet = wa['accessTokenSet'] == true;
      _waTokenHint = wa['accessTokenHint']?.toString();
      if (_waTestTo.text.isEmpty) _waTestTo.text = _waNumber.text;

      _emOn = em['enabled'] != false;
      _senderName.text = '${em['senderName'] ?? ''}';
      _replyTo.text = '${em['replyTo'] ?? ''}';
      _emPass.clear();
      if (_acctConnected) {
        _emUser.text = _acctUser;
        if (_acctHost == 'smtp.gmail.com') {
          _mode = _MailMode.gmail;
        } else {
          _mode = _MailMode.smtp;
          final i = _providers.indexWhere((p) => p.host == _acctHost);
          _provider = i >= 0 ? i : _providers.length - 1;
          _emHost.text = _acctHost;
          _emPort.text = '${_acct['port'] ?? 465}';
          _emSsl = _acct['secure'] == true;
        }
      } else {
        final emailReady = (_readiness['email'] as Map?)?['ready'] == true;
        _mode = emailReady ? _MailMode.platform : _MailMode.gmail;
        _applyProvider(_provider);
      }
    } catch (e) {
      _error = '$e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applyProvider(int i) {
    _provider = i;
    final p = _providers[i];
    if (p.host.isNotEmpty) {
      _emHost.text = p.host;
      _emPort.text = '${p.port}';
      _emSsl = p.port == 465;
    }
  }

  Future<bool> _run(String key, Future<String> Function() fn, {bool reload = true}) async {
    FocusScope.of(context).unfocus();
    setState(() => _busy = key);
    try {
      final msg = await fn();
      if (!mounted) return true;
      bizToast(context, msg);
      if (reload) await _load();
      return true;
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
      return false;
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _open(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) bizToast(context, 'Could not open $url', ok: false);
  }

  /// Builds the email save body, or returns an error message.
  Object _emailBody() {
    final body = <String, dynamic>{'enabled': _emOn, 'senderName': _senderName.text.trim(), 'replyTo': _replyTo.text.trim()};
    if (body['replyTo'] != '' && !_emailRe.hasMatch(body['replyTo'])) return 'Reply-to email is not valid';
    if (_mode == _MailMode.platform) {
      if (_acctConnected) body['clearAccount'] = true;
      return body;
    }
    final user = _emUser.text.trim();
    if (!_emailRe.hasMatch(user)) return _mode == _MailMode.gmail ? "Enter the shop's Gmail address" : 'Enter the full email address';
    if (_mode == _MailMode.gmail) {
      final pass = _emPass.text.replaceAll(RegExp(r'\s+'), '');
      final keep = _acctConnected && _acctHost == 'smtp.gmail.com' && _acctUser == user;
      if (pass.length != 16 && !(keep && pass.isEmpty)) return 'The App Password from Google has 16 letters';
      body['account'] = {'host': 'smtp.gmail.com', 'port': 465, 'secure': true, 'user': user, if (pass.isNotEmpty) 'password': pass};
      return body;
    }
    final host = _emHost.text.trim().toLowerCase();
    final port = int.tryParse(_emPort.text.trim());
    if (host.isEmpty || port == null) return 'Enter the SMTP server and port';
    final keep = _acctConnected && _acctHost == host && _acctUser == user;
    if (_emPass.text.isEmpty && !keep) return 'Enter the email password';
    body['account'] = {'host': host, 'port': port, 'secure': _emSsl, 'user': user, if (_emPass.text.isNotEmpty) 'password': _emPass.text};
    return body;
  }

  Future<void> _saveEmail({required bool thenTest}) async {
    final body = _emailBody();
    if (body is String) return bizToast(context, body, ok: false);
    final to = _testTo.text.trim();
    if (thenTest && !_emailRe.hasMatch(to)) return bizToast(context, 'Enter an email address to send the test to', ok: false);
    final ok = await _run('email', () => _svc.saveEmail(body as Map<String, dynamic>));
    if (ok && thenTest && mounted) await _run('etest', () => _svc.testEmail(to), reload: false);
  }

  Future<void> _saveWhatsApp({required bool thenVerify}) async {
    if (_waOn && (_waPhoneId.text.trim().isEmpty || (!_waTokenSet && _waToken.text.trim().isEmpty))) {
      return bizToast(context, 'Enter the Phone number ID and the permanent access token', ok: false);
    }
    final ok = await _run('wa', () => _svc.saveWhatsApp({
          'enabled': _waOn,
          'displayNumber': _waNumber.text.trim(),
          'phoneNumberId': _waPhoneId.text.trim(),
          'businessAccountId': _waAccountId.text.trim(),
          if (_waToken.text.trim().isNotEmpty) 'accessToken': _waToken.text.trim(),
        }));
    if (ok && thenVerify && mounted) await _run('verify', _svc.verifyWhatsApp);
  }

  // ───────────────────────── UI pieces ─────────────────────────

  Widget _gap([double h = 10]) => SizedBox(height: h);

  Widget _note(String text, {Color bg = const Color(0xFFF8FAFC), Color fg = AppColors.textSecondary}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Text(text, style: TextStyle(fontSize: 12, height: 1.4, color: fg)),
      );

  Widget _step(int n, String title, {String? sub, String? link, String? linkLabel}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.silver)),
            child: Text('$n', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              if (sub != null) Text(sub, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
              if (link != null)
                InkWell(
                  onTap: () => _open(link),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(linkLabel ?? link, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.emerald, decoration: TextDecoration.underline)),
                      const SizedBox(width: 3),
                      const Icon(Icons.open_in_new_rounded, size: 13, color: AppColors.emerald),
                    ]),
                  ),
                ),
            ]),
          ),
        ]),
      );

  Widget _status(IconData icon, String title, bool ready, String line) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: ready ? AppColors.successBg.withValues(alpha: 0.5) : AppColors.warningBg.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(icon, size: 18, color: ready ? AppColors.success : AppColors.warning),
              const SizedBox(width: 6),
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5))),
            ]),
            const SizedBox(height: 4),
            BizPill(ready ? 'Ready' : 'Not set up', color: ready ? AppColors.success : AppColors.warning),
            const SizedBox(height: 4),
            Text(line, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
          ]),
        ),
      );

  Widget _switch(String title, bool value, ValueChanged<bool> onChanged) => SwitchListTile(
        contentPadding: EdgeInsets.zero,
        dense: true,
        activeThumbColor: AppColors.emerald,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        value: value,
        onChanged: (v) => setState(() => onChanged(v)),
      );

  Widget _header(String title, String sub, IconData icon, Color color) => Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
            Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ),
      ]);

  Widget _emailCard() {
    final gmailLen = _emPass.text.replaceAll(RegExp(r'\s+'), '').length;
    final keepGmail = _acctConnected && _acctHost == 'smtp.gmail.com';
    final keepSmtp = _acctConnected && _acctHost != 'smtp.gmail.com';
    return BizCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _header('Email', 'Free. About 5 minutes with Gmail.', Icons.mail_outline_rounded, const Color(0xFF0284C7)),
        _switch('Send email to customers', _emOn, (v) => _emOn = v),
        const Text('Send emails from', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        _gap(6),
        SegmentedButton<_MailMode>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(value: _MailMode.gmail, label: Text('Gmail')),
            ButtonSegment(value: _MailMode.smtp, label: Text('Business')),
            ButtonSegment(value: _MailMode.platform, label: Text('NSYU')),
          ],
          selected: {_mode},
          onSelectionChanged: (v) => setState(() => _mode = v.first),
        ),
        _gap(12),
        if (_mode == _MailMode.gmail) ...[
          _step(1, "Sign in to the shop's Gmail and turn on 2-Step Verification",
              link: 'https://myaccount.google.com/signinoptions/twosv', linkLabel: 'Open 2-Step Verification'),
          _step(2, 'Create an App Password named “NSYU” and copy the 16 letters',
              sub: 'Your normal Gmail password will not work here.', link: 'https://myaccount.google.com/apppasswords', linkLabel: 'Open App Passwords'),
          _step(3, 'Paste both below, then Save & send test'),
          TextField(
            controller: _emUser,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: bizInput('Shop Gmail address', hint: 'yourshop@gmail.com'),
          ),
          _gap(),
          TextField(
            controller: _emPass,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            decoration: bizInput(keepGmail ? 'App Password (saved, leave empty to keep)' : 'App Password (16 letters)').copyWith(
              helperText: _emPass.text.isEmpty && keepGmail ? null : '$gmailLen/16 letters',
            ),
          ),
        ],
        if (_mode == _MailMode.smtp) ...[
          DropdownButtonFormField<int>(
            initialValue: _provider,
            isExpanded: true,
            decoration: bizInput('Email provider'),
            items: [for (var i = 0; i < _providers.length; i++) DropdownMenuItem(value: i, child: Text(_providers[i].label))],
            onChanged: (i) => setState(() => _applyProvider(i ?? 0)),
          ),
          _gap(),
          TextField(controller: _emUser, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: bizInput('Email address', hint: 'sales@yourshop.in')),
          _gap(),
          TextField(
            controller: _emPass,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            decoration: bizInput(keepSmtp ? 'Email password (saved, leave empty to keep)' : 'Email password'),
          ),
          if (_providers[_provider].host.isEmpty) ...[
            _gap(),
            TextField(controller: _emHost, keyboardType: TextInputType.url, autocorrect: false, decoration: bizInput('SMTP server', hint: 'smtp.example.com')),
            _gap(),
            TextField(
              controller: _emPort,
              keyboardType: TextInputType.number,
              decoration: bizInput('Port', hint: '465 or 587'),
              onChanged: (p) => setState(() => _emSsl = p.trim() == '465' ? true : (p.trim() == '587' ? false : _emSsl)),
            ),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('Server ${_emHost.text}, port ${_emPort.text} (filled in for you).', style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
            ),
        ],
        if (_mode == _MailMode.platform) _note('Emails go out from the NSYU platform address with your shop name. Customer replies go to the reply-to address below.'),
        _gap(12),
        TextField(controller: _senderName, decoration: bizInput('Name shown to customers', hint: 'Sharma Electronics')),
        _gap(),
        TextField(controller: _replyTo, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: bizInput('Reply-to email (optional)')),
        _gap(14),
        TextField(controller: _testTo, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: bizInput('Send a test email to', hint: 'you@example.com')),
        _gap(),
        FilledButton(
          onPressed: _busy.isEmpty ? () => _saveEmail(thenTest: true) : null,
          child: Text(_busy == 'email' || _busy == 'etest' ? 'Working…' : 'Save & send test'),
        ),
        TextButton(onPressed: _busy.isEmpty ? () => _saveEmail(thenTest: false) : null, child: const Text('Save without testing')),
      ]),
    );
  }

  Widget _whatsAppCard() => BizCard(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _header('WhatsApp Business', 'Official Meta Cloud API. Meta charges per message.', Icons.chat_rounded, AppColors.emerald),
          _switch('Send WhatsApp to customers', _waOn, (v) => _waOn = v),
          _note(
            'Cost (paid to Meta, not NSYU): bills and reminders about ₹0.12–0.15 per message, offers about ₹0.80–0.90. '
            'Replies within 24 hours of a customer\'s message are free. Use a number that is not already on the WhatsApp app.',
            bg: AppColors.warningBg.withValues(alpha: 0.6),
            fg: const Color(0xFF78350F),
          ),
          _gap(8),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(top: 4),
              initiallyExpanded: !_waTokenSet,
              title: const Text('How to get these details (about 1 hour)', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
              children: [
                _step(1, 'Create a Meta Business account', link: 'https://business.facebook.com/', linkLabel: 'business.facebook.com'),
                _step(2, 'Create an app (type “Business”) and add WhatsApp', link: 'https://developers.facebook.com/apps/', linkLabel: 'developers.facebook.com/apps'),
                _step(3, 'WhatsApp › API Setup: add your number, verify by OTP',
                    sub: 'Copy the Phone number ID and WhatsApp Business Account ID shown there.'),
                _step(4, 'Business settings › System users: create an Admin user, generate a token',
                    sub: 'Tick whatsapp_business_messaging and whatsapp_business_management, never expire.',
                    link: 'https://business.facebook.com/settings/system-users',
                    linkLabel: 'Open System users'),
                _step(5, 'Add a payment method in Meta Business settings'),
                _step(6, 'Paste the details below, Save, then send a test to your phone'),
              ],
            ),
          ),
          TextField(controller: _waNumber, keyboardType: TextInputType.phone, decoration: bizInput('Shop WhatsApp number', hint: '+91 98765 43210')),
          _gap(),
          TextField(controller: _waPhoneId, keyboardType: TextInputType.number, decoration: bizInput('Phone number ID', hint: 'WhatsApp › API Setup')),
          _gap(),
          TextField(controller: _waAccountId, keyboardType: TextInputType.number, decoration: bizInput('WhatsApp Business Account ID')),
          _gap(),
          TextField(
            controller: _waToken,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            decoration: bizInput(_waTokenSet ? 'Access token (saved ${_waTokenHint ?? ''}, leave empty to keep)' : 'Permanent access token'),
          ),
          _gap(12),
          FilledButton(
            onPressed: _busy.isEmpty ? () => _saveWhatsApp(thenVerify: true) : null,
            child: Text(_busy == 'wa' || _busy == 'verify' ? 'Checking…' : 'Save & check connection'),
          ),
          TextButton(onPressed: _busy.isEmpty ? () => _saveWhatsApp(thenVerify: false) : null, child: const Text('Save only')),
          const Divider(height: 20),
          Row(children: [
            Expanded(child: TextField(controller: _waTestTo, keyboardType: TextInputType.phone, decoration: bizInput('Send a test WhatsApp to'))),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: _busy.isEmpty && _waTokenSet
                  ? () {
                      final to = _waTestTo.text.trim();
                      if (to.isEmpty) return bizToast(context, 'Enter a mobile number', ok: false);
                      _run('watest', () => _svc.testWhatsApp(to), reload: false);
                    }
                  : null,
              child: Text(_busy == 'watest' ? 'Sending…' : 'Send'),
            ),
          ]),
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text("Sends Meta's “hello_world” message. Webhook and templates are on the website (Settings › Communication).",
                style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
          ),
        ]),
      );

  Widget _templatesCard() {
    final missing = _library.where((t) => t['added'] != true).length;
    final waReady = (_readiness['whatsapp'] as Map?)?['ready'] == true;
    return BizCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _header('Message templates', 'Ready-made bills, reminders, offers and greetings', Icons.auto_awesome_rounded, const Color(0xFF7C3AED)),
        _gap(10),
        Text(
          _library.isEmpty
              ? 'Could not load the template list.'
              : missing > 0
                  ? '${_library.length} ready-made templates. $missing not added yet. Automatic messages use them, and you can edit them on the website (Messaging › Templates).'
                  : 'All ${_library.length} ready-made templates are added. Edit them on the website (Messaging › Templates).',
          style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
        ),
        if (missing > 0) ...[
          _gap(10),
          FilledButton(
            onPressed: _busy.isEmpty ? () => _run('lib', () => _svc.addTemplateLibrary()) : null,
            child: Text(_busy == 'lib' ? 'Adding…' : 'Add all $missing templates'),
          ),
        ],
        _gap(6),
        OutlinedButton(
          onPressed: _busy.isEmpty && waReady ? () => _run('wasubmit', _svc.submitWhatsAppTemplates) : null,
          child: Text(_busy == 'wasubmit' ? 'Sending…' : 'Send templates to WhatsApp for approval'),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            waReady
                ? 'Meta must approve templates before WhatsApp can message customers who have not written to you in 24 hours. Usually a few minutes to a day.'
                : 'Connect WhatsApp above first.',
            style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
          ),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = context.watch<AuthProvider>().isOwner;
    final wa = Map<String, dynamic>.from(_readiness['whatsapp'] ?? {});
    final em = Map<String, dynamic>.from(_readiness['email'] ?? {});
    final emReady = em['ready'] == true;
    final waReady = wa['ready'] == true;
    final emLine = !_emOn
        ? 'Turned off'
        : _acctConnected
            ? 'From $_acctUser'
            : emReady
                ? 'From the NSYU platform email'
                : 'Not connected yet. Add your Gmail below.';
    final waLine = waReady
        ? 'From ${_waNumber.text.isEmpty ? 'your business number' : _waNumber.text}'
        : (!_waOn ? 'Turned off. Optional, Meta charges per message.' : 'Not connected yet. Add the details below.');
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Communication setup'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load settings', text: _error, error: true, action: 'Try again', onAction: _load)
              : AbsorbPointer(
                  absorbing: !isOwner,
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      if (!isOwner)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: Text('Only the shop owner can change these settings.', style: TextStyle(color: AppColors.textSecondary)),
                        ),
                      const Text(
                        "Bills, reminders and offers go to customers from your shop's own email and WhatsApp number. Both are optional.",
                        style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                      ),
                      _gap(12),
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _status(Icons.mail_outline_rounded, 'Email', emReady, emLine),
                        const SizedBox(width: 10),
                        _status(Icons.chat_rounded, 'WhatsApp', waReady, waLine),
                      ]),
                      _gap(16),
                      _emailCard(),
                      _gap(16),
                      _whatsAppCard(),
                      _gap(16),
                      _templatesCard(),
                      _gap(24),
                    ]),
                  ),
                ),
    );
  }
}
