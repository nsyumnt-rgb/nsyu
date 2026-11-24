import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/messaging_service.dart';
import '../../theme/app_theme.dart';

const _waGreen = Color(0xFF15803D);
const _mailBlue = Color(0xFF0369A1);

const Map<String, String> _automationLabels = {
  'customer_registration': 'Customer registration',
  'order_confirmed': 'Order confirmed',
  'order_dispatched': 'Order dispatched',
  'order_delivered': 'Order delivered',
  'invoice_generated': 'Invoice generated',
  'payment_received': 'Payment received',
  'pending_payment': 'Pending payment',
  'due_date_reminder': 'Due date reminder',
  'offers_promotions': 'New offers',
  'birthday_greeting': 'Birthday greeting',
  'festival_greeting': 'Festival greeting',
};

/// WhatsApp + Email messaging for the shop owner: compose, history, automations.
/// Channel credentials are entered on the website (Messages › Channels).
class MessagingScreen extends StatefulWidget {
  final int initialTab;
  const MessagingScreen({super.key, this.initialTab = 0});

  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final _svc = MessagingService();
  Map<String, dynamic>? _overview;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final o = await _svc.overview();
      if (mounted) setState(() => _overview = o);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      initialIndex: widget.initialTab.clamp(0, 2),
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          title: const Text('Messages', style: TextStyle(fontWeight: FontWeight.w800)),
          backgroundColor: Colors.white,
          foregroundColor: AppColors.navy900,
          elevation: 0,
          bottom: const TabBar(
            labelColor: AppColors.navy900,
            unselectedLabelColor: AppColors.textSecondary,
            indicatorColor: AppColors.emerald,
            labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            tabs: [Tab(text: 'Compose'), Tab(text: 'History'), Tab(text: 'Automations')],
          ),
        ),
        body: _error != null
            ? _ErrorView(message: _error!, onRetry: () {
                setState(() => _error = null);
                _load();
              })
            : _overview == null
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(children: [
                    _ComposeTab(readiness: Map<String, dynamic>.from(_overview!['readiness'] ?? {})),
                    const _HistoryTab(),
                    _AutomationsTab(settings: Map<String, dynamic>.from(_overview!['settings'] ?? {}), onSaved: _load),
                  ]),
      ),
    );
  }
}

/* ───────────────────────────── Compose ───────────────────────────── */

class _ComposeTab extends StatefulWidget {
  final Map<String, dynamic> readiness;
  const _ComposeTab({required this.readiness});

  @override
  State<_ComposeTab> createState() => _ComposeTabState();
}

class _ComposeTabState extends State<_ComposeTab> with AutomaticKeepAliveClientMixin {
  final _svc = MessagingService();
  final _search = TextEditingController();
  final _wa = TextEditingController();
  final _subject = TextEditingController();
  final _email = TextEditingController();
  Timer? _debounce;

  List<MessageRecipient> _results = [];
  final Map<int, MessageRecipient> _selected = {};
  List<Map<String, dynamic>> _templates = [];
  int? _templateId;
  String _channels = 'both';
  bool _promo = false;
  DateTime? _scheduleAt;
  bool _sending = false;
  Map<String, dynamic>? _preview;

  bool get _waReady => widget.readiness['whatsapp']?['ready'] == true;
  bool get _emailReady => widget.readiness['email']?['ready'] == true;
  bool get _wantWa => _channels != 'email';
  bool get _wantEmail => _channels != 'whatsapp';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    if (!_waReady && _emailReady) _channels = 'email';
    if (_waReady && !_emailReady) _channels = 'whatsapp';
    _searchNow('');
    _svc.templates().then((t) {
      if (mounted) setState(() => _templates = t.where((x) => x['is_active'] != false).toList());
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _debounce?.cancel();
    for (final c in [_search, _wa, _subject, _email]) {
      c.dispose();
    }
    super.dispose();
  }

  void _searchNow(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final r = await _svc.customers(q);
        if (mounted) setState(() => _results = r);
      } catch (_) {}
    });
  }

  void _refreshPreview() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      try {
        final p = await _svc.preview(
          customerId: _selected.keys.isEmpty ? null : _selected.keys.first,
          templateId: _templateId,
          whatsappBody: _wa.text,
          emailSubject: _subject.text,
          emailHtml: _email.text,
        );
        if (mounted) setState(() => _preview = p);
      } catch (_) {}
    });
  }

  void _pickTemplate(int? id) {
    final t = _templates.where((x) => x['id'] == id).cast<Map<String, dynamic>?>().firstOrNull;
    setState(() {
      _templateId = id;
      if (t != null) {
        _wa.text = t['whatsapp_body']?.toString() ?? '';
        _subject.text = t['email_subject']?.toString() ?? '';
        _email.text = t['email_html']?.toString() ?? '';
        _promo = t['message_type'] == 'promotional';
      }
    });
    _refreshPreview();
  }

  Future<void> _pickSchedule() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 365)), initialDate: now);
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 1))));
    if (t == null) return;
    setState(() => _scheduleAt = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _send() async {
    setState(() => _sending = true);
    try {
      final msg = await _svc.send(
        channels: _channels,
        customerIds: _selected.keys.toList(),
        templateId: _templateId,
        whatsappBody: _wantWa ? _wa.text.trim() : null,
        emailSubject: _wantEmail ? _subject.text.trim() : null,
        emailHtml: _wantEmail ? _email.text.trim() : null,
        messageType: _promo ? 'promotional' : 'transactional',
        scheduledAt: _scheduleAt,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppColors.emerald));
      setState(() {
        _selected.clear();
        _scheduleAt = null;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  List<String> get _problems {
    final p = <String>[];
    if (_selected.isEmpty) p.add('Choose at least one customer');
    if (_wantWa && _wa.text.trim().isEmpty && _templateId == null) p.add('Write the WhatsApp message');
    if (_wantEmail && _email.text.trim().isEmpty && _templateId == null) p.add('Write the email');
    if ((_wantWa && !_waReady) && (_wantEmail ? !_emailReady : true)) p.add('No chosen channel is connected');
    return p;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final waCount = _selected.values.where((r) => r.whatsapp != null && r.whatsapp!.isNotEmpty).length;
    final emCount = _selected.values.where((r) => r.email != null && r.email!.isNotEmpty).length;
    final problems = _problems;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        _ChannelStatus(readiness: widget.readiness),
        const SizedBox(height: 14),
        _Section(
          step: '1',
          title: 'Who should receive it?',
          child: Column(children: [
            TextField(
              controller: _search,
              onChanged: _searchNow,
              decoration: _input('Search name, phone or email', icon: Icons.search_rounded),
            ),
            const SizedBox(height: 8),
            ..._results.take(25).map((r) => _RecipientTile(
                  r: r,
                  selected: _selected.containsKey(r.id),
                  onTap: () {
                    setState(() => _selected.containsKey(r.id) ? _selected.remove(r.id) : _selected[r.id] = r);
                    _refreshPreview();
                  },
                )),
            if (_selected.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: [
                  _CountPill(label: 'Selected', value: _selected.length, color: AppColors.navy900),
                  const SizedBox(width: 8),
                  _CountPill(label: 'WhatsApp', value: waCount, color: _waGreen),
                  const SizedBox(width: 8),
                  _CountPill(label: 'Email', value: emCount, color: _mailBlue),
                ]),
              ),
          ]),
        ),
        _Section(
          step: '2',
          title: 'Channel',
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'whatsapp', label: Text('WhatsApp')),
              ButtonSegment(value: 'email', label: Text('Email')),
              ButtonSegment(value: 'both', label: Text('Both')),
            ],
            selected: {_channels},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() => _channels = s.first),
          ),
        ),
        _Section(
          step: '3',
          title: 'Message',
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            DropdownButtonFormField<int?>(
              value: _templateId,
              isExpanded: true,
              decoration: _input('Template'),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('No template — write below')),
                ..._templates.map((t) => DropdownMenuItem<int?>(value: (t['id'] as num).toInt(), child: Text(t['name']?.toString() ?? '', overflow: TextOverflow.ellipsis))),
              ],
              onChanged: _pickTemplate,
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              value: _promo,
              onChanged: (v) => setState(() => _promo = v),
              title: const Text('Promotional (offer)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: const Text('Only sent to customers who allow offers', style: TextStyle(fontSize: 11.5)),
            ),
            if (_wantWa) ...[
              TextField(controller: _wa, maxLines: 5, minLines: 3, onChanged: (_) => _refreshPreview(), decoration: _input('WhatsApp message')),
              const Padding(
                padding: EdgeInsets.only(top: 4, bottom: 10),
                child: Text('Free text reaches only customers who messaged you in the last 24 h. Use an approved template for everyone else.',
                    style: TextStyle(fontSize: 11, color: AppColors.warning)),
              ),
            ],
            if (_wantEmail) ...[
              TextField(controller: _subject, onChanged: (_) => _refreshPreview(), decoration: _input('Email subject')),
              const SizedBox(height: 8),
              TextField(controller: _email, maxLines: 6, minLines: 3, onChanged: (_) => _refreshPreview(), decoration: _input('Email body')),
            ],
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final v in ['customer_name', 'shop_name', 'due_amount', 'payment_link', 'invoice_link'])
                ActionChip(
                  label: Text('{{$v}}', style: const TextStyle(fontSize: 11, fontFamily: 'monospace')),
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    final c = _wantWa ? _wa : _email;
                    c.text = '${c.text}{{$v}}';
                    _refreshPreview();
                    setState(() {});
                  },
                ),
            ]),
          ]),
        ),
        if (_preview != null)
          _Section(
            step: '4',
            title: 'Preview',
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (_wantWa)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFD9FDD3), borderRadius: BorderRadius.circular(14)),
                  child: Text(_preview!['whatsapp']?['text']?.toString().isNotEmpty == true ? _preview!['whatsapp']['text'] : 'No WhatsApp text',
                      style: const TextStyle(fontSize: 13)),
                ),
              if (_wantWa && _wantEmail) const SizedBox(height: 10),
              if (_wantEmail)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14), color: Colors.white),
                  child: Text('Subject: ${_preview!['email']?['subject'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                ),
            ]),
          ),
        _Section(
          step: _preview != null ? '5' : '4',
          title: 'When',
          child: Row(children: [
            Expanded(
              child: Text(_scheduleAt == null ? 'Send now' : 'Scheduled: ${DateFormat('d MMM, h:mm a').format(_scheduleAt!)}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            if (_scheduleAt != null) TextButton(onPressed: () => setState(() => _scheduleAt = null), child: const Text('Send now')),
            TextButton.icon(onPressed: _pickSchedule, icon: const Icon(Icons.schedule_rounded, size: 18), label: const Text('Schedule')),
          ]),
        ),
        if (problems.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(problems.join(' · '), style: const TextStyle(fontSize: 12, color: AppColors.warning)),
          ),
        SizedBox(
          height: 50,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.emerald,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: problems.isEmpty && !_sending ? _send : null,
            icon: const Icon(Icons.send_rounded, size: 18),
            label: Text(_sending ? 'Sending…' : _scheduleAt != null ? 'Schedule' : 'Send to ${_selected.length} customer${_selected.length == 1 ? '' : 's'}'),
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text('Each customer gets their own message — no one sees anyone else’s number or email.',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ),
      ],
    );
  }
}

/* ───────────────────────────── History ───────────────────────────── */

class _HistoryTab extends StatefulWidget {
  const _HistoryTab();

  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> with AutomaticKeepAliveClientMixin {
  final _svc = MessagingService();
  String _channel = '';
  String _status = '';
  int _page = 1;
  HistoryPage? _data;
  String? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await _svc.history(channel: _channel, status: _status, page: _page);
      if (mounted) setState(() {
        _data = d;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    // Group the WhatsApp + Email copies of one message
    final groups = <String, List<HistoryItem>>{};
    for (final d in _data?.items ?? <HistoryItem>[]) {
      groups.putIfAbsent(d.groupKey, () => []).add(d);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Row(children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _channel,
                decoration: _input('Channel'),
                items: const [
                  DropdownMenuItem(value: '', child: Text('All')),
                  DropdownMenuItem(value: 'whatsapp', child: Text('WhatsApp')),
                  DropdownMenuItem(value: 'email', child: Text('Email')),
                ],
                onChanged: (v) {
                  setState(() {
                    _channel = v ?? '';
                    _page = 1;
                  });
                  _load();
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _status,
                decoration: _input('Status'),
                items: [
                  const DropdownMenuItem(value: '', child: Text('Any')),
                  for (final s in ['sent', 'delivered', 'read', 'failed', 'skipped', 'queued'])
                    DropdownMenuItem(value: s, child: Text(s[0].toUpperCase() + s.substring(1))),
                ],
                onChanged: (v) {
                  setState(() {
                    _status = v ?? '';
                    _page = 1;
                  });
                  _load();
                },
              ),
            ),
          ]),
          const SizedBox(height: 12),
          if (_error != null) _ErrorView(message: _error!, onRetry: _load),
          if (_data == null && _error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
          if (_data != null && groups.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Text('No messages yet. Messages you send and automatic notifications appear here.',
                  textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
            ),
          for (final e in groups.entries) _HistoryCard(items: e.value, onRetry: (id) async {
            try {
              await _svc.retry(id);
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Retrying…')));
              Future.delayed(const Duration(seconds: 3), _load);
            } catch (err) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err.toString())));
            }
          }),
          if ((_data?.pages ?? 1) > 1)
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              IconButton(onPressed: _page > 1 ? () { setState(() => _page--); _load(); } : null, icon: const Icon(Icons.chevron_left_rounded)),
              Text('Page $_page of ${_data!.pages}'),
              IconButton(onPressed: _page < _data!.pages ? () { setState(() => _page++); _load(); } : null, icon: const Icon(Icons.chevron_right_rounded)),
            ]),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final List<HistoryItem> items;
  final void Function(String id) onRetry;
  const _HistoryCard({required this.items, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final first = items.first;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
      child: ExpansionTile(
        shape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        title: Text(first.customerName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), overflow: TextOverflow.ellipsis),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(first.subject ?? first.body ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 4, children: [
            for (final d in items) _StatusPill(status: d.status, channel: d.channel),
            if (first.createdAt != null)
              Text(DateFormat('d MMM, h:mm a').format(first.createdAt!), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          ]),
        ]),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        children: [
          for (final d in items)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  _StatusPill(status: d.status, channel: d.channel),
                  const SizedBox(width: 8),
                  Expanded(child: Text(d.recipient, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary))),
                ]),
                if (d.body != null && d.body!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(d.body!, style: const TextStyle(fontSize: 12.5))),
                if (d.failureReason != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(d.failureReason!, style: const TextStyle(fontSize: 12, color: AppColors.danger)),
                  ),
                if (d.status == 'failed' && d.source == 'messaging')
                  TextButton.icon(onPressed: () => onRetry(d.id), icon: const Icon(Icons.refresh_rounded, size: 16), label: const Text('Retry')),
              ]),
            ),
        ],
      ),
    );
  }
}

/* ───────────────────────────── Automations ───────────────────────────── */

class _AutomationsTab extends StatefulWidget {
  final Map<String, dynamic> settings;
  final VoidCallback onSaved;
  const _AutomationsTab({required this.settings, required this.onSaved});

  @override
  State<_AutomationsTab> createState() => _AutomationsTabState();
}

class _AutomationsTabState extends State<_AutomationsTab> with AutomaticKeepAliveClientMixin {
  late Map<String, Map<String, dynamic>> _rules;
  bool _dirty = false;
  bool _saving = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    final raw = Map<String, dynamic>.from(widget.settings['automations'] ?? {});
    _rules = {for (final e in raw.entries) e.key: Map<String, dynamic>.from(e.value as Map)};
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final msg = await MessagingService().saveAutomations(_rules);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppColors.emerald));
      setState(() => _dirty = false);
      widget.onSaved();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(children: [
      Expanded(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          children: [
            const Text('Turn WhatsApp and email on or off separately for each event. Templates and festival dates are set on the website.',
                style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            for (final e in _automationLabels.entries)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: AppColors.border)),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                  child: Row(children: [
                    Expanded(child: Text(e.value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
                    _MiniSwitch(
                      label: 'WA',
                      color: _waGreen,
                      value: _rules[e.key]?['whatsapp'] == true,
                      onChanged: (v) => setState(() {
                        (_rules[e.key] ??= {})['whatsapp'] = v;
                        _dirty = true;
                      }),
                    ),
                    _MiniSwitch(
                      label: 'Email',
                      color: _mailBlue,
                      value: _rules[e.key]?['email'] == true,
                      onChanged: (v) => setState(() {
                        (_rules[e.key] ??= {})['email'] = v;
                        _dirty = true;
                      }),
                    ),
                  ]),
                ),
              ),
          ],
        ),
      ),
      SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.emerald,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _dirty && !_saving ? _save : null,
              child: Text(_saving ? 'Saving…' : _dirty ? 'Save changes' : 'Saved'),
            ),
          ),
        ),
      ),
    ]);
  }
}

/* ───────────────────────────── Small widgets ───────────────────────────── */

InputDecoration _input(String label, {IconData? icon}) => InputDecoration(
      labelText: label,
      isDense: true,
      prefixIcon: icon != null ? Icon(icon, size: 20) : null,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
    );

class _Section extends StatelessWidget {
  final String step;
  final String title;
  final Widget child;
  const _Section({required this.step, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          CircleAvatar(radius: 12, backgroundColor: AppColors.blue50, child: Text(step, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.emerald))),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: AppColors.navy900)),
        ]),
        const SizedBox(height: 12),
        child,
      ]),
    );
  }
}

class _ChannelStatus extends StatelessWidget {
  final Map<String, dynamic> readiness;
  const _ChannelStatus({required this.readiness});

  @override
  Widget build(BuildContext context) {
    Widget pill(String label, Map? r, Color color) {
      final ready = r?['ready'] == true;
      return Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: ready ? color.withValues(alpha: 0.08) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$label ${ready ? 'ready' : 'not ready'}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: ready ? color : AppColors.textSecondary)),
            if (!ready && r?['reason'] != null)
              Text(r!['reason'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary)),
          ]),
        ),
      );
    }

    return Row(children: [
      pill('WhatsApp', readiness['whatsapp'] as Map?, _waGreen),
      const SizedBox(width: 10),
      pill('Email', readiness['email'] as Map?, _mailBlue),
    ]);
  }
}

class _RecipientTile extends StatelessWidget {
  final MessageRecipient r;
  final bool selected;
  final VoidCallback onTap;
  const _RecipientTile({required this.r, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.blue50 : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.emerald.withValues(alpha: 0.4) : Colors.transparent),
        ),
        child: Row(children: [
          Icon(selected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded, color: selected ? AppColors.emerald : AppColors.textSecondary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5), overflow: TextOverflow.ellipsis),
              Text(
                [r.whatsapp != null ? '+${r.whatsapp}' : 'no WhatsApp', r.email ?? 'no email'].join('  ·  '),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
              ),
            ]),
          ),
          if (r.dueAmount > 0)
            Text('₹${NumberFormat('#,##,##0', 'en_IN').format(r.dueAmount)} due', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppColors.danger)),
        ]),
      ),
    );
  }
}

class _CountPill extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _CountPill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(12)),
        child: Column(children: [
          Text('$value', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: color)),
          Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary)),
        ]),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  final String channel;
  const _StatusPill({required this.status, required this.channel});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'delivered' || 'read' => AppColors.success,
      'sent' => _mailBlue,
      'failed' => AppColors.danger,
      'skipped' => AppColors.warning,
      _ => AppColors.textSecondary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(channel == 'whatsapp' ? Icons.chat_rounded : Icons.mail_rounded, size: 12, color: color),
        const SizedBox(width: 4),
        Text(status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
      ]),
    );
  }
}

class _MiniSwitch extends StatelessWidget {
  final String label;
  final Color color;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _MiniSwitch({required this.label, required this.color, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Switch.adaptive(value: value, onChanged: onChanged, activeTrackColor: color),
      Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary)),
    ]);
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger)),
        const SizedBox(height: 8),
        TextButton(onPressed: onRetry, child: const Text('Try again')),
      ]),
    );
  }
}
