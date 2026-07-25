// Gọi API FastAPI
// lib/api_client.dart
//
// Gọi API dashboard từ backend FastAPI.
// Cài package: flutter pub add http

import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  // Đổi thành URL server thật khi deploy.
  static const String baseUrl = "http://localhost:8000";

  /// Lấy toàn bộ dữ liệu dashboard: patients + kpis + rooms + sla_alerts
  /// trong 1 lần gọi. Nếu [date] = null -> lấy bệnh nhân đang active (realtime).
  static Future<Map<String, dynamic>> fetchDashboardSummary({
    String? date,
  }) async {
    final uri = Uri.parse(
      "$baseUrl/api/dashboard/summary",
    ).replace(queryParameters: date != null ? {"date": date} : null);

    final response = await http.get(uri);

    if (response.statusCode != 200) {
      throw Exception(
        "Lỗi lấy dashboard summary: ${response.statusCode} ${response.body}",
      );
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  /// Lấy chi tiết 1 bệnh nhân theo patient_id — dùng khi FE click xem chi tiết.
  static Future<Map<String, dynamic>> fetchPatientDetail(int patientId) async {
    final uri = Uri.parse("$baseUrl/api/dashboard/patients/$patientId");

    final response = await http.get(uri);

    if (response.statusCode == 404) {
      throw Exception("Không tìm thấy bệnh nhân $patientId");
    }
    if (response.statusCode != 200) {
      throw Exception(
        "Lỗi lấy chi tiết bệnh nhân: ${response.statusCode} ${response.body}",
      );
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }
}
