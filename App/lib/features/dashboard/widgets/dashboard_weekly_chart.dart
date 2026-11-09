import 'package:flutter/material.dart';
import '../../../models/saved_bill.dart';

class DashboardWeeklyChart extends StatelessWidget {
  final List<SavedBill> bills;

  const DashboardWeeklyChart({super.key, required this.bills});

  Widget _chartBar({
    required String day,
    required double amount,
    required double heightRatio,
    required bool isToday,
  }) {
    final hasSales = amount > 0;
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          width: 14,
          height: hasSales ? (80 * heightRatio).clamp(6.0, 80.0) : 3.0,
          decoration: BoxDecoration(
            color: hasSales
                ? (isToday ? const Color(0xFF1D4ED8) : const Color(0xFF93C5FD))
                : const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          day,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
            color: isToday ? const Color(0xFF1D4ED8) : const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    // 7 days of the current week (Mon-Sun)
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final now = DateTime.now();
    // Monday of current week
    final monday = now.subtract(Duration(days: now.weekday - 1));

    final dailyTotals = List.filled(7, 0.0);
    for (final b in bills) {
      final diff =
          b.date.difference(DateTime(monday.year, monday.month, monday.day)).inDays;
      if (diff >= 0 && diff < 7) {
        dailyTotals[diff] += b.total;
      }
    }

    double maxVal = dailyTotals.reduce((curr, next) => curr > next ? curr : next);
    if (maxVal < 1000) maxVal = 1000;

    return SizedBox(
      height: 120,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Y axis
          const Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('30K', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              Text('20K', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              Text('10K', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              Text('0', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
            ],
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (int i = 0; i < 7; i++)
                  _chartBar(
                    day: days[i],
                    amount: dailyTotals[i],
                    heightRatio: dailyTotals[i] > 0
                        ? (dailyTotals[i] / maxVal).clamp(0.08, 1.0)
                        : 0.0,
                    isToday: (now.weekday - 1) == i,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
