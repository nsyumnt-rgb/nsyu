import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/supabase_config.dart';
import 'customer_portal_service.dart';
import 'supabase_service.dart';

/// WhatsApp + Email messaging — same API the website uses (/api/messaging).
class MessagingService {
  static final MessagingService _instance = MessagingService._internal();
  factory MessagingService() => _instance;
  MessagingService._internal();

  final _api = SupabaseService();
  Uri _u(String path, [Map<String, String>? q]) =>
      Uri.parse('${SupabaseConfig.apiUrl}/messaging$path').replace(queryParameters: q);

  dynamic _data(http.Response res) {
    Map<String, dynamic> body = {};
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {}
    if (res.statusCode >= 400 || body['success'] == false) {
      throw MessagingException(body['message']?.toString() ?? 'Request failed (HTTP ${res.statusCode})');
    }
    return body;
  }

  Future<Map<String, dynamic>> overview() async =>
      Map<String, dynamic>.from(_data(await _api.authedGet(_u('/overview')))['data']);

  Future<Map<String, dynamic>> settings() async =>
      Map<String, dynamic>.from(_data(await _api.authedGet(_u('/settings')))['data']);

  Future<List<Map<String, dynamic>>> templates() async =>
      List<Map<String, dynamic>>.from(_data(await _api.authedGet(_u('/templates')))['data'] ?? []);

  Future<List<MessageRecipient>> customers(String search) async {
    final list = _data(await _api.authedGet(_u('/customers', {'search': search, 'limit': '40'})))['data'] as List? ?? [];
    return list.map((e) => MessageRecipient.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<Map<String, dynamic>> preview({
    int? customerId,
    int? templateId,
    String whatsappBody = '',
    String emailSubject = '',
    String emailHtml = '',
  }) async {
    final res = await _api.authedPost(_u('/preview'), {
      if (customerId != null) 'customerId': customerId,
      if (templateId != null) 'templateId': templateId,
      'whatsappBody': whatsappBody,
      'emailSubject': emailSubject,
      'emailHtml': emailHtml,
    });
    return Map<String, dynamic>.from(_data(res)['data']);
  }

  /// Sends now, or schedules when [scheduledAt] is set. Returns the server message.
  Future<String> send({
    required String channels, // whatsapp | email | both
    required List<int> customerIds,
    int? templateId,
    String? whatsappBody,
    String? emailSubject,
    String? emailHtml,
    String messageType = 'transactional',
    DateTime? scheduledAt,
  }) async {
    final res = await _api.authedPost(_u('/send'), {
      'channels': channels,
      'audience': {'mode': 'selected', 'customerIds': customerIds},
      'messageType': messageType,
      if (templateId != null) 'templateId': templateId,
      if (whatsappBody != null && whatsappBody.isNotEmpty) 'whatsappBody': whatsappBody,
      if (emailSubject != null && emailSubject.isNotEmpty) 'emailSubject': emailSubject,
      if (emailHtml != null && emailHtml.isNotEmpty) 'emailHtml': emailHtml,
      if (scheduledAt != null) 'scheduledAt': scheduledAt.toUtc().toIso8601String(),
    });
    return _data(res)['message']?.toString() ?? 'Sent';
  }

  Future<HistoryPage> history({String channel = '', String status = '', String search = '', int page = 1}) async {
    final res = await _api.authedGet(_u('/history', {
      if (channel.isNotEmpty) 'channel': channel,
      if (status.isNotEmpty) 'status': status,
      if (search.isNotEmpty) 'search': search,
      'page': '$page',
      'limit': '30',
    }));
    final body = _data(res);
    final items = (body['data'] as List? ?? []).map((e) => HistoryItem.fromJson(Map<String, dynamic>.from(e))).toList();
    final p = Map<String, dynamic>.from(body['pagination'] ?? {});
    return HistoryPage(items, (p['pages'] ?? 1) as int, (p['total'] ?? items.length) as int);
  }

  Future<void> retry(String deliveryId) async => _data(await _api.authedPost(_u('/deliveries/$deliveryId/retry'), {}));

  Future<String> saveAutomations(Map<String, dynamic> automations) async =>
      _data(await _api.authedPut(_u('/automations'), {'automations': automations}))['message']?.toString() ?? 'Saved';

  /// Shop sender setup (owner): WhatsApp Cloud API number and the shop's own mailbox.
  Future<String> saveWhatsApp(Map<String, dynamic> body) async =>
      _data(await _api.authedPut(_u('/settings/whatsapp'), body))['message']?.toString() ?? 'Saved';

  Future<String> verifyWhatsApp() async =>
      _data(await _api.authedPost(_u('/settings/whatsapp/verify'), {}))['message']?.toString() ?? 'Connected';

  Future<String> testWhatsApp(String to) async =>
      _data(await _api.authedPost(_u('/settings/whatsapp/test'), {'to': to}))['message']?.toString() ?? 'Sent';

  /// Ready-made templates and whether this shop already has each one.
  Future<List<Map<String, dynamic>>> templateLibrary() async =>
      List<Map<String, dynamic>>.from(_data(await _api.authedGet(_u('/templates/library')))['data'] ?? []);

  Future<String> addTemplateLibrary({List<String>? keys}) async =>
      _data(await _api.authedPost(_u('/templates/library'), {if (keys != null) 'keys': keys}))['message']?.toString() ?? 'Added';

  Future<String> submitWhatsAppTemplates() async =>
      _data(await _api.authedPost(_u('/templates/whatsapp-submit'), {}))['message']?.toString() ?? 'Sent';

  Future<String> saveEmail(Map<String, dynamic> body) async =>
      _data(await _api.authedPut(_u('/settings/email'), body))['message']?.toString() ?? 'Saved';

  Future<String> testEmail(String to) async =>
      _data(await _api.authedPost(_u('/settings/email/test'), {'to': to}))['message']?.toString() ?? 'Sent';

  /// Customer portal: the signed-in customer's own channel choices.
  Future<Map<String, dynamic>> myPreferences() async {
    final portal = CustomerPortalService();
    await portal.ensureInitialized();
    final res = await portal.authenticatedGet(Uri.parse('${SupabaseConfig.apiUrl}/customer-portal/me/message-preferences'));
    return Map<String, dynamic>.from(_data(res)['data']);
  }

  Future<Map<String, dynamic>> saveMyPreferences(Map<String, dynamic> prefs) async {
    final portal = CustomerPortalService();
    await portal.ensureInitialized();
    final res = await portal.authenticatedPut(
      Uri.parse('${SupabaseConfig.apiUrl}/customer-portal/me/message-preferences'),
      body: jsonEncode(prefs),
    );
    return Map<String, dynamic>.from(_data(res)['data']);
  }
}

class MessagingException implements Exception {
  final String message;
  MessagingException(this.message);
  @override
  String toString() => message;
}

class MessageRecipient {
  final int id;
  final String name;
  final String? whatsapp;
  final String? email;
  final double dueAmount;
  MessageRecipient({required this.id, required this.name, this.whatsapp, this.email, this.dueAmount = 0});
  factory MessageRecipient.fromJson(Map<String, dynamic> j) => MessageRecipient(
        id: (j['id'] as num).toInt(),
        name: j['name']?.toString() ?? 'Customer',
        whatsapp: j['whatsapp']?.toString(),
        email: j['email']?.toString(),
        dueAmount: double.tryParse('${j['dueAmount'] ?? 0}') ?? 0,
      );
}

class HistoryItem {
  final String id;
  final String source;
  final String groupKey;
  final String channel;
  final String status;
  final String customerName;
  final String recipient;
  final String? subject;
  final String? body;
  final String? eventType;
  final String? failureReason;
  final DateTime? createdAt;
  HistoryItem({
    required this.id,
    required this.source,
    required this.groupKey,
    required this.channel,
    required this.status,
    required this.customerName,
    required this.recipient,
    this.subject,
    this.body,
    this.eventType,
    this.failureReason,
    this.createdAt,
  });
  factory HistoryItem.fromJson(Map<String, dynamic> j) => HistoryItem(
        id: '${j['id']}',
        source: j['source']?.toString() ?? 'messaging',
        groupKey: j['groupKey']?.toString() ?? '${j['id']}',
        channel: j['channel']?.toString() ?? 'email',
        status: j['status']?.toString() ?? 'queued',
        customerName: j['customerName']?.toString() ?? j['recipient']?.toString() ?? 'Customer',
        recipient: j['recipient']?.toString() ?? '',
        subject: j['subject']?.toString(),
        body: j['body']?.toString(),
        eventType: j['eventType']?.toString(),
        failureReason: j['failureReason']?.toString(),
        createdAt: DateTime.tryParse('${j['createdAt']}')?.toLocal(),
      );
}

class HistoryPage {
  final List<HistoryItem> items;
  final int pages;
  final int total;
  HistoryPage(this.items, this.pages, this.total);
}
