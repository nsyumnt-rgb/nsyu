import 'package:flutter_contacts/flutter_contacts.dart';

/// A contact the user picked, with its name and every phone number on the
/// device record (un-normalized, exactly as stored on the phone) — used by
/// the "Select from Contacts" option on the Add Customer screen.
class ContactPickResult {
  final String name;
  final List<String> phones;
  ContactPickResult(this.name, this.phones);
}

enum ContactImportError { permissionDenied, noPhoneNumber }

class ContactImportException implements Exception {
  final ContactImportError type;
  final String message;
  ContactImportException(this.type, this.message);
  @override
  String toString() => message;
}

/// Wraps `flutter_contacts` for the one thing the Add Customer screen
/// needs: let the user pick a contact from the device and hand back its
/// name + phone number(s). Does not touch any customer/billing/ledger
/// logic itself — callers decide what to do with the result.
class ContactImportService {
  /// Requests Contacts permission (if not already granted) and opens the
  /// device's native contact picker.
  ///
  /// Returns null if the user backs out of the picker without choosing
  /// anyone. Throws a [ContactImportException] if permission is denied or
  /// the chosen contact has no phone number saved.
  Future<ContactPickResult?> pickContact() async {
    final granted = await FlutterContacts.requestPermission(readonly: true);
    if (!granted) {
      throw ContactImportException(
        ContactImportError.permissionDenied,
        "Contacts permission was denied. Enable it in your phone's "
        'Settings to import a customer from your contacts.',
      );
    }

    final picked = await FlutterContacts.openExternalPick();
    if (picked == null) return null; // user cancelled the native picker

    // The picker sometimes returns a "thin" contact with fields missing —
    // fetch the full record by id to make sure phone numbers are populated.
    final full =
        await FlutterContacts.getContact(picked.id, withProperties: true) ??
            picked;

    final phones = full.phones
        .map((p) => p.number.trim())
        .where((n) => n.isNotEmpty)
        .toList();

    if (phones.isEmpty) {
      throw ContactImportException(
        ContactImportError.noPhoneNumber,
        'That contact has no phone number saved.',
      );
    }

    return ContactPickResult(
      full.displayName.trim().isEmpty ? 'Unnamed Contact' : full.displayName.trim(),
      phones,
    );
  }

  /// Strips spaces, dashes, brackets and other punctuation, keeping only
  /// digits (and a leading "+" for international numbers).
  ///
  /// Converts a +91 / 0091 / 91-prefixed 12-digit Indian mobile number, or
  /// an 11-digit number with a leading trunk "0", down to the standard
  /// 10-digit local form. Numbers with any other country code, or that
  /// don't look like a normal Indian mobile once the prefix is removed,
  /// are left as-is rather than guessed at.
  static String normalizePhone(String raw) {
    var cleaned = raw.replaceAll(RegExp(r'[^\d+]'), '');
    if (cleaned.isEmpty) return cleaned;

    // Keep only a single leading "+", in case of stray extra ones.
    final hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replaceAll('+', '');
    if (hasPlus) cleaned = '+$cleaned';

    if (cleaned.startsWith('+91') && cleaned.length == 13) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('0091') && cleaned.length == 14) {
      cleaned = cleaned.substring(4);
    } else if (cleaned.length == 12 &&
        RegExp(r'^91[6-9]\d{9}$').hasMatch(cleaned)) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.length == 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    return cleaned;
  }
}
