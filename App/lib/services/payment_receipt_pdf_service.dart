import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/saved_payment.dart';

/// Builds the NSYU-branded "Payment Collect Receipt" PDF — navy header with
/// receipt number, thank-you ribbon, company name, icon-labelled payment
/// detail rows, an outstanding balance highlight box, a signed thank-you
/// footer with an authorized stamp, and a contact bar. Matches the receipt
/// design you shared.
///
/// NOTE: only the visual layout in this file was changed. `SavedPayment`,
/// its fields, and every call site (`previewAndPrint` / `shareReceipt` /
/// `generatePdfBytes` signatures) are untouched, so nothing else in the app
/// needs to change.
class PaymentReceiptPdfService {
  static const _navy = PdfColor.fromInt(0xFF0F172A);
  static const _green = PdfColor.fromInt(0xFF16A34A);
  static const _red = PdfColor.fromInt(0xFFDC2626);
  static const _greyBorder = PdfColor.fromInt(0xFFCBD5E1);
  static const _white = PdfColors.white;

  static final _money = NumberFormat('#,##0.00');
  static final _dateFmt = DateFormat('dd MMMM yyyy');

  static Future<void> previewAndPrint(SavedPayment payment) async {
    final bytes = await generatePdfBytes(payment);
    await Printing.layoutPdf(
      onLayout: (format) => bytes,
      name: '${_safeName(payment.receiptNumber)}.pdf',
    );
  }

  static Future<void> shareReceipt(SavedPayment payment) async {
    final bytes = await generatePdfBytes(payment);
    await Printing.sharePdf(
      bytes: bytes,
      filename: '${_safeName(payment.receiptNumber)}.pdf',
    );
  }

  static String _safeName(String receiptNumber) =>
      receiptNumber.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');

  static Future<Uint8List> generatePdfBytes(SavedPayment payment) async {
    final logoBytes = await _loadLogoBytes();
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(24),
        build: (context) => _buildReceipt(payment, logoBytes),
      ),
    );

    return doc.save();
  }

  static Future<Uint8List?> _loadLogoBytes() async {
    try {
      final data = await rootBundle.load('assets/nsyu_logo.png');
      return data.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  static pw.Widget _buildReceipt(SavedPayment payment, Uint8List? logoBytes) {
    return pw.Container(
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _navy, width: 1.6),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _header(payment, logoBytes),
          _thankYouRibbon(),
          pw.Padding(
            padding: const pw.EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _companyNameBlock(),
                pw.SizedBox(height: 12),
                _detailRow(
                  'Received From',
                  payment.customerName.isEmpty ? 'Walk-in customer' : payment.customerName,
                  icon: _personIcon(),
                ),
                _detailRow(
                  'Customer ID',
                  payment.customerId.isEmpty ? '-' : payment.customerId,
                  icon: _idIcon(),
                ),
                _detailRow('Date', _dateFmt.format(payment.date), icon: _calendarIcon()),
                _detailRow(
                  'Amount (Rs.)',
                  'Rs ${_money.format(payment.amount)}',
                  valueColor: _green,
                  bold: true,
                  big: true,
                  icon: _cashIcon(),
                ),
                _detailRow('Payment Method', payment.method.label, icon: _cardIcon()),
                if (payment.transactionId.isNotEmpty)
                  _detailRow('Transaction ID', payment.transactionId, icon: _hashIcon()),
                _detailRow(
                  'Remarks',
                  payment.remarks.isEmpty
                      ? 'Payment against invoice ${payment.billNumber}'
                      : payment.remarks,
                  icon: _notesIcon(),
                ),
                pw.SizedBox(height: 10),
                _outstandingBox(payment),
                pw.SizedBox(height: 22),
                _thankYouRow(),
              ],
            ),
          ),
          _footerBar(),
        ],
      ),
    );
  }

  static pw.Widget _header(SavedPayment payment, Uint8List? logoBytes) {
    return pw.Container(
      padding: const pw.EdgeInsets.fromLTRB(20, 18, 20, 14),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          if (logoBytes != null) ...[
            pw.Image(pw.MemoryImage(logoBytes), width: 46, height: 46),
            pw.SizedBox(width: 12),
          ],
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'PAYMENT COLLECT RECEIPT',
                  style: pw.TextStyle(
                    fontSize: 17,
                    fontWeight: pw.FontWeight.bold,
                    color: _navy,
                  ),
                ),
                pw.SizedBox(height: 6),
                pw.Container(
                  padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: _red, width: 0.8),
                    borderRadius: pw.BorderRadius.circular(3),
                  ),
                  child: pw.Text(
                    'RECEIPT NUMBER   ${payment.receiptNumber}',
                    style: pw.TextStyle(
                        fontSize: 8.5, color: _red, fontWeight: pw.FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _thankYouRibbon() {
    return pw.Container(
      width: double.infinity,
      color: _navy,
      padding: const pw.EdgeInsets.symmetric(vertical: 8),
      child: pw.Center(
        child: pw.Text(
          'Thank you for your payment!',
          style: pw.TextStyle(
            color: PdfColors.white,
            fontStyle: pw.FontStyle.italic,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  /// "Company Name" caption + bold "NSYU" business name, shown above the
  /// payment detail rows — matches the receipt design you shared.
  static pw.Widget _companyNameBlock() {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'Company Name',
          style: pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
        ),
        pw.SizedBox(height: 2),
        pw.Text(
          'NSYU',
          style: pw.TextStyle(
            fontSize: 24,
            fontWeight: pw.FontWeight.bold,
            color: _navy,
          ),
        ),
        pw.SizedBox(height: 10),
        pw.Divider(color: _greyBorder),
      ],
    );
  }

  static pw.Widget _detailRow(
    String label,
    String value, {
    required pw.Widget icon,
    PdfColor? valueColor,
    bool bold = false,
    bool big = false,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 6),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          icon,
          pw.SizedBox(width: 10),
          pw.SizedBox(
            width: 120,
            child: pw.Text(label, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
          ),
          pw.Expanded(
            child: pw.Text(
              value,
              style: pw.TextStyle(
                fontSize: big ? 15 : 10.5,
                fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: valueColor ?? _navy,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _outstandingBox(SavedPayment payment) {
    final settled = payment.outstandingBalanceAfter <= 0;
    return pw.Container(
      width: double.infinity,
      decoration: pw.BoxDecoration(
        color: const PdfColor.fromInt(0xFFF1F5F9),
        border: pw.Border.all(color: _navy, width: 1),
        borderRadius: pw.BorderRadius.circular(4),
      ),
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Row(
            children: [
              _scaleIcon(),
              pw.SizedBox(width: 10),
              pw.Text('Outstanding Balance',
                  style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, color: _navy)),
            ],
          ),
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text(
                'Rs ${_money.format(payment.outstandingBalanceAfter)}',
                style: pw.TextStyle(
                  fontSize: 14,
                  fontWeight: pw.FontWeight.bold,
                  color: settled ? _green : _red,
                ),
              ),
              if (settled)
                pw.Text('(Fully Paid)',
                    style: pw.TextStyle(fontSize: 8, color: _green)),
            ],
          ),
        ],
      ),
    );
  }

  static pw.Widget _thankYouRow() {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      crossAxisAlignment: pw.CrossAxisAlignment.end,
      children: [
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              'Thank You!',
              style: pw.TextStyle(
                fontSize: 15,
                fontStyle: pw.FontStyle.italic,
                fontWeight: pw.FontWeight.bold,
                color: _navy,
              ),
            ),
            pw.Text('We appreciate your business.', style: const pw.TextStyle(fontSize: 8)),
          ],
        ),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Container(width: 110, height: 1, color: _greyBorder),
                pw.SizedBox(height: 4),
                pw.Text('Authorized Signature', style: const pw.TextStyle(fontSize: 8)),
              ],
            ),
            pw.SizedBox(width: 12),
            _authorizedStamp(),
          ],
        ),
      ],
    );
  }

  /// Round "authorized" stamp/seal shown next to the signature line —
  /// matches the circular seal in the receipt design you shared.
  static pw.Widget _authorizedStamp() {
    return pw.Container(
      width: 46,
      height: 46,
      alignment: pw.Alignment.center,
      decoration: pw.BoxDecoration(
        shape: pw.BoxShape.circle,
        border: pw.Border.all(color: _navy, width: 1.1),
      ),
      child: pw.Container(
        width: 38,
        height: 38,
        alignment: pw.Alignment.center,
        decoration: pw.BoxDecoration(
          shape: pw.BoxShape.circle,
          border: pw.Border.all(color: _navy, width: 0.6),
        ),
        child: pw.Column(
          mainAxisAlignment: pw.MainAxisAlignment.center,
          children: [
            pw.Text('NSYU',
                style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: _navy)),
            pw.SizedBox(height: 1),
            pw.Text('AUTHORIZED',
                style: pw.TextStyle(fontSize: 4, color: _navy)),
          ],
        ),
      ),
    );
  }

  static pw.Widget _footerBar() {
    return pw.Container(
      width: double.infinity,
      color: _navy,
      padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 20),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          _footerItem('+91 12345 67890'),
          _footerItem('info@nsyu.in'),
          _footerItem('www.nsyu.in'),
        ],
      ),
    );
  }

  static pw.Widget _footerItem(String text) {
    return pw.Row(
      children: [
        pw.Container(
          width: 5,
          height: 5,
          decoration: const pw.BoxDecoration(shape: pw.BoxShape.circle, color: PdfColors.white),
        ),
        pw.SizedBox(width: 5),
        pw.Text(text, style: const pw.TextStyle(fontSize: 8, color: PdfColors.white)),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Small icon badges shown before each detail row — plain shape-based
  // glyphs (circles/bars only) so they render reliably without depending
  // on any icon font being bundled with the app.
  // ---------------------------------------------------------------------

  static pw.Widget _iconBadge(pw.Widget glyph, {double size = 22}) {
    return pw.Container(
      width: size,
      height: size,
      alignment: pw.Alignment.center,
      decoration: const pw.BoxDecoration(shape: pw.BoxShape.circle, color: _navy),
      child: glyph,
    );
  }

  static pw.Widget _glyphBox({required List<pw.Widget> children}) {
    return pw.SizedBox(
      width: 13,
      height: 13,
      child: pw.Stack(children: children),
    );
  }

  static pw.Widget _dot(double w, double h, {double? top, double? bottom, double? left, double? right}) {
    return pw.Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: pw.Container(
        width: w,
        height: h,
        decoration: const pw.BoxDecoration(shape: pw.BoxShape.circle, color: _white),
      ),
    );
  }

  static pw.Widget _bar(double w, double h, {double? top, double? bottom, double? left, double? right, pw.BorderRadius? radius}) {
    return pw.Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: pw.Container(
        width: w,
        height: h,
        decoration: pw.BoxDecoration(color: _white, borderRadius: radius),
      ),
    );
  }

  static pw.Widget _personIcon() {
    return _iconBadge(_glyphBox(children: [
      _dot(6, 6, top: 0, left: 3.5),
      _bar(13, 6, bottom: 0, left: 0, radius: pw.BorderRadius.only(topLeft: pw.Radius.circular(6), topRight: pw.Radius.circular(6))),
    ]));
  }

  static pw.Widget _idIcon() {
    return _iconBadge(_glyphBox(children: [
      _bar(13, 10, top: 1.5, radius: pw.BorderRadius.circular(2)),
      pw.Positioned(
        top: 4,
        left: 2,
        child: pw.Container(width: 3.5, height: 3.5, decoration: const pw.BoxDecoration(shape: pw.BoxShape.circle, color: _navy)),
      ),
      pw.Positioned(top: 4, right: 2, child: pw.Container(width: 5, height: 1, color: _navy)),
      pw.Positioned(top: 7, right: 2, child: pw.Container(width: 5, height: 1, color: _navy)),
    ]));
  }

  static pw.Widget _calendarIcon() {
    return _iconBadge(_glyphBox(children: [
      _bar(13, 11, top: 2, radius: pw.BorderRadius.circular(2)),
      pw.Positioned(top: 2, left: 0, child: pw.Container(width: 13, height: 3, color: _navy)),
      pw.Positioned(top: 0, left: 3, child: pw.Container(width: 1.4, height: 3, color: _navy)),
      pw.Positioned(top: 0, right: 3, child: pw.Container(width: 1.4, height: 3, color: _navy)),
    ]));
  }

  static pw.Widget _cashIcon() {
    return _iconBadge(_glyphBox(children: [
      _dot(11, 11, top: 1, left: 1),
      pw.Positioned(top: 5.5, left: 3, child: pw.Container(width: 7, height: 1.4, color: _navy)),
    ]));
  }

  static pw.Widget _cardIcon() {
    return _iconBadge(_glyphBox(children: [
      _bar(13, 10, top: 1.5, radius: pw.BorderRadius.circular(2)),
      pw.Positioned(top: 4, left: 0, child: pw.Container(width: 13, height: 2.2, color: _navy)),
    ]));
  }

  static pw.Widget _hashIcon() {
    return _iconBadge(pw.Text('#', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: _white)));
  }

  static pw.Widget _notesIcon() {
    return _iconBadge(_glyphBox(children: [
      _bar(11, 13, left: 1, radius: pw.BorderRadius.circular(1.5)),
      pw.Positioned(top: 3.5, left: 2.5, child: pw.Container(width: 8, height: 1, color: _navy)),
      pw.Positioned(top: 6.5, left: 2.5, child: pw.Container(width: 8, height: 1, color: _navy)),
      pw.Positioned(top: 9.5, left: 2.5, child: pw.Container(width: 5, height: 1, color: _navy)),
    ]));
  }

  static pw.Widget _scaleIcon() {
    return _iconBadge(_glyphBox(children: [
      pw.Positioned(top: 1, left: 6, child: pw.Container(width: 1.2, height: 10, color: _white)),
      pw.Positioned(top: 2, left: 1, child: pw.Container(width: 11, height: 1.2, color: _white)),
      _dot(3, 3, top: 3, left: 0),
      _dot(3, 3, top: 3, right: 0),
      pw.Positioned(bottom: 0, left: 3, child: pw.Container(width: 7, height: 1.4, color: _white)),
    ]), size: 22);
  }
}
