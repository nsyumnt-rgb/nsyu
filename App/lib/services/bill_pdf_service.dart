import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/bill_pdf_data.dart';

/// Builds and opens the NSYU-branded invoice PDF — logo header, invoice
/// details box, itemized table, terms & totals, and a thank-you footer —
/// matching the NSYU invoice design you shared.
class BillPdfService {
  static const _navy = PdfColor.fromInt(0xFF0F172A);
  static const _red = PdfColor.fromInt(0xFFDC2626);
  static const _greyBorder = PdfColor.fromInt(0xFFCBD5E1);

  /// Folder name (inside the app's documents storage) where every
  /// generated bill's PDF and rendered photo/image are saved.
  static const folderName = 'nsyu_Bill_Photo_Image_pdf';

  static final _money = NumberFormat('#,##0.00');
  static final _dateFmt = DateFormat('dd-MM-yyyy');

  /// Opens the print/preview dialog (lets the user preview, print, or save
  /// the PDF locally).
  static Future<void> previewAndPrint(BillPdfData data) async {
    final bytes = await generatePdfBytes(data);
    await Printing.layoutPdf(
      onLayout: (format) => bytes,
      name: '${data.billNumber}.pdf',
    );
  }

  /// Opens the native share sheet with the bill PDF attached — from there
  /// the user can pick WhatsApp (or any other app) to send it directly.
  static Future<void> shareBill(BillPdfData data) async {
    final bytes = await generatePdfBytes(data);
    await Printing.sharePdf(
      bytes: bytes,
      filename: '${data.billNumber}.pdf',
    );
  }

  /// Generates the PDF, rasterizes page 1 to a PNG, and saves BOTH files
  /// into `<app documents>/nsyu_Bill_Photo_Image_pdf/`. Returns the saved
  /// file paths so the caller can store them against the bill record.
  static Future<({String pdfPath, String imagePath})> saveBillFiles(
      BillPdfData data) async {
    final bytes = await generatePdfBytes(data);

    final docsDir = await getApplicationDocumentsDirectory();
    final folder = Directory('${docsDir.path}/$folderName');
    if (!await folder.exists()) {
      await folder.create(recursive: true);
    }

    final safeName = data.billNumber.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');

    final pdfFile = File('${folder.path}/$safeName.pdf');
    await pdfFile.writeAsBytes(bytes);

    // Rasterize the first (only) page of the PDF into a PNG "photo" copy.
    String imagePath = '';
    final pages = Printing.raster(bytes, dpi: 150);
    await for (final page in pages) {
      final img = await page.toPng();
      final imgFile = File('${folder.path}/$safeName.png');
      await imgFile.writeAsBytes(img);
      imagePath = imgFile.path;
      break; // only the first page
    }

    return (pdfPath: pdfFile.path, imagePath: imagePath);
  }

  static Future<Uint8List> generatePdfBytes(BillPdfData data) async {
    final logoBytes = await _loadLogoBytes();
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(18),
        build: (context) => _buildInvoice(data, logoBytes),
      ),
    );

    return doc.save();
  }

  static Future<Uint8List?> _loadLogoBytes() async {
    try {
      final data = await rootBundle.load('assets/nsyu_logo.png');
      return data.buffer.asUint8List();
    } catch (_) {
      return null; // falls back to text-only header if asset isn't bundled
    }
  }

  static pw.Widget _buildInvoice(BillPdfData data, Uint8List? logoBytes) {
    return pw.Container(
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _navy, width: 1.6),
      ),
      padding: const pw.EdgeInsets.all(16),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _header(data, logoBytes),
          pw.SizedBox(height: 14),
          _billBanner(),
          pw.SizedBox(height: 10),
          _itemsTable(data),
          pw.SizedBox(height: 14),
          _footerRow(data),
          pw.SizedBox(height: 18),
          _thankYouRow(),
        ],
      ),
    );
  }

  static pw.Widget _header(BillPdfData data, Uint8List? logoBytes) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Expanded(
          flex: 3,
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  if (logoBytes != null)
                    pw.Image(pw.MemoryImage(logoBytes), width: 54, height: 54),
                  if (logoBytes != null) pw.SizedBox(width: 10),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'NSYU',
                        style: pw.TextStyle(
                          fontSize: 26,
                          fontWeight: pw.FontWeight.bold,
                          color: _navy,
                        ),
                      ),
                      pw.Text(
                        'INNOVATE  |  INSPIRE  |  IMPACT',
                        style: const pw.TextStyle(
                          fontSize: 7.5,
                          color: _red,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 10),
              pw.Text('Email: nsyu.mnt@gmail.com', style: const pw.TextStyle(fontSize: 9)),
              pw.SizedBox(height: 2),
              pw.Text('Phone: 8800503662', style: const pw.TextStyle(fontSize: 9)),
            ],
          ),
        ),
        pw.SizedBox(width: 12),
        pw.Expanded(
          flex: 2,
          child: pw.Container(
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _navy, width: 1),
              borderRadius: pw.BorderRadius.circular(4),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(
                  width: double.infinity,
                  color: _navy,
                  padding: const pw.EdgeInsets.symmetric(vertical: 5),
                  child: pw.Center(
                    child: pw.Text(
                      'INVOICE',
                      style: pw.TextStyle(
                        color: PdfColors.white,
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 13,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.all(8),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      _invoiceRow('Invoice No.', data.billNumber),
                      _invoiceRow('Date', _dateFmt.format(data.date)),
                      _invoiceRow(
                        'Customer',
                        data.customerName.isEmpty
                            ? '________________'
                            : data.customerName,
                      ),
                      _invoiceRow(
                        'Mobile No.',
                        data.customerPhone.isNotEmpty
                            ? data.customerPhone
                            : '________________',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static pw.Widget _invoiceRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 4),
      child: pw.Row(
        children: [
          pw.SizedBox(
            width: 62,
            child: pw.Text(label, style: const pw.TextStyle(fontSize: 9)),
          ),
          pw.Text(':  ', style: const pw.TextStyle(fontSize: 9)),
          pw.Expanded(
            child: pw.Text(
              value,
              style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _billBanner() {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Expanded(child: pw.Divider(color: _navy, thickness: 1.4)),
        pw.Container(
          margin: const pw.EdgeInsets.symmetric(horizontal: 10),
          padding: const pw.EdgeInsets.symmetric(horizontal: 22, vertical: 6),
          decoration: pw.BoxDecoration(
            color: _navy,
            border: pw.Border.all(color: _red, width: 1.4),
            borderRadius: pw.BorderRadius.circular(3),
          ),
          child: pw.Text(
            'BILL',
            style: pw.TextStyle(
              color: PdfColors.white,
              fontWeight: pw.FontWeight.bold,
              fontSize: 15,
              letterSpacing: 2,
            ),
          ),
        ),
        pw.Expanded(child: pw.Divider(color: _navy, thickness: 1.4)),
      ],
    );
  }

  static pw.Widget _itemsTable(BillPdfData data) {
    return pw.Table(
      border: pw.TableBorder.all(color: _greyBorder, width: 0.7),
      columnWidths: const {
        0: pw.FlexColumnWidth(0.6),
        1: pw.FlexColumnWidth(3.2),
        2: pw.FlexColumnWidth(1.6),
        3: pw.FlexColumnWidth(1.6),
      },
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: _navy),
          children: [
            _headCell('S.No.'),
            _headCell('Item Description'),
            _headCell('Qty × Rate'),
            _headCell('Amount (₹)'),
          ],
        ),
        for (var i = 0; i < data.items.length; i++)
          pw.TableRow(
            children: [
              _cell('${i + 1}', center: true),
              _cell(data.items[i].desc),
              _cell(
                '${data.items[i].qty}  ×  ${data.items[i].price.toStringAsFixed(0)}',
                center: true,
              ),
              _cell(_money.format(data.items[i].amount), right: true),
            ],
          ),
      ],
    );
  }

  static pw.Widget _headCell(String text) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 7, horizontal: 6),
        child: pw.Text(
          text,
          style: pw.TextStyle(
            color: PdfColors.white,
            fontWeight: pw.FontWeight.bold,
            fontSize: 9.5,
          ),
        ),
      );

  static pw.Widget _cell(String text,
      {bool center = false, bool right = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 6),
      child: pw.Text(
        text,
        textAlign: center
            ? pw.TextAlign.center
            : right
                ? pw.TextAlign.right
                : pw.TextAlign.left,
        style: const pw.TextStyle(fontSize: 9.5),
      ),
    );
  }

  static pw.Widget _footerRow(BillPdfData data) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Expanded(flex: 3, child: _termsBox()),
        pw.SizedBox(width: 12),
        pw.Expanded(flex: 2, child: _totalsBox(data)),
      ],
    );
  }

  static pw.Widget _termsBox() {
    return pw.Container(
      decoration: pw.BoxDecoration(border: pw.Border.all(color: _navy, width: 1)),
      padding: const pw.EdgeInsets.all(8),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            'TERMS & CONDITIONS',
            style: pw.TextStyle(
                fontSize: 9, fontWeight: pw.FontWeight.bold, color: _navy),
          ),
          pw.SizedBox(height: 6),
          _termLine('1. Warranty as per product company rule.'),
          _termLine('2. Payment must be cleared within maximum 21 days.'),
          _termLine('3. 5% charges add per week after due date.'),
        ],
      ),
    );
  }

  static pw.Widget _termLine(String text) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 3),
        child: pw.Text(text, style: const pw.TextStyle(fontSize: 8)),
      );

  static pw.Widget _totalsBox(BillPdfData data) {
    return pw.Column(
      children: [
        _totalRow('Sub Total', 'Rs ${_money.format(data.subtotal)}'),
        if (data.discount > 0)
          _totalRow('Discount', '- Rs ${_money.format(data.discount)}'),
        if (data.tax > 0)
          _totalRow('Taxes', '+ Rs ${_money.format(data.tax)}'),
        _totalRow('Bill Total', 'Rs ${_money.format(data.finalBillTotal)}'),
        if (data.previousOutstanding > 0)
          _totalRow('Previous Outstanding', '+ Rs ${_money.format(data.previousOutstanding)}'),
        pw.Container(
          width: double.infinity,
          color: _navy,
          padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Total Payable',
                style: pw.TextStyle(
                  color: PdfColors.white,
                  fontWeight: pw.FontWeight.bold,
                  fontSize: 10,
                ),
              ),
              pw.Text(
                'Rs ${_money.format(data.totalAmountPayable)}',
                style: pw.TextStyle(
                  color: PdfColors.white,
                  fontWeight: pw.FontWeight.bold,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
        if (data.paidAmount > 0)
          _totalRow('Payment Received', 'Rs ${_money.format(data.paidAmount)}'),
        _totalRow('Balance Due', 'Rs ${_money.format(data.remainingOutstanding)}'),
      ],
    );
  }

  static pw.Widget _totalRow(String label, String value) => pw.Container(
        decoration: pw.BoxDecoration(border: pw.Border.all(color: _greyBorder)),
        padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 8),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(label, style: const pw.TextStyle(fontSize: 8.5)),
            pw.Text(value, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
          ],
        ),
      );

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
                fontSize: 16,
                fontStyle: pw.FontStyle.italic,
                fontWeight: pw.FontWeight.bold,
                color: _navy,
              ),
            ),
            pw.Text(
              'FOR YOUR BUSINESS',
              style: const pw.TextStyle(fontSize: 8, letterSpacing: 1.5),
            ),
          ],
        ),
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Container(width: 130, height: 1, color: _greyBorder),
            pw.SizedBox(height: 4),
            pw.Text('Authorised Signatory', style: const pw.TextStyle(fontSize: 9)),
          ],
        ),
      ],
    );
  }
}
