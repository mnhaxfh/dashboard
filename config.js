const path = require('path');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const adminHtmlPath = path.join(__dirname, 'admin.html');
const dashboardHtmlPath = path.join(__dirname, 'dashboard.html');
const dbPath = process.env.DB_PATH || path.join(__dirname, 'hospital.db');

const ROOMS = [
  { id: 'P101', name: 'Khám nam khoa',              slots: 2, minDuration: 10, maxDuration: 20 },
  { id: 'P102', name: 'Xét nghiệm tinh dịch đồ',   slots: 2, minDuration: 15, maxDuration: 30 },
  { id: 'P103', name: 'Siêu âm đầu dò',             slots: 2, minDuration: 10, maxDuration: 20 },
  { id: 'P104', name: 'Khám hiếm muộn nữ',          slots: 2, minDuration: 15, maxDuration: 25 },
  { id: 'P105', name: 'Nội tiết sinh sản',           slots: 2, minDuration: 10, maxDuration: 20 },
  { id: 'P106', name: 'Siêu âm nang noãn',           slots: 2, minDuration: 10, maxDuration: 20 },
  { id: 'P107', name: 'Chọc hút noãn (OPU)',         slots: 2, minDuration: 30, maxDuration: 60 },
  { id: 'P108', name: 'Chuyển phôi (ET)',             slots: 2, minDuration: 20, maxDuration: 40 },
  { id: 'P109', name: 'Trữ đông phôi & tinh trùng', slots: 2, minDuration: 15, maxDuration: 30 },
  { id: 'P110', name: 'IUI',                         slots: 2, minDuration: 20, maxDuration: 35 },
  { id: 'P111', name: 'Vi phẫu nam khoa',            slots: 2, minDuration: 45, maxDuration: 90 },
  { id: 'P112', name: 'Tư vấn di truyền',            slots: 2, minDuration: 20, maxDuration: 40 },
  { id: 'P113', name: 'Xét nghiệm nội tiết',        slots: 2, minDuration: 10, maxDuration: 20 },
  { id: 'P114', name: 'Khám tổng quát',              slots: 3, minDuration: 10, maxDuration: 20 }
];

module.exports = {
  PORT,
  adminHtmlPath,
  dashboardHtmlPath,
  dbPath,
  ROOMS,
};