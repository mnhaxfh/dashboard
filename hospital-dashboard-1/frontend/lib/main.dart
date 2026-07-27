import 'package:flutter/material.dart';

import 'screens/dashboard/dashboard_screen.dart';

void main() {
  runApp(const HospitalDashboardApp());
}

class HospitalDashboardApp extends StatelessWidget {
  const HospitalDashboardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Nam học & Hiếm muộn - Vận hành Realtime',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0E6E6E),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFF4F7F8),
        fontFamily: 'Roboto',
      ),
      home: const DashboardScreen(),
    );
  }
}
