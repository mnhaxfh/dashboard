import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../api_client.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<_DashboardData> _dashboardFuture;
  Timer? _refreshTimer;
  Timer? _secondsTimer;
  int _secondsSinceRefresh = 0;
  final _patientSearchController = TextEditingController();
  final _roomSearchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _dashboardFuture = _loadDashboard();
    _patientSearchController.addListener(_onSearchChanged);
    _roomSearchController.addListener(_onSearchChanged);
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refresh(),
    );
    _secondsTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _secondsSinceRefresh++);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _secondsTimer?.cancel();
    _patientSearchController.dispose();
    _roomSearchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    if (mounted) setState(() {});
  }

  Future<_DashboardData> _loadDashboard() async {
    final summary = await ApiClient.fetchDashboardSummary();
    return _DashboardData.fromJson(summary);
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    setState(() {
      _secondsSinceRefresh = 0;
      _dashboardFuture = _loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _AppColors.background,
      body: SafeArea(
        child: FutureBuilder<_DashboardData>(
          future: _dashboardFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snapshot.hasError) {
              return _ErrorState(
                message: snapshot.error.toString(),
                onRetry: _refresh,
              );
            }

            final data = snapshot.data ?? _DashboardData.empty();
            return RefreshIndicator(
              onRefresh: _refresh,
              color: _AppColors.accent,
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                    sliver: SliverToBoxAdapter(
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1240),
                          child: _DashboardContent(
                            data: data,
                            secondsSinceRefresh: _secondsSinceRefresh,
                            patientSearchController: _patientSearchController,
                            roomSearchController: _roomSearchController,
                            onRefresh: _refresh,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({
    required this.data,
    required this.secondsSinceRefresh,
    required this.patientSearchController,
    required this.roomSearchController,
    required this.onRefresh,
  });

  final _DashboardData data;
  final int secondsSinceRefresh;
  final TextEditingController patientSearchController;
  final TextEditingController roomSearchController;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final patientQuery = patientSearchController.text.trim().toLowerCase();
    final roomQuery = roomSearchController.text.trim().toLowerCase();
    final filteredPatients = data.patients.where((patient) {
      return patientQuery.isEmpty ||
          patient.displayId.toLowerCase().contains(patientQuery) ||
          patient.fullName.toLowerCase().contains(patientQuery);
    }).toList();
    final filteredRooms = data.rooms.where((room) {
      return roomQuery.isEmpty ||
          room.displayId.toLowerCase().contains(roomQuery) ||
          room.name.toLowerCase().contains(roomQuery);
    }).toList();

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 980;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              secondsSinceRefresh: secondsSinceRefresh,
              onRefresh: onRefresh,
            ),
            const SizedBox(height: 16),
            _KpiSection(data: data),
            const SizedBox(height: 14),
            _WaitStrip(data: data),
            const SizedBox(height: 14),
            _DayChartCard(loadLevel: _loadLevelNow()),
            const SizedBox(height: 14),
            _SlaPanel(alerts: data.slaAlerts),
            const SizedBox(height: 14),
            isWide
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _PatientPanel(
                          patients: filteredPatients,
                          totalCount: data.patients.length,
                          controller: patientSearchController,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: _RoomPanel(
                          rooms: filteredRooms,
                          patients: data.patients,
                          totalCount: data.rooms.length,
                          controller: roomSearchController,
                        ),
                      ),
                    ],
                  )
                : Column(
                    children: [
                      _PatientPanel(
                        patients: filteredPatients,
                        totalCount: data.patients.length,
                        controller: patientSearchController,
                      ),
                      const SizedBox(height: 14),
                      _RoomPanel(
                        rooms: filteredRooms,
                        patients: data.patients,
                        totalCount: data.rooms.length,
                        controller: roomSearchController,
                      ),
                    ],
                  ),
          ],
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.secondsSinceRefresh, required this.onRefresh});

  final int secondsSinceRefresh;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final load = _loadLabel(_loadLevelNow());
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 12,
      spacing: 12,
      children: [
        const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _PulseDot(),
            SizedBox(width: 10),
            Flexible(
              child: Text(
                'Nam học & Hiếm muộn - Vận hành Realtime',
                style: TextStyle(
                  color: _AppColors.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
            ),
          ],
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _StatusPill(
              text: '${_formatClock(DateTime.now())} · ${load.label}',
              foreground: load.foreground,
              background: load.background,
              border: load.border,
            ),
            _StatusPill(
              text: 'Cập nhật ${secondsSinceRefresh}s trước · tự động mỗi 5s',
              foreground: _AppColors.subtle,
              background: _AppColors.surface,
              border: _AppColors.border,
            ),
            IconButton.filledTonal(
              onPressed: onRefresh,
              tooltip: 'Làm mới',
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
      ],
    );
  }
}

class _KpiSection extends StatelessWidget {
  const _KpiSection({required this.data});

  final _DashboardData data;

  @override
  Widget build(BuildContext context) {
    final openRooms = data.rooms.where((room) => room.isOpen).length;
    final overloadedRooms = data.rooms
        .where((room) => room.isOverloaded)
        .length;
    final overloadPct = openRooms == 0
        ? 0
        : ((overloadedRooms / openRooms) * 100).round();

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        final columns = maxWidth >= 1100
            ? 5
            : maxWidth >= 760
            ? 3
            : maxWidth >= 520
            ? 2
            : 1;
        return GridView.count(
          crossAxisCount: columns,
          crossAxisSpacing: 14,
          mainAxisSpacing: 14,
          childAspectRatio: columns == 1 ? 3.1 : 1.85,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            _KpiCard(
              label: 'Bệnh nhân đang theo dõi',
              value: '${data.kpis.totalPatients}',
              subText: 'mã đang hoạt động (đã xuất viện thì rời danh sách)',
            ),
            _KpiCard(
              label: 'Bệnh nhân đang khám',
              value: '${data.kpis.examining}',
              subText:
                  '${data.kpis.waiting} chờ kết quả · ${data.kpis.notStarted} chưa khám',
            ),
            _KpiCard(
              label: 'Đã xuất viện (phiên này)',
              value: '${data.kpis.discharged}',
              subText: 'kể từ khi mở phiên demo',
            ),
            _KpiCard(
              label: 'Phòng đang hoạt động',
              value: '$openRooms / ${data.rooms.length}',
              subText: 'trên tổng số phòng khám',
            ),
            _OverloadCard(
              percent: overloadPct,
              overloadedRooms: overloadedRooms,
              openRooms: openRooms,
              rooms: data.rooms,
            ),
          ],
        );
      },
    );
  }
}

class _WaitStrip extends StatelessWidget {
  const _WaitStrip({required this.data});

  final _DashboardData data;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 760;
        final cards = [
          Expanded(
            flex: isWide ? 13 : 1,
            child: _WaitCard(data: data),
          ),
          if (isWide) const SizedBox(width: 14),
          Expanded(
            flex: isWide ? 10 : 1,
            child: _KpiCard(
              label: 'Tổng thời gian khám trung bình (BN đã xuất viện)',
              value: data.averageCompletedMinutes == null
                  ? '—'
                  : _formatDuration(data.averageCompletedMinutes!),
              subText: data.completedPatientCount == 0
                  ? 'chưa có ca xuất viện'
                  : 'trung bình trên ${data.completedPatientCount} ca đã xuất viện',
            ),
          ),
        ];
        if (isWide) return Row(children: cards);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [cards.first, const SizedBox(height: 14), cards.last],
        );
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.subText,
  });

  final String label;
  final String value;
  final String subText;

  @override
  Widget build(BuildContext context) {
    return _DashboardCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _SectionLabel(label),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              maxLines: 1,
              style: const TextStyle(
                color: _AppColors.ink,
                fontSize: 30,
                fontWeight: FontWeight.w800,
                letterSpacing: 0,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subText,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: _AppColors.subtle, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _OverloadCard extends StatelessWidget {
  const _OverloadCard({
    required this.percent,
    required this.overloadedRooms,
    required this.openRooms,
    required this.rooms,
  });

  final int percent;
  final int overloadedRooms;
  final int openRooms;
  final List<_RoomSummary> rooms;

  @override
  Widget build(BuildContext context) {
    final isWarn = percent >= 25;
    return _DashboardCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionLabel('Tỷ lệ quá tải'),
                    const SizedBox(height: 8),
                    Text(
                      '$percent%',
                      style: TextStyle(
                        color: isWarn ? _AppColors.danger : _AppColors.success,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$overloadedRooms / $openRooms phòng đang mở\nquá tải',
                textAlign: TextAlign.right,
                style: const TextStyle(color: _AppColors.subtle, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _RoomMiniGrid(rooms: rooms),
        ],
      ),
    );
  }
}

class _RoomMiniGrid extends StatelessWidget {
  const _RoomMiniGrid({required this.rooms});

  final List<_RoomSummary> rooms;

  @override
  Widget build(BuildContext context) {
    if (rooms.isEmpty) {
      return const SizedBox(
        height: 28,
        child: Center(
          child: Text(
            'Chưa có dữ liệu phòng',
            style: TextStyle(color: _AppColors.subtle, fontSize: 12),
          ),
        ),
      );
    }

    return GridView.builder(
      itemCount: rooms.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 14,
        mainAxisSpacing: 3,
        crossAxisSpacing: 3,
      ),
      itemBuilder: (context, index) {
        final room = rooms[index];
        final color = !room.isOpen
            ? null
            : room.isOverloaded
            ? _AppColors.danger
            : room.waiting > 0 || room.inProgress > 0
            ? _AppColors.success
            : _AppColors.neutralSoft;
        return Tooltip(
          message:
              '${room.displayId} - ${room.name}: ${room.isOpen ? '${room.waiting}/${room.effectiveCapacity} (nhân sự trực: ${room.staffOnDuty})' : 'đóng cửa'}',
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: room.isOpen ? color : null,
              gradient: room.isOpen ? null : _AppColors.closedRoomPattern,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      },
    );
  }
}

class _WaitCard extends StatelessWidget {
  const _WaitCard({required this.data});

  final _DashboardData data;

  @override
  Widget build(BuildContext context) {
    final averageWait = data.averageWaitingMinutes;
    final samples = _sparkSamples(averageWait);
    final maxValue = math.max(1, samples.reduce(math.max));

    return _DashboardCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const _SectionLabel(
                  'Thời gian chờ trung bình thực tế (BN chưa xong)',
                ),
                const SizedBox(height: 8),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    _formatDuration(averageWait),
                    style: const TextStyle(
                      color: _AppColors.ink,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          SizedBox(
            width: 92,
            height: 36,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: samples
                  .map(
                    (value) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 1),
                        child: FractionallySizedBox(
                          heightFactor: (value / maxValue).clamp(0.08, 1),
                          alignment: Alignment.bottomCenter,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: _AppColors.accent,
                              borderRadius: BorderRadius.circular(1),
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _DayChartCard extends StatelessWidget {
  const _DayChartCard({required this.loadLevel});

  final double loadLevel;

  @override
  Widget build(BuildContext context) {
    return _DashboardCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: const [
              Expanded(
                child: Text(
                  'Cường độ tải cả ngày (06:00–20:00)',
                  style: TextStyle(
                    color: _AppColors.ink,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    letterSpacing: 0,
                  ),
                ),
              ),
              _LegendDot(color: _AppColors.accent, text: 'Cường độ dự kiến'),
              SizedBox(width: 12),
              _LegendDot(color: _AppColors.danger, text: 'Thời điểm hiện tại'),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 110,
            child: CustomPaint(
              painter: _DayLoadPainter(loadLevel: loadLevel),
              child: const SizedBox.expand(),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlaPanel extends StatelessWidget {
  const _SlaPanel({required this.alerts});

  final List<_SlaAlert> alerts;

  @override
  Widget build(BuildContext context) {
    return _DashboardCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          _PanelHeader(
            title: 'Cảnh báo chờ quá lâu (SLA)',
            count: '${alerts.length} ca',
          ),
          if (alerts.isEmpty)
            const Padding(
              padding: EdgeInsets.all(18),
              child: Text(
                'Không có ca nào chờ quá 45 phút.',
                style: TextStyle(color: _AppColors.subtle, fontSize: 13),
              ),
            )
          else
            ...alerts.take(12).map((alert) => _SlaRow(alert: alert)),
        ],
      ),
    );
  }
}

class _SlaRow extends StatelessWidget {
  const _SlaRow({required this.alert});

  final _SlaAlert alert;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _AppColors.border)),
      ),
      child: Row(
        children: [
          _IdText(alert.patientDisplayId),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'đang chờ vào ${alert.roomName} (${alert.roomDisplayId})',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: _AppColors.subtle, fontSize: 13),
            ),
          ),
          const SizedBox(width: 10),
          _StatusChip(
            text: _formatDuration(alert.waitedMinutes),
            foreground: _AppColors.danger,
            background: _AppColors.dangerSoft,
          ),
        ],
      ),
    );
  }
}

class _PatientPanel extends StatelessWidget {
  const _PatientPanel({
    required this.patients,
    required this.totalCount,
    required this.controller,
  });

  final List<_Patient> patients;
  final int totalCount;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return _DashboardCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          _PanelHeader(title: 'Bệnh nhân', count: '$totalCount mã'),
          _SearchField(
            controller: controller,
            hintText: 'Tìm theo mã BN hoặc tên...',
          ),
          if (patients.isEmpty)
            const _EmptyListLabel(text: 'Không tìm thấy bệnh nhân phù hợp.')
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 520),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: patients.length,
                itemBuilder: (context, index) {
                  return _PatientTile(patient: patients[index]);
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _PatientTile extends StatelessWidget {
  const _PatientTile({required this.patient});

  final _Patient patient;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 18),
      childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
      shape: const Border(top: BorderSide(color: _AppColors.border)),
      collapsedShape: const Border(top: BorderSide(color: _AppColors.border)),
      title: Row(
        children: [
          _IdText(patient.displayId),
          const SizedBox(width: 10),
          _GenderTag(gender: patient.gender),
          if (patient.isUrgent) ...[
            const SizedBox(width: 8),
            const _PriorityTag(),
          ],
        ],
      ),
      trailing: Text(
        '${patient.completedSteps}/${patient.totalSteps} phòng xong · ${_formatDuration(patient.elapsedMinutes)}',
        style: const TextStyle(color: _AppColors.subtle, fontSize: 12),
      ),
      children: [
        _MetaLine(
          children: [
            'Trạng thái: ${patient.statusLabel}',
            'Ưu tiên: ${patient.priorityLabel}',
            'Check-in: ${_formatTime(patient.checkInTime)}',
          ],
        ),
        const SizedBox(height: 6),
        ...patient.steps.map(
          (step) => _DetailLine(
            label:
                '${step.roomName} (${step.roomDisplayId})${step.doctorName.isEmpty ? '' : ' - ${step.doctorName}'}',
            chip: _StatusChip.fromStatus(step.status),
          ),
        ),
      ],
    );
  }
}

class _RoomPanel extends StatelessWidget {
  const _RoomPanel({
    required this.rooms,
    required this.patients,
    required this.totalCount,
    required this.controller,
  });

  final List<_RoomSummary> rooms;
  final List<_Patient> patients;
  final int totalCount;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return _DashboardCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          _PanelHeader(title: 'Phòng khám', count: '$totalCount phòng'),
          _SearchField(
            controller: controller,
            hintText: 'Tìm theo mã phòng hoặc tên phòng...',
          ),
          if (rooms.isEmpty)
            const _EmptyListLabel(text: 'Không tìm thấy phòng phù hợp.')
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 520),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: rooms.length,
                itemBuilder: (context, index) {
                  return _RoomTile(room: rooms[index], patients: patients);
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _RoomTile extends StatelessWidget {
  const _RoomTile({required this.room, required this.patients});

  final _RoomSummary room;
  final List<_Patient> patients;

  @override
  Widget build(BuildContext context) {
    final waitingIds = _patientIdsForRoom(
      room.roomId,
      patients,
      _VisitStatus.waiting,
    );
    final noneIds = _patientIdsForRoom(
      room.roomId,
      patients,
      _VisitStatus.none,
    );
    final progressIds = _patientIdsForRoom(
      room.roomId,
      patients,
      _VisitStatus.progress,
    );
    final allWaitingIds = [...noneIds, ...waitingIds];

    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 18),
      childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
      shape: const Border(top: BorderSide(color: _AppColors.border)),
      collapsedShape: const Border(top: BorderSide(color: _AppColors.border)),
      title: Row(
        children: [
          _IdText(room.displayId),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              room.name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: _AppColors.subtle, fontSize: 13),
            ),
          ),
        ],
      ),
      trailing: room.statusChip,
      children: [
        _MetaLine(
          children: [
            'Loại phòng: ${room.typeLabel}',
            if (room.isOpen) 'Nhân sự trực: ${room.staffOnDuty} người',
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _RoomStat(
              label: 'Sức chứa vật lý',
              value: '${room.physicalCapacity}',
            ),
            _RoomStat(
              label: 'Sức chứa hiệu dụng',
              value: '${room.effectiveCapacity}',
            ),
            _RoomStat(label: 'Đang chờ', value: '${room.waiting}'),
            _RoomStat(
              label: 'Ngưỡng quá tải',
              value: '> ${room.overloadThreshold}',
            ),
          ],
        ),
        const SizedBox(height: 12),
        _IdGroup(
          label: 'ID đang chờ (${allWaitingIds.length})',
          ids: allWaitingIds,
        ),
        const SizedBox(height: 10),
        _IdGroup(
          label: 'ID đang khám (${progressIds.length})',
          ids: progressIds,
        ),
      ],
    );
  }
}

class _DashboardCard extends StatelessWidget {
  const _DashboardCard({required this.child, required this.padding});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _AppColors.border),
      ),
      padding: padding,
      child: child,
    );
  }
}

class _PanelHeader extends StatelessWidget {
  const _PanelHeader({required this.title, required this.count});

  final String title;
  final String count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: _AppColors.ink,
                fontSize: 14,
                fontWeight: FontWeight.w800,
                letterSpacing: 0,
              ),
            ),
          ),
          Text(
            count,
            style: const TextStyle(color: _AppColors.subtle, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.hintText});

  final TextEditingController controller;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
      child: TextField(
        controller: controller,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          hintText: hintText,
          prefixIcon: const Icon(Icons.search, size: 18),
          isDense: true,
          filled: true,
          fillColor: _AppColors.neutralSoft,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 10,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _AppColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _AppColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _AppColors.accent),
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(
        color: _AppColors.subtle,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.text,
    required this.foreground,
    required this.background,
    required this.border,
  });

  final String text;
  final Color foreground;
  final Color background;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: foreground,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _PulseDot extends StatelessWidget {
  const _PulseDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 10,
      height: 10,
      decoration: const BoxDecoration(
        color: _AppColors.success,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: Color(0x5517864F), blurRadius: 8, spreadRadius: 2),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.text});

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          text,
          style: const TextStyle(color: _AppColors.subtle, fontSize: 11),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.text,
    required this.foreground,
    required this.background,
  });

  factory _StatusChip.fromStatus(_VisitStatus status) {
    return _StatusChip(
      text: status.label,
      foreground: status.foreground,
      background: status.background,
    );
  }

  final String text;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: foreground,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _GenderTag extends StatelessWidget {
  const _GenderTag({required this.gender});

  final String gender;

  @override
  Widget build(BuildContext context) {
    final normalized = _normalizeVietnamese(gender);
    final isFemale = gender.toUpperCase() == 'F' || normalized.contains('nu');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: isFemale ? _AppColors.femaleSoft : _AppColors.maleSoft,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        isFemale ? 'Nữ' : 'Nam',
        style: TextStyle(
          color: isFemale ? _AppColors.female : _AppColors.male,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _PriorityTag extends StatelessWidget {
  const _PriorityTag();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: _AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Text(
        'Khẩn',
        style: TextStyle(
          color: _AppColors.danger,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _IdText extends StatelessWidget {
  const _IdText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: _AppColors.ink,
        fontSize: 13,
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
      ),
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.children});

  final List<String> children;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: children
          .map(
            (text) => Text(
              text,
              style: const TextStyle(color: _AppColors.subtle, fontSize: 12),
            ),
          )
          .toList(),
    );
  }
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.label, required this.chip});

  final String label;
  final Widget chip;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: _AppColors.ink, fontSize: 13),
            ),
          ),
          const SizedBox(width: 10),
          chip,
        ],
      ),
    );
  }
}

class _RoomStat extends StatelessWidget {
  const _RoomStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: _AppColors.subtle, fontSize: 12),
          ),
          Text(
            value,
            style: const TextStyle(
              color: _AppColors.ink,
              fontSize: 18,
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
          ),
        ],
      ),
    );
  }
}

class _IdGroup extends StatelessWidget {
  const _IdGroup({required this.label, required this.ids});

  final String label;
  final List<String> ids;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: _AppColors.subtle,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        if (ids.isEmpty)
          const Text(
            'Không có',
            style: TextStyle(
              color: _AppColors.subtle,
              fontSize: 12,
              fontStyle: FontStyle.italic,
            ),
          )
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: ids
                .map(
                  (id) => Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _AppColors.surface,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _AppColors.border),
                    ),
                    child: Text(
                      id,
                      style: const TextStyle(
                        color: _AppColors.ink,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
      ],
    );
  }
}

class _EmptyListLabel extends StatelessWidget {
  const _EmptyListLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Text(
        text,
        style: const TextStyle(color: _AppColors.subtle, fontSize: 13),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: _DashboardCard(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: _AppColors.danger,
                size: 32,
              ),
              const SizedBox(height: 10),
              const Text(
                'Không tải được dashboard',
                style: TextStyle(
                  color: _AppColors.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _AppColors.subtle, fontSize: 13),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayLoadPainter extends CustomPainter {
  const _DayLoadPainter({required this.loadLevel});

  final double loadLevel;

  @override
  void paint(Canvas canvas, Size size) {
    final pad = 4.0;
    final accentPaint = Paint()
      ..color = _AppColors.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    final areaPaint = Paint()
      ..color = _AppColors.accentSoft.withValues(alpha: 0.7)
      ..style = PaintingStyle.fill;
    final dangerPaint = Paint()
      ..color = _AppColors.danger
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    final points = <Offset>[];
    const steps = 56;
    for (var i = 0; i <= steps; i++) {
      final progress = i / steps;
      final hour = 6 + 14 * progress;
      final intensity = _loadCurve(hour);
      points.add(
        Offset(
          pad + (size.width - pad * 2) * progress,
          size.height - pad - intensity * (size.height - pad * 2),
        ),
      );
    }

    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      linePath.lineTo(point.dx, point.dy);
    }

    final areaPath = Path.from(linePath)
      ..lineTo(size.width - pad, size.height - pad)
      ..lineTo(pad, size.height - pad)
      ..close();

    canvas.drawPath(areaPath, areaPaint);
    canvas.drawPath(linePath, accentPaint);

    final nowFraction = _dayProgressNow();
    final nowX = pad + (size.width - pad * 2) * nowFraction;
    final dashHeight = 7.0;
    var y = pad;
    while (y < size.height - pad) {
      canvas.drawLine(
        Offset(nowX, y),
        Offset(nowX, math.min(y + dashHeight, size.height - pad)),
        dangerPaint,
      );
      y += dashHeight + 4;
    }

    final nowY = size.height - pad - loadLevel * (size.height - pad * 2);
    canvas.drawCircle(
      Offset(nowX, nowY),
      4,
      Paint()..color = _AppColors.danger,
    );

    final textPainter = TextPainter(textDirection: TextDirection.ltr);
    _paintChartLabel(canvas, textPainter, '06:00', Offset(2, 0));
    _paintChartLabel(canvas, textPainter, '20:00', Offset(size.width - 40, 0));
  }

  void _paintChartLabel(
    Canvas canvas,
    TextPainter painter,
    String text,
    Offset offset,
  ) {
    painter.text = TextSpan(
      text: text,
      style: const TextStyle(color: _AppColors.subtle, fontSize: 10),
    );
    painter.layout();
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _DayLoadPainter oldDelegate) {
    return oldDelegate.loadLevel != loadLevel;
  }
}

class _DashboardData {
  const _DashboardData({
    required this.patients,
    required this.rooms,
    required this.slaAlerts,
    required this.kpis,
  });

  factory _DashboardData.empty() {
    return _DashboardData(
      patients: const [],
      rooms: _defaultRoomSummaries(),
      slaAlerts: const [],
      kpis: const _Kpis.empty(),
    );
  }

  factory _DashboardData.fromJson(Map<String, dynamic> json) {
    final patients = _asList(json['patients']).map(_Patient.fromJson).toList();
    final apiRooms = _asList(json['rooms']).map(_RoomSummary.fromJson).toList();
    final alerts = _asList(json['sla_alerts']).map(_SlaAlert.fromJson).toList();
    final kpis = _Kpis.fromJson(_asMap(json['kpis']), patients: patients);
    return _DashboardData(
      patients: patients,
      rooms: _mergeRoomSummaries(apiRooms),
      slaAlerts: alerts,
      kpis: kpis,
    );
  }

  final List<_Patient> patients;
  final List<_RoomSummary> rooms;
  final List<_SlaAlert> slaAlerts;
  final _Kpis kpis;

  /// Thời gian chờ trung bình THỰC TẾ — lấy trực tiếp từ backend
  /// (tính theo queued_at của các visit_step chưa xong, giống logic SLA alert),
  /// KHÔNG còn tự tính bằng (now - check_in_time) như trước — cách cũ đo
  /// "đã nằm viện bao lâu" nên bị các bệnh nhân check-in lâu nhưng chưa
  /// xuất viện kéo lệch, khiến số liệu trông như đứng yên.
  double get averageWaitingMinutes => kpis.averageWaitingMinutes;

  int get completedPatientCount {
    return patients
        .where(
          (patient) =>
              patient.checkInTime != null && patient.dischargeTime != null,
        )
        .length;
  }

  double? get averageCompletedMinutes {
    final durations = patients
        .where(
          (patient) =>
              patient.checkInTime != null && patient.dischargeTime != null,
        )
        .map(
          (patient) => patient.dischargeTime!
              .difference(patient.checkInTime!)
              .inMinutes
              .abs(),
        )
        .toList();
    if (durations.isEmpty) return null;
    return durations.reduce((a, b) => a + b) / durations.length;
  }
}

class _Kpis {
  const _Kpis({
    required this.totalPatients,
    required this.examining,
    required this.waiting,
    required this.notStarted,
    required this.discharged,
    required this.averageWaitingMinutes,
  });

  const _Kpis.empty()
    : totalPatients = 0,
      examining = 0,
      waiting = 0,
      notStarted = 0,
      discharged = 0,
      averageWaitingMinutes = 0;

  factory _Kpis.fromJson(
    Map<String, dynamic> json, {
    required List<_Patient> patients,
  }) {
    return _Kpis(
      totalPatients: _intValue(
        json['total_patients'],
        fallback: patients.length,
      ),
      examining: _intValue(
        json['patients_examining'],
        fallback: patients.where((patient) => patient.inProgress).length,
      ),
      waiting: _intValue(json['patients_waiting']),
      notStarted: _intValue(json['patients_not_started']),
      discharged: _intValue(json['patients_discharged']),
      // Trung bình phút chờ THỰC TẾ (tính từ queued_at của các step chưa xong)
      // — do backend tính, KHÔNG suy ra từ check_in_time ở client nữa.
      averageWaitingMinutes: _doubleValue(json['average_waiting_minutes']),
    );
  }

  final int totalPatients;
  final int examining;
  final int waiting;
  final int notStarted;
  final int discharged;
  final double averageWaitingMinutes;
}

class _Patient {
  const _Patient({
    required this.patientId,
    required this.fullName,
    required this.gender,
    required this.priority,
    required this.status,
    required this.checkInTime,
    required this.dischargeTime,
    required this.steps,
    required this.totalSteps,
    required this.completedSteps,
  });

  factory _Patient.fromJson(Map<String, dynamic> json) {
    final steps = _asList(json['steps']).map(_VisitStep.fromJson).toList();
    return _Patient(
      patientId: _intValue(json['patient_id']),
      fullName: _stringValue(json['full_name'], fallback: 'Bệnh nhân'),
      gender: _stringValue(json['gender'], fallback: 'M'),
      priority: _stringValue(json['priority']),
      status: _stringValue(json['status']),
      checkInTime: _dateValue(json['check_in_time']),
      dischargeTime: _dateValue(json['discharge_time']),
      steps: steps,
      totalSteps: _intValue(json['total_steps'], fallback: steps.length),
      completedSteps: _intValue(
        json['completed_steps'],
        fallback: steps
            .where((step) => step.status == _VisitStatus.done)
            .length,
      ),
    );
  }

  final int patientId;
  final String fullName;
  final String gender;
  final String priority;
  final String status;
  final DateTime? checkInTime;
  final DateTime? dischargeTime;
  final List<_VisitStep> steps;
  final int totalSteps;
  final int completedSteps;

  String get displayId => 'BN$patientId';
  bool get isUrgent => _normalizeVietnamese(priority).contains('khan');
  bool get inProgress =>
      steps.any((step) => step.status == _VisitStatus.progress);
  String get priorityLabel => priority.isEmpty ? 'Thường' : priority;
  String get statusLabel => status.isEmpty ? 'Đang theo dõi' : status;

  double get elapsedMinutes {
    final start = checkInTime;
    if (start == null) return 0;
    final end = dischargeTime ?? DateTime.now();
    return end.difference(start).inMinutes.abs().toDouble();
  }
}

class _VisitStep {
  const _VisitStep({
    required this.stepId,
    required this.roomId,
    required this.roomName,
    required this.roomType,
    required this.doctorName,
    required this.status,
  });

  factory _VisitStep.fromJson(Map<String, dynamic> json) {
    return _VisitStep(
      stepId: _intValue(json['step_id']),
      roomId: _intValue(json['room_id']),
      roomName: _stringValue(json['room_name'], fallback: 'Phòng khám'),
      roomType: _stringValue(json['room_type']),
      doctorName: _stringValue(json['doctor_name']),
      status: _VisitStatus.fromRaw(_stringValue(json['status'])),
    );
  }

  final int stepId;
  final int roomId;
  final String roomName;
  final String roomType;
  final String doctorName;
  final _VisitStatus status;

  String get roomDisplayId => _displayRoomId(roomId);
}

class _RoomSummary {
  const _RoomSummary({
    required this.roomId,
    required this.name,
    required this.type,
    required this.physicalCapacity,
    required this.waiting,
    required this.inProgress,
    required this.done,
    required this.apiOverloaded,
    required this.minIntensity,
    required this.baseStaff,
  });

  factory _RoomSummary.fromJson(Map<String, dynamic> json) {
    final roomId = _intValue(json['room_id']);
    final definition = _roomDefinitionById(roomId);
    return _RoomSummary(
      roomId: roomId,
      name: _stringValue(
        json['room_name'],
        fallback: definition?.name ?? 'Phòng khám',
      ),
      type: _stringValue(json['room_type'], fallback: definition?.type ?? ''),
      physicalCapacity: _intValue(
        json['physical_capacity'],
        fallback: definition?.slots ?? 0,
      ),
      waiting: _intValue(json['waiting']),
      inProgress: _intValue(json['in_progress']),
      done: _intValue(json['done']),
      apiOverloaded: json['overloaded'] == true,
      minIntensity: definition?.minIntensity ?? 0,
      baseStaff: definition?.baseStaff ?? 1,
    );
  }

  factory _RoomSummary.fromDefinition(_RoomDefinition definition) {
    return _RoomSummary(
      roomId: definition.roomId,
      name: definition.name,
      type: definition.type,
      physicalCapacity: definition.slots,
      waiting: 0,
      inProgress: 0,
      done: 0,
      apiOverloaded: false,
      minIntensity: definition.minIntensity,
      baseStaff: definition.baseStaff,
    );
  }

  final int roomId;
  final String name;
  final String type;
  final int physicalCapacity;
  final int waiting;
  final int inProgress;
  final int done;
  final bool apiOverloaded;
  final double minIntensity;
  final int baseStaff;

  String get displayId => _displayRoomId(roomId);
  bool get isOpen => _loadLevelNow() >= minIntensity;
  int get staffOnDuty {
    if (!isOpen) return 0;
    final level = _loadLevelNow();
    if (level < 0.3) return baseStaff > 1 ? baseStaff - 1 : 1;
    return baseStaff;
  }

  int get effectiveCapacity {
    if (!isOpen) return 0;
    return math.min(physicalCapacity, staffOnDuty * 2);
  }

  int get overloadThreshold {
    final thresholdMultiplier = physicalCapacity >= 8 ? 2 : 1;
    return effectiveCapacity * thresholdMultiplier;
  }

  bool get isOverloaded {
    if (!isOpen) return false;
    return apiOverloaded || waiting > overloadThreshold;
  }

  Widget get statusChip {
    if (!isOpen) {
      return const _StatusChip(
        text: 'Đóng cửa',
        foreground: _AppColors.subtle,
        background: _AppColors.neutralSoft,
      );
    }
    if (isOverloaded) {
      return const _StatusChip(
        text: 'Quá tải',
        foreground: _AppColors.danger,
        background: _AppColors.dangerSoft,
      );
    }
    return const _StatusChip(
      text: 'Ổn định',
      foreground: _AppColors.success,
      background: _AppColors.successSoft,
    );
  }

  String get typeLabel {
    return switch (type) {
      'clinic' => 'Khám lâm sàng',
      'procedure' => 'Thủ thuật',
      'lab' => 'Xét nghiệm / Lab',
      _ => type.isEmpty ? 'Chưa phân loại' : type,
    };
  }
}

class _RoomDefinition {
  const _RoomDefinition({
    required this.roomId,
    required this.name,
    required this.type,
    required this.slots,
    required this.minIntensity,
    required this.baseStaff,
  });

  final int roomId;
  final String name;
  final String type;
  final int slots;
  final double minIntensity;
  final int baseStaff;
}

const _roomDefinitions = [
  _RoomDefinition(
    roomId: 101,
    name: 'Khám nam khoa',
    type: 'clinic',
    slots: 4,
    minIntensity: 0,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 102,
    name: 'Xét nghiệm tinh dịch đồ',
    type: 'lab',
    slots: 4,
    minIntensity: 0,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 103,
    name: 'Siêu âm đầu dò',
    type: 'clinic',
    slots: 6,
    minIntensity: 0.15,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 104,
    name: 'Khám hiếm muộn nữ',
    type: 'clinic',
    slots: 4,
    minIntensity: 0,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 105,
    name: 'Nội tiết sinh sản',
    type: 'clinic',
    slots: 6,
    minIntensity: 0.15,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 106,
    name: 'Siêu âm nang noãn',
    type: 'clinic',
    slots: 8,
    minIntensity: 0.25,
    baseStaff: 3,
  ),
  _RoomDefinition(
    roomId: 107,
    name: 'Chọc hút noãn (OPU)',
    type: 'procedure',
    slots: 4,
    minIntensity: 0.45,
    baseStaff: 3,
  ),
  _RoomDefinition(
    roomId: 108,
    name: 'Chuyển phôi (ET)',
    type: 'procedure',
    slots: 4,
    minIntensity: 0.45,
    baseStaff: 3,
  ),
  _RoomDefinition(
    roomId: 109,
    name: 'Trữ đông phôi & tinh trùng',
    type: 'lab',
    slots: 6,
    minIntensity: 0.35,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 110,
    name: 'IUI',
    type: 'procedure',
    slots: 6,
    minIntensity: 0.3,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 111,
    name: 'Vi phẫu nam khoa',
    type: 'procedure',
    slots: 8,
    minIntensity: 0.5,
    baseStaff: 3,
  ),
  _RoomDefinition(
    roomId: 112,
    name: 'Tư vấn di truyền',
    type: 'clinic',
    slots: 8,
    minIntensity: 0.3,
    baseStaff: 1,
  ),
  _RoomDefinition(
    roomId: 113,
    name: 'Xét nghiệm nội tiết',
    type: 'lab',
    slots: 10,
    minIntensity: 0.15,
    baseStaff: 2,
  ),
  _RoomDefinition(
    roomId: 114,
    name: 'Khám tổng quát',
    type: 'clinic',
    slots: 10,
    minIntensity: 0,
    baseStaff: 2,
  ),
];

class _SlaAlert {
  const _SlaAlert({
    required this.patientId,
    required this.fullName,
    required this.roomId,
    required this.roomName,
    required this.waitedMinutes,
  });

  factory _SlaAlert.fromJson(Map<String, dynamic> json) {
    return _SlaAlert(
      patientId: _intValue(json['patient_id']),
      fullName: _stringValue(json['full_name']),
      roomId: _intValue(json['room_id']),
      roomName: _stringValue(json['room_name'], fallback: 'Phòng khám'),
      waitedMinutes: _doubleValue(json['waited_minutes']),
    );
  }

  final int patientId;
  final String fullName;
  final int roomId;
  final String roomName;
  final double waitedMinutes;

  String get patientDisplayId => 'BN$patientId';
  String get roomDisplayId => _displayRoomId(roomId);
}

enum _VisitStatus {
  done,
  waiting,
  progress,
  none;

  factory _VisitStatus.fromRaw(String raw) {
    final normalized = _normalizeVietnamese(raw);
    if (normalized == 'done' || normalized.contains('xong')) {
      return _VisitStatus.done;
    }
    if (normalized == 'progress' || normalized.contains('dang')) {
      return _VisitStatus.progress;
    }
    if (normalized == 'waiting' || normalized.contains('cho')) {
      return _VisitStatus.waiting;
    }
    return _VisitStatus.none;
  }

  String get label {
    return switch (this) {
      _VisitStatus.done => 'Đã xong',
      _VisitStatus.waiting => 'Chờ kết quả',
      _VisitStatus.progress => 'Đang khám',
      _VisitStatus.none => 'Chưa khám',
    };
  }

  Color get foreground {
    return switch (this) {
      _VisitStatus.done => _AppColors.success,
      _VisitStatus.waiting => _AppColors.warning,
      _VisitStatus.progress => _AppColors.accent,
      _VisitStatus.none => _AppColors.subtle,
    };
  }

  Color get background {
    return switch (this) {
      _VisitStatus.done => _AppColors.successSoft,
      _VisitStatus.waiting => _AppColors.warningSoft,
      _VisitStatus.progress => _AppColors.accentSoft,
      _VisitStatus.none => _AppColors.neutralSoft,
    };
  }
}

class _LoadLabel {
  const _LoadLabel({
    required this.label,
    required this.foreground,
    required this.background,
    required this.border,
  });

  final String label;
  final Color foreground;
  final Color background;
  final Color border;
}

class _AppColors {
  static const background = Color(0xFFF4F7F8);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE1E7EA);
  static const ink = Color(0xFF0F2027);
  static const subtle = Color(0xFF64777E);
  static const accent = Color(0xFF0E6E6E);
  static const accentSoft = Color(0xFFE4F1F1);
  static const success = Color(0xFF17864F);
  static const successSoft = Color(0xFFE6F4EC);
  static const warning = Color(0xFFB8720A);
  static const warningSoft = Color(0xFFFBF0DD);
  static const danger = Color(0xFFC22A2A);
  static const dangerSoft = Color(0xFFFBE9E9);
  static const neutralSoft = Color(0xFFEEF2F3);
  static const male = Color(0xFF2D5F8A);
  static const maleSoft = Color(0xFFE7EEF5);
  static const female = Color(0xFFA23E7A);
  static const femaleSoft = Color(0xFFF6E9F1);

  static const closedRoomPattern = LinearGradient(
    colors: [Color(0xFFDCE2E4), Color(0xFFEAEEEF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    stops: [0.48, 0.52],
    tileMode: TileMode.repeated,
  );
}

List<_RoomSummary> _defaultRoomSummaries() {
  return _roomDefinitions.map(_RoomSummary.fromDefinition).toList();
}

List<_RoomSummary> _mergeRoomSummaries(List<_RoomSummary> apiRooms) {
  final byId = {for (final room in apiRooms) room.roomId: room};
  final merged = _roomDefinitions.map((definition) {
    return byId[definition.roomId] ?? _RoomSummary.fromDefinition(definition);
  }).toList();

  for (final apiRoom in apiRooms) {
    if (_roomDefinitionById(apiRoom.roomId) == null) {
      merged.add(apiRoom);
    }
  }

  merged.sort((a, b) => a.roomId.compareTo(b.roomId));
  return merged;
}

_RoomDefinition? _roomDefinitionById(int roomId) {
  for (final definition in _roomDefinitions) {
    if (definition.roomId == roomId) return definition;
  }
  return null;
}

List<Map<String, dynamic>> _asList(Object? value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }
  return [];
}

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

String _stringValue(Object? value, {String fallback = ''}) {
  if (value == null) return fallback;
  final text = value.toString();
  return text.isEmpty ? fallback : text;
}

int _intValue(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _doubleValue(Object? value, {double fallback = 0}) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

DateTime? _dateValue(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

String _displayRoomId(int roomId) {
  if (roomId <= 0) return 'P---';
  return 'P$roomId';
}

String _formatDuration(num minutes) {
  final rounded = minutes.round();
  if (rounded < 60) return '$rounded phút';
  final hours = rounded ~/ 60;
  final mins = rounded % 60;
  return '${hours}h${mins.toString().padLeft(2, '0')}';
}

String _formatTime(DateTime? value) {
  if (value == null) return '-';
  return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}

String _formatClock(DateTime value) {
  return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}

String _normalizeVietnamese(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp('[àáạảãâầấậẩẫăằắặẳẵ]'), 'a')
      .replaceAll(RegExp('[èéẹẻẽêềếệểễ]'), 'e')
      .replaceAll(RegExp('[ìíịỉĩ]'), 'i')
      .replaceAll(RegExp('[òóọỏõôồốộổỗơờớợởỡ]'), 'o')
      .replaceAll(RegExp('[ùúụủũưừứựửữ]'), 'u')
      .replaceAll(RegExp('[ỳýỵỷỹ]'), 'y')
      .replaceAll('đ', 'd');
}

double _loadLevelNow() {
  final now = DateTime.now();
  final hour = now.hour + now.minute / 60;
  return _loadCurve(hour);
}

double _dayProgressNow() {
  final now = DateTime.now();
  final hour = now.hour + now.minute / 60;
  return ((hour - 6) / 14).clamp(0, 1);
}

double _loadCurve(double hour) {
  double gauss(double peak, double sigma) {
    return math.exp(-math.pow(hour - peak, 2) / (2 * sigma * sigma));
  }

  return math.min(1, math.max(gauss(9, 1.16), gauss(15.5, 1.16)) + 0.08);
}

_LoadLabel _loadLabel(double level) {
  if (level > 0.65) {
    return const _LoadLabel(
      label: 'Cao điểm',
      foreground: _AppColors.danger,
      background: _AppColors.dangerSoft,
      border: Color(0xFFF1C8C8),
    );
  }
  if (level > 0.35) {
    return const _LoadLabel(
      label: 'Bình thường',
      foreground: _AppColors.warning,
      background: _AppColors.warningSoft,
      border: Color(0xFFF1DDB0),
    );
  }
  return const _LoadLabel(
    label: 'Thấp điểm',
    foreground: _AppColors.success,
    background: _AppColors.successSoft,
    border: Color(0xFFC7E6D5),
  );
}

List<double> _sparkSamples(double current) {
  final base = current <= 0 ? 8 : current;
  return List.generate(16, (index) {
    final wave = math.sin(index * 0.9) * 0.12;
    final slope = (index - 8) * 0.015;
    return math.max(2, base * (0.9 + wave + slope));
  });
}

List<String> _patientIdsForRoom(
  int roomId,
  List<_Patient> patients,
  _VisitStatus status,
) {
  return patients
      .where(
        (patient) => patient.steps.any(
          (step) => step.roomId == roomId && step.status == status,
        ),
      )
      .map((patient) => patient.displayId)
      .toList();
}
