import 'dart:io';

import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/payment.dart';

class PaymentPdfService {
  final _money = NumberFormat('#,##0.00');
  final _dateFmt = DateFormat('dd MMM yyyy, hh:mm a');

  Future<File> generate(Payment payment, double outstandingAfter) async {
    final pdf = pw.Document();
    final logo = pw.MemoryImage(
      (await rootBundle.load('assets/logo.png')).buffer.asUint8List(),
    );

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a5,
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              _header(logo),
              pw.SizedBox(height: 24),
              pw.Text('PAYMENT RECEIPT',
                  style: pw.TextStyle(
                      fontSize: 16, fontWeight: pw.FontWeight.bold)),
              pw.Divider(height: 8),
              pw.SizedBox(height: 16),
              _customerDetails(payment),
              pw.SizedBox(height: 24),
              _paymentDetails(payment),
              pw.SizedBox(height: 24),
              _summary(payment, outstandingAfter),
              pw.Spacer(),
              _footer(),
            ],
          );
        },
      ),
    );

    final dir = await getApplicationDocumentsDirectory();
    final file =
        File('${dir.path}/PaymentReceipt_${payment.id.substring(0, 8)}.pdf');
    await file.writeAsBytes(await pdf.save());
    return file;
  }

  pw.Widget _header(pw.MemoryImage logo) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text('NSYU Mobile Accessories',
                style:
                    pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.Text('Your Company Address, City, State, Pin'),
            pw.Text('your.email@example.com | +91 12345 67890'),
          ],
        ),
        pw.SizedBox(
          height: 60,
          width: 60,
          child: pw.Image(logo),
        ),
      ],
    );
  }

  pw.Widget _customerDetails(Payment payment) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text('RECEIVED FROM:',
            style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 10)),
        pw.Text(payment.customerName,
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
        pw.SizedBox(height: 8),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('Receipt No: ${payment.id.substring(0, 8).toUpperCase()}'),
            pw.Text('Date: ${_dateFmt.format(payment.date)}'),
          ],
        ),
      ],
    );
  }

  pw.Widget _paymentDetails(Payment payment) {
    return pw.TableHelper.fromTextArray(
      border: pw.TableBorder.all(color: PdfColors.grey300),
      headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold),
      headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
      cellAlignment: pw.Alignment.centerLeft,
      cellPadding: const pw.EdgeInsets.all(8),
      columnWidths: {
        0: const pw.FlexColumnWidth(2),
        1: const pw.FlexColumnWidth(3),
      },
      data: [
        ['Field', 'Details'],
        ['Amount Received', '₹${_money.format(payment.amount)}'],
        ['Payment Method', payment.method.label],
        if (payment.transactionId != null && payment.transactionId!.isNotEmpty)
          ['Transaction ID', payment.transactionId!],
        if (payment.remarks != null && payment.remarks!.isNotEmpty)
          ['Remarks', payment.remarks!],
      ],
    );
  }

  pw.Widget _summary(Payment payment, double outstandingAfter) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.end,
      children: [
        pw.Text('Balance Due After Payment: ',
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
        pw.Text('₹${_money.format(outstandingAfter)}',
            style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold,
                fontSize: 14,
                color: PdfColors.red)),
      ],
    );
  }

  pw.Widget _footer() {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text('Thank You!',
            style: pw.TextStyle(
                fontStyle: pw.FontStyle.italic, color: PdfColors.grey700)),
        pw.Container(
          width: 150,
          child: pw.Column(
            children: [
              pw.Divider(color: PdfColors.black, thickness: 0.5),
              pw.Text('Authorised Signature'),
            ],
          ),
        ),
      ],
    );
  }
}
