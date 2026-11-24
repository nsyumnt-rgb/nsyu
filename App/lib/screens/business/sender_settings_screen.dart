import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/messaging_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';

/// Which WhatsApp number and which email address this shop's messages go out from.
/// Same settings as the website's Messaging › Channels.
class SenderSettingsScreen extends StatefulWidget {
  const SenderSettingsScreen({super.key});

  @override
  State<SenderSettingsScreen> createState() => _SenderSettingsScreenState();
}

enum _MailMode { platform, gmail, smtp }

class _SenderSettingsScreenState extends State<SenderSettingsScreen> {
  final _svc = MessagingService();

  // WhatsApp
  bool _waOn = false;
  final _waNumber = TextEditingController();
  final _waPhoneId = TextEditingController();
  final _waAccountId = TextEditingController();
  final _waToken = TextEditingController();
  bool _waTokenSet = false;
  String? _waTokenHint;

  // Email
  bool _emOn = true;
  _MailMode _mode = _MailMode.platform;
  bool _accountConnected = false;
  bool _passwordSet = false;
  String _connectedUser = '';
  final _emUser = TextEditingController();
  final _emPass = TextEditingController();
  final _emHost = TextEditingController();
  final _emPort = TextEditingController(text: '587');
  bool _emSsl = false;
  final _senderName = TextEditingController();
  final _replyTo = TextEditingController();
  final _testTo = TextEditingController();

  Map<String, dynamic> _readiness = {};
  bool _loading = true;
  String? _error;
  String _busy = '';

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [_waNumber, _waPhoneId, _waAccountId, _waToken, _emUser, _emPass, _emHost, _emPort, _senderName, _replyTo, _testTo]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final s = await _svc.settings();
      final wa = Map<String, dynamic>.from(s['whatsapp'] ?? {});
      final em = Map<String, dynamic>.from(s['email'] ?? {});
      final acct = Map<String, dynamic>.from(em['account'] ?? {});
      _readiness = Map<String, dynamic>.from(s['readiness'] ?? {});

      _waOn = wa['enabled'] == true;
      _waNumber.text = '${wa['displayNumber'] ?? ''}';
      _waPhoneId.text = '${wa['phoneNumberId'] ?? ''}';
      _waAccountId.text = '${wa['businessAccountId'] ?? ''}';
      _waToken.clear();
      _waTokenSet = wa['accessTokenSet'] == true;
      _waTokenHint = wa['accessTokenHint']?.toString();

      _emOn = em['enabled'] != false;
      _senderName.text = '${em['senderName'] ?? ''}';
      _replyTo.text = '${em['replyTo'] ?? ''}';
      _accountConnected = acct['connected'] == true;
      _passwordSet = acct['passwordSet'] == true;
      _connectedUser = '${acct['user'] ?? ''}';
      _emPass.clear();
      if (_accountConnected) {
        final host = '${acct['host'] ?? ''}';
        _mode = host == 'smtp.gmail.com' ? _MailMode.gmail : _MailMode.smtp;
        _emUser.text = _connectedUser;
        _emHost.text = host;
        _emPort.text = '${acct['port'] ?? 587}';
        _emSsl = acct['secure'] == true;
      } else {
        _mode = _MailMode.platform;
      }
    } catch (e) {
      _error = '$e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _run(String key, Future<String> Function() fn, {bool reload = true}) async {
    FocusScope.of(context).unfocus();
    setState(() => _busy = key);
    try {
      final msg = await fn();
      if (!mounted) return;
      bizToast(context, msg);
      if (reload) await _load();
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _saveWhatsApp() async {
    if (_waOn && _waPhoneId.text.trim().isEmpty) {
      return bizToast(context, 'Enter the Phone number ID from WhatsApp Manager', ok: false);
    }
    await _run('wa', () => _svc.saveWhatsApp({
          'enabled': _waOn,
          'displayNumber': _waNumber.text.trim(),
          'phoneNumberId': _waPhoneId.text.trim(),
          'businessAccountId': _waAccountId.text.trim(),
          if (_waToken.text.trim().isNotEmpty) 'accessToken': _waToken.text.trim(),
        }));
  }

  Future<void> _saveEmail() async {
    final body = <String, dynamic>{
      'enabled': _emOn,
      'senderName': _senderName.text.trim(),
      'replyTo': _replyTo.text.trim(),
    };
    if (body['replyTo'] != '' && !_emailRe.hasMatch(body['replyTo'])) {
      return bizToast(context, 'Reply-to email is not valid', ok: false);
    }
    if (_mode == _MailMode.platform) {
      if (_accountConnected) body['clearAccount'] = true;
    } else {
      final user = _emUser.text.trim();
      if (!_emailRe.hasMatch(user)) return bizToast(context, 'Enter the full email address', ok: false);
      if (!_passwordSet && _emPass.text.trim().isEmpty) {
        return bizToast(context, _mode == _MailMode.gmail ? 'Enter the Gmail App Password' : 'Enter the email password', ok: false);
      }
      if (_mode == _MailMode.gmail) {
        body['account'] = {'host': 'smtp.gmail.com', 'port': 465, 'secure': true, 'user': user};
      } else {
        final port = int.tryParse(_emPort.text.trim());
        if (_emHost.text.trim().isEmpty || port == null) return bizToast(context, 'Enter the SMTP server and port', ok: false);
        body['account'] = {'host': _emHost.text.trim(), 'port': port, 'secure': _emSsl, 'user': user};
      }
      if (_emPass.text.trim().isNotEmpty) (body['account'] as Map)['password'] = _emPass.text;
    }
    await _run('email', () => _svc.saveEmail(body));
  }

  Widget _section(String title, String? status, bool ready, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
            child: Row(children: [
              Expanded(
                child: Text(title, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.textSecondary)),
              ),
              BizPill(ready ? 'Ready' : 'Not ready', color: ready ? AppColors.emerald : AppColors.warning),
            ]),
          ),
          BizCard(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (!ready && status != null && status.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(status, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ),
              ...children,
            ]),
          ),
        ]),
      );

  Widget _gap() => const SizedBox(height: 10);

  Widget _switch(String title, bool value, ValueChanged<bool> onChanged) => SwitchListTile(
        contentPadding: EdgeInsets.zero,
        dense: true,
        activeThumbColor: AppColors.emerald,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        value: value,
        onChanged: (v) => setState(() => onChanged(v)),
      );

  @override
  Widget build(BuildContext context) {
    final isOwner = context.watch<AuthProvider>().isOwner;
    final wa = Map<String, dynamic>.from(_readiness['whatsapp'] ?? {});
    final em = Map<String, dynamic>.from(_readiness['email'] ?? {});
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('WhatsApp & email sender'),
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
                      _section('WHATSAPP NUMBER', wa['reason']?.toString(), wa['ready'] == true, [
                        _switch('Send messages on WhatsApp', _waOn, (v) => _waOn = v),
                        _gap(),
                        TextField(controller: _waNumber, keyboardType: TextInputType.phone, decoration: bizInput('Shop WhatsApp number', hint: '+91 98765 43210')),
                        _gap(),
                        TextField(controller: _waPhoneId, keyboardType: TextInputType.number, decoration: bizInput('Phone number ID', hint: 'WhatsApp Manager → API setup')),
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
                        const SizedBox(height: 8),
                        const Text(
                          'Uses the official WhatsApp Business Cloud API. Webhook and app secret can be set on the website (Messaging › Channels).',
                          style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 12),
                        Row(children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: _busy.isEmpty ? _saveWhatsApp : null,
                              child: Text(_busy == 'wa' ? 'Saving…' : 'Save WhatsApp'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _busy.isEmpty && _waTokenSet ? () => _run('verify', _svc.verifyWhatsApp, reload: true) : null,
                              child: Text(_busy == 'verify' ? 'Checking…' : 'Test connection'),
                            ),
                          ),
                        ]),
                      ]),
                      _section('EMAIL ADDRESS', em['reason']?.toString(), em['ready'] == true, [
                        _switch('Send messages by email', _emOn, (v) => _emOn = v),
                        _gap(),
                        const Text('Send emails from', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        SegmentedButton<_MailMode>(
                          showSelectedIcon: false,
                          segments: const [
                            ButtonSegment(value: _MailMode.platform, label: Text('Platform')),
                            ButtonSegment(value: _MailMode.gmail, label: Text('Shop Gmail')),
                            ButtonSegment(value: _MailMode.smtp, label: Text('Other')),
                          ],
                          selected: {_mode},
                          onSelectionChanged: (v) => setState(() => _mode = v.first),
                        ),
                        if (_accountConnected)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text('Currently sending from $_connectedUser', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ),
                        if (_mode == _MailMode.platform)
                          const Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text('Emails go out from the NSYU platform address with your shop name.',
                                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ),
                        if (_mode == _MailMode.smtp) ...[
                          _gap(),
                          TextField(controller: _emHost, keyboardType: TextInputType.url, autocorrect: false, decoration: bizInput('SMTP server', hint: 'smtp.hostinger.com')),
                          _gap(),
                          TextField(
                            controller: _emPort,
                            keyboardType: TextInputType.number,
                            decoration: bizInput('Port', hint: '465 or 587'),
                            onChanged: (p) => setState(() => _emSsl = p.trim() == '465' ? true : (p.trim() == '587' ? false : _emSsl)),
                          ),
                          _switch('Use SSL (port 465)', _emSsl, (v) => _emSsl = v),
                        ],
                        if (_mode != _MailMode.platform) ...[
                          _gap(),
                          TextField(
                            controller: _emUser,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            decoration: bizInput(_mode == _MailMode.gmail ? 'Shop Gmail address' : 'Email login', hint: 'yourshop@gmail.com'),
                          ),
                          _gap(),
                          TextField(
                            controller: _emPass,
                            obscureText: true,
                            autocorrect: false,
                            enableSuggestions: false,
                            decoration: bizInput(_passwordSet
                                ? 'Password saved, leave empty to keep'
                                : (_mode == _MailMode.gmail ? 'Gmail App Password (16 letters)' : 'Password')),
                          ),
                          if (_mode == _MailMode.gmail)
                            const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: Text(
                                'Turn on 2-Step Verification in your Google account, then create an App Password at myaccount.google.com/apppasswords. Your normal Gmail password will not work.',
                                style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                              ),
                            ),
                        ],
                        _gap(),
                        TextField(controller: _senderName, decoration: bizInput('Sender name', hint: 'Shown as “From” in the inbox')),
                        _gap(),
                        TextField(controller: _replyTo, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: bizInput('Reply-to email (optional)')),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _busy.isEmpty ? _saveEmail : null,
                          child: Text(_busy == 'email' ? 'Saving…' : 'Save email'),
                        ),
                        const Divider(height: 28),
                        Row(children: [
                          Expanded(
                            child: TextField(
                              controller: _testTo,
                              keyboardType: TextInputType.emailAddress,
                              autocorrect: false,
                              decoration: bizInput('Send a test email to'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: _busy.isEmpty
                                ? () {
                                    final to = _testTo.text.trim();
                                    if (!_emailRe.hasMatch(to)) return bizToast(context, 'Enter a valid email address', ok: false);
                                    _run('test', () => _svc.testEmail(to), reload: false);
                                  }
                                : null,
                            child: Text(_busy == 'test' ? 'Sending…' : 'Send'),
                          ),
                        ]),
                      ]),
                    ]),
                  ),
                ),
    );
  }
}
