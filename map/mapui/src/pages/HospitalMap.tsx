import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Search, MapPin, Navigation, Map as MapIcon, X, ZoomIn, ZoomOut,
  Maximize, Check, ChevronsUpDown, Building2, Edit3, Copy, Eye,
  Users, RefreshCw, ChevronRight,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import floorplanImg from "@assets/image.png";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Backend URL ────────────────────────────────────────────────────────
const API_URL = (import.meta as any).env?.VITE_API_URL
  ?? ((typeof window !== "undefined" && window.location.port === "5173")
    ? "http://localhost:3000"
    : window.location.origin);

// ── Patient types ──────────────────────────────────────────────────────
type RoomStatus = { roomId: string; roomName: string; status: string };
type Patient = { id: string; name: string; requiredRooms: string[]; roomStatuses: RoomStatus[] };

// Room type for map
type RoomDef = { id: string; name: string; bbox: [number, number, number, number] };

// ────────────────────────────────────────────────────────────────────────
// MAP DATA — 14 phòng demo P101–P114 mapped to SVG bboxes
// ────────────────────────────────────────────────────────────────────────
const INITIAL_ROOMS = [
  // id phải khớp với ROOM_NODES keys & Dijkstra
  { id: "P101", name: "P101 Khám nam khoa",           bbox: [420, 250, 180, 90] as [number,number,number,number] },
  { id: "P102", name: "P102 XN tinh dịch đồ",         bbox: [420, 350, 180, 90] as [number,number,number,number] },
  { id: "P103", name: "P103 Siêu âm đầu dò",          bbox: [245, 250, 170, 90] as [number,number,number,number] },
  { id: "P104", name: "P104 Khám hiếm muộn nữ",       bbox: [245, 350, 170, 90] as [number,number,number,number] },
  { id: "P105", name: "P105 Nội tiết sinh sản",        bbox: [420, 450, 180, 90] as [number,number,number,number] },
  { id: "P106", name: "P106 Siêu âm nang noãn",       bbox: [245, 450, 170, 90] as [number,number,number,number] },
  { id: "P107", name: "P107 Chọc hút noãn (OPU)",     bbox: [670, 90, 160, 60]  as [number,number,number,number] },
  { id: "P108", name: "P108 Chuyển phôi (ET)",         bbox: [670, 215, 160, 65] as [number,number,number,number] },
  { id: "P109", name: "P109 Trữ đông phôi",            bbox: [670, 345, 150, 65] as [number,number,number,number] },
  { id: "P110", name: "P110 IUI",                      bbox: [10, 120, 110, 65]  as [number,number,number,number] },
  { id: "P111", name: "P111 Vi phẫu nam khoa",         bbox: [10, 10, 110, 60]   as [number,number,number,number] },
  { id: "P112", name: "P112 Tư vấn di truyền",         bbox: [85, 215, 115, 70]  as [number,number,number,number] },
  { id: "P113", name: "P113 XN nội tiết",              bbox: [670, 10, 160, 60]  as [number,number,number,number] },
  { id: "P114", name: "P114 Khám tổng quát",           bbox: [10, 540, 110, 60]  as [number,number,number,number] },
  // Utility rooms (non-clinical, kept for navigation)
  { id: "Quầy thu ngân",           name: "Quầy thu ngân",           bbox: [240, 165, 360, 70] as [number,number,number,number] },
  { id: "Sảnh chờ-1",              name: "Sảnh chờ-1",              bbox: [380, 10, 120, 60]  as [number,number,number,number] },
  { id: "Khu vực ghế ngồi (trái)", name: "Khu vực ghế ngồi (trái)", bbox: [240, 10, 110, 80]  as [number,number,number,number] },
  { id: "Khu vực ghế ngồi (phải)", name: "Khu vực ghế ngồi (phải)", bbox: [510, 10, 110, 80]  as [number,number,number,number] },
  { id: "Nhà thuốc",               name: "Nhà thuốc",               bbox: [125, 760, 90, 60]  as [number,number,number,number] },
  { id: "Quầy lễ tân",             name: "Quầy lễ tân",             bbox: [610, 740, 80, 80]  as [number,number,number,number] },
  { id: "Khu vực kỹ thuật-1",      name: "Khu vực kỹ thuật-1",      bbox: [700, 760, 150, 60] as [number,number,number,number] },
  { id: "Thang máy-1",             name: "Thang máy-1",             bbox: [750, 545, 140, 60] as [number,number,number,number] },
  { id: "Thang máy-2",             name: "Thang máy-2",             bbox: [355, 550, 100, 70] as [number,number,number,number] },
  { id: "Thang máy-3",             name: "Thang máy-3",             bbox: [245, 550, 100, 70] as [number,number,number,number] },
  { id: "Cầu thang bộ-1",          name: "Cầu thang bộ-1",          bbox: [10, 620, 110, 55]  as [number,number,number,number] },
  { id: "Cầu thang bộ-2",          name: "Cầu thang bộ-2",          bbox: [670, 625, 140, 55] as [number,number,number,number] },
  { id: "Khu vệ sinh-1",           name: "Khu vệ sinh-1",           bbox: [10, 320, 110, 75]  as [number,number,number,number] },
  { id: "Nhà vệ sinh-2",           name: "Nhà vệ sinh-2",           bbox: [840, 435, 110, 80] as [number,number,number,number] },
  { id: "Lối thoát hiểm-1",        name: "Lối thoát hiểm-1",        bbox: [10, 435, 100, 45]  as [number,number,number,number] },
  { id: "Lối thoát hiểm-2",        name: "Lối thoát hiểm-2",        bbox: [660, 435, 110, 45] as [number,number,number,number] },
  { id: "Khoa dược",               name: "Khoa dược",               bbox: [10, 760, 110, 60]  as [number,number,number,number] },
  { id: "Quầy thông tin",          name: "Quầy thông tin",          bbox: [460, 550, 120, 70] as [number,number,number,number] },
  { id: "Khu vực ghế ngồi (dưới)", name: "Khu vực ghế ngồi (dưới)", bbox: [245, 700, 340, 75] as [number,number,number,number] },
  { id: "Sảnh chính-2",            name: "Sảnh chính-2",            bbox: [310, 800, 270, 55] as [number,number,number,number] },
];

const INITIAL_NODES: Record<string, {x: number, y: number}> = {
  A1:  {x: 220, y: 50},  A2:  {x: 220, y: 115}, A3:  {x: 220, y: 168},
  A4:  {x: 430, y: 168}, A5:  {x: 640, y: 168},  A6:  {x: 640, y: 240},
  A7:  {x: 640, y: 295}, A8:  {x: 640, y: 340},  A9:  {x: 640, y: 395},
  A10: {x: 640, y: 445}, A11: {x: 640, y: 490},  A12: {x: 640, y: 540},
  A13: {x: 640, y: 575}, A14: {x: 640, y: 655},  A15: {x: 580, y: 605},
  A16: {x: 555, y: 655}, A17: {x: 510, y: 655},  A18: {x: 430, y: 655},
  A19: {x: 295, y: 655}, A20: {x: 590, y: 800},  A21: {x: 220, y: 800},
  A22: {x: 220, y: 760}, A23: {x: 220, y: 720},  A24: {x: 220, y: 675},
  A25: {x: 220, y: 645}, A26: {x: 220, y: 610},  A27: {x: 220, y: 575},
  A28: {x: 220, y: 540}, A29: {x: 220, y: 490},  A30: {x: 220, y: 445},
  A31: {x: 220, y: 395}, A32: {x: 220, y: 340},  A33: {x: 220, y: 295},
  A34: {x: 220, y: 240}, A35: {x: 175, y: 115},  A36: {x: 175, y: 65},
};

const EDGES: [string, string][] = [
  ["A36","A35"],["A35","A2"],["A1","A5"],
  ["A2","A3"],["A3","A4"],["A6","A33"],
  ["A3","A34"],["A4","A6"],["A33","A5"],["A32","A31"],
  ["A31","A30"],["A30","A29"],["A29","A28"],["A28","A27"],
  ["A27","A26"],["A26","A25"],["A25","A24"],["A24","A23"],
  ["A23","A22"],["A22","A21"],
  ["A6","A7"],["A7","A8"],["A8","A9"],
  ["A9","A10"],["A10","A11"],["A11","A12"],["A12","A13"],["A13","A15"],
  ["A14","A15"],["A15","A16"],["A16","A17"],["A18","A19"],
  ["A19","A25"],["A18","A16"],
  ["A17","A20"],["A21","A20"],["A32","A34"],
];

// Maps P101–P114 (and utility rooms) to their nearest corridor nodes
const ROOM_NODES: Record<string, string[]> = {
  "P101":                         ["A8"],   // Khám nam khoa (trung tâm)
  "P102":                         ["A10"],         // XN tinh dịch đồ
  "P103":                         ["A32"],         // Siêu âm đầu dò (trái)
  "P104":                         ["A30"],         // Khám hiếm muộn nữ (trái)
  "P105":                         ["A12"],         // Nội tiết sinh sản
  "P106":                         ["A28"],         // Siêu âm nang noãn (trái)
  "P107":                         ["A5"],   // OPU (phải trên)
  "P108":                         ["A7"],          // ET (phải giữa)
  "P109":                         ["A9"],          // Trữ đông phôi (phải)
  "P110":                         ["A2"],          // IUI (trái trên)
  "P111":                         ["A36"],         // Vi phẫu nam khoa (trái trên cùng)
  "P112":                         ["A34"],         // Tư vấn di truyền (trái)
  "P113":                         ["A1"],          // XN nội tiết (phải trên cùng)
  "P114":                         ["A26"],         // Khám tổng quát (trái)
  "Quầy thu ngân":                ["A4"],
  "Sảnh chờ-1":                   ["A4"],
  "Khu vực ghế ngồi (trái)":      [],
  "Khu vực ghế ngồi (phải)":      [],
  "Nhà thuốc":                    ["A22"],
  "Quầy lễ tân":                  ["A17"],
  "Khu vực kỹ thuật-1":           [],
  "Thang máy-1":                  ["A13"],
  "Thang máy-2":                  ["A18"],
  "Thang máy-3":                  ["A19"],
  "Cầu thang bộ-1":               ["A24"],
  "Cầu thang bộ-2":               ["A14"],
  "Khu vệ sinh-1":                ["A31"],
  "Nhà vệ sinh-2":                ["A11"],
  "Lối thoát hiểm-1":             ["A29"],
  "Lối thoát hiểm-2":             ["A11"],
  "Khoa dược":                    [],
  "Quầy thông tin":               [],
  "Khu vực ghế ngồi (dưới)":      [],
  "Sảnh chính-2":                 ["A20"],
};

// ── Dijkstra single-pair ───────────────────────────────────────────────
function dijkstra(
  startId: string, endId: string,
  rooms: RoomDef[],
  nodes: typeof INITIAL_NODES
): { path: string[]; distance: number; error: string | null } {
  if (!startId || !endId || startId === endId) {
    return { path: [], distance: 0, error: null };
  }

  const graph: Record<string, Record<string, number>> = {};
  const addEdge = (u: string, v: string, w: number) => {
    if (!graph[u]) graph[u] = {};
    if (!graph[v]) graph[v] = {};
    graph[u][v] = w;
    graph[v][u] = w;
  };

  EDGES.forEach(([u, v]) => {
    if (nodes[u] && nodes[v]) {
      addEdge(u, v, Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y));
    }
  });

  Object.entries(ROOM_NODES).forEach(([roomId, nodeIds]) => {
    const room = rooms.find((r: RoomDef) => r.id === roomId);
    if (!room) return;

    const cx = room.bbox[0] + room.bbox[2] / 2;
    const cy = room.bbox[1] + room.bbox[3] / 2;

    nodeIds.forEach(nodeId => {
      if (nodes[nodeId]) {
        addEdge(roomId, nodeId, Math.hypot(cx - nodes[nodeId].x, cy - nodes[nodeId].y) * 0.5);
      }
    });
  });

  if (!graph[startId] || !graph[endId]) {
    return { path: [], distance: 0, error: "Phòng này chưa có kết nối trên bản đồ." };
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>(Object.keys(graph));

  for (const n of unvisited) {
    dist[n] = Infinity;
    prev[n] = null;
  }

  dist[startId] = 0;

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minD = Infinity;

    for (const n of unvisited) {
      if (dist[n] < minD) {
        minD = dist[n];
        curr = n;
      }
    }

    if (curr === null || curr === endId) break;

    unvisited.delete(curr);

    for (const nb in graph[curr]) {
      const alt = dist[curr] + graph[curr][nb];
      if (alt < dist[nb]) {
        dist[nb] = alt;
        prev[nb] = curr;
      }
    }
  }

  if (dist[endId] === Infinity) {
    return { path: [], distance: 0, error: "Không tìm thấy đường đi." };
  }

  const path: string[] = [];
  let cur: string | null = endId;

  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return { path, distance: dist[endId], error: null };
}

// ── Orthogonal route helpers ──────────────────────────────────────────
// Mọi đường hiển thị trên bản đồ chỉ đi ngang/dọc 90°, không có đường chéo.
type Point = { x: number; y: number };

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function pushPoint(points: Point[], point: Point) {
  if (!points.length || !samePoint(points[points.length - 1], point)) {
    points.push(point);
  }
}

// Nối 2 điểm bằng các đoạn ngang/dọc.
// Nếu hai điểm đã cùng hàng/cột thì dùng một đoạn thẳng.
function orthogonalConnector(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  pushPoint(points, from);

  if (samePoint(from, to)) return points;

  if (Math.abs(from.x - to.x) < 0.5) {
    pushPoint(points, to);
    return points;
  }

  if (Math.abs(from.y - to.y) < 0.5) {
    pushPoint(points, to);
    return points;
  }

  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  if (dx >= dy) {
    const midX = Math.round((from.x + to.x) / 2);
    pushPoint(points, { x: midX, y: from.y });
    pushPoint(points, { x: midX, y: to.y });
  } else {
    const midY = Math.round((from.y + to.y) / 2);
    pushPoint(points, { x: from.x, y: midY });
    pushPoint(points, { x: to.x, y: midY });
  }

  pushPoint(points, to);
  return points;
}

function pointsToSvgPath(points: Point[]) {
  if (!points.length) return "";

  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

// Điểm cửa nằm trên cạnh phòng gần node hành lang nhất.
// Nhờ đó đường không còn đi từ tâm phòng ra node.
function getRoomDoorPoint(room: RoomDef, node: Point): Point {
  const [x, y, w, h] = room.bbox;

  const candidates: Point[] = [
    { x: Math.max(x, Math.min(x + w, node.x)), y },
    { x: Math.max(x, Math.min(x + w, node.x)), y: y + h },
    { x, y: Math.max(y, Math.min(y + h, node.y)) },
    { x: x + w, y: Math.max(y, Math.min(y + h, node.y)) },
  ];

  return candidates.reduce((best, candidate) => {
    const bestD = Math.hypot(best.x - node.x, best.y - node.y);
    const currentD = Math.hypot(candidate.x - node.x, candidate.y - node.y);
    return currentD < bestD ? candidate : best;
  });
}

// Chuyển path Dijkstra thành một đường SVG vuông góc liên tục.
function buildOrthogonalRoutePoints(
  path: string[],
  rooms: RoomDef[],
  nodes: typeof INITIAL_NODES
): Point[] {
  if (path.length < 2) return [];

  const points: Point[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];

    const fromNode = nodes[fromId];
    const toNode = nodes[toId];

    const fromRoom = rooms.find(r => r.id === fromId);
    const toRoom = rooms.find(r => r.id === toId);

    let from: Point | null = fromNode || null;
    let to: Point | null = toNode || null;

    if (fromRoom && toNode) {
      from = getRoomDoorPoint(fromRoom, toNode);
    }

    if (toRoom && fromNode) {
      to = getRoomDoorPoint(toRoom, fromNode);
    }

    if (!from && fromRoom) {
      from = {
        x: fromRoom.bbox[0] + fromRoom.bbox[2] / 2,
        y: fromRoom.bbox[1] + fromRoom.bbox[3] / 2,
      };
    }

    if (!to && toRoom) {
      to = {
        x: toRoom.bbox[0] + toRoom.bbox[2] / 2,
        y: toRoom.bbox[1] + toRoom.bbox[3] / 2,
      };
    }

    if (!from || !to) continue;

    orthogonalConnector(from, to).forEach(p => pushPoint(points, p));
  }

  return points;
}

function getRoutePathD(
  path: string[],
  rooms: RoomDef[],
  nodes: typeof INITIAL_NODES
) {
  return pointsToSvgPath(buildOrthogonalRoutePoints(path, rooms, nodes));
}

// ── Multi-stop route: chain P1→P2→P3→... ─────────────────────────────
function buildMultiStopPath(stops: string[], rooms: RoomDef[], nodes: typeof INITIAL_NODES) {
  if (stops.length === 0) return { segments: [] as { from: string; to: string; path: string[] }[], totalDistance: 0, error: null as string | null };
  if (stops.length === 1) return { segments: [{ from: stops[0], to: stops[0], path: [stops[0]] }], totalDistance: 0, error: null };

  const segments: { from: string; to: string; path: string[] }[] = [];
  let totalDistance = 0;
  let firstError: string | null = null;

  for (let i = 0; i < stops.length - 1; i++) {
    const r = dijkstra(stops[i], stops[i + 1], rooms, nodes);
    if (r.error && !firstError) firstError = r.error;
    segments.push({ from: stops[i], to: stops[i + 1], path: r.path });
    totalDistance += r.distance;
  }
  return { segments, totalDistance, error: firstError };
}

// Flatten multi-stop segments into one continuous set of highlighted nodes
function flattenSegments(segments: { path: string[] }[]): Set<string> {
  const s = new Set<string>();
  segments.forEach(seg => seg.path.forEach(n => s.add(n)));
  return s;
}

// Get ordered pairs in path for edge highlighting
function getPathEdgePairs(path: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) s.add(`${path[i]}|${path[i+1]}`);
  return s;
}

function getAllPathEdgePairs(segments: { path: string[] }[]): Set<string> {
  const s = new Set<string>();
  segments.forEach(seg => {
    for (let i = 0; i < seg.path.length - 1; i++) {
      s.add(`${seg.path[i]}|${seg.path[i+1]}`);
    }
  });
  return s;
}

// ── Combobox ──────────────────────────────────────────────────────────
function Combobox({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    options.filter(o => o.toLowerCase().includes(search.toLowerCase())), [options, search]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent/50 transition-colors">
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content sideOffset={4} className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          <div className="flex flex-col">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1">
              {filtered.length === 0 && <div className="py-6 text-center text-sm">Không tìm thấy phòng.</div>}
              {filtered.map(opt => (
                <div key={opt}
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100 text-primary" : "opacity-0")} />
                  {opt}
                </div>
              ))}
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ── Status badge ──────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  none: "Chưa khám", checkin: "Chờ vào", progress: "Đang khám",
  waiting: "Chờ KQ", done: "Xong",
};
const STATUS_COLORS: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  checkin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  progress: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  waiting: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap", STATUS_COLORS[status] || STATUS_COLORS.none)}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function HospitalMap() {
  // Tab: "route" (tìm đường thủ công) | "patient" (theo bệnh nhân)
  const [tab, setTab] = useState<"route" | "patient">("patient");

  // Manual route state
  const [startRoom, setStartRoom] = useState("");
  const [endRoom, setEndRoom] = useState("");
  const [manualPath, setManualPath] = useState<{ path: string[]; distance: number; error: string | null } | null>(null);

  // Patient mode state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientRouteResult, setPatientRouteResult] = useState<{
    segments: { from: string; to: string; path: string[] }[];
    totalDistance: number;
    error: string | null;
  } | null>(null);

  // Pan/zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [floorOpacity, setFloorOpacity] = useState(0.15);
  const [rooms, setRooms] = useState<RoomDef[]>(() => {
    try { const s = localStorage.getItem('hmap-rooms-v2'); if (s) return JSON.parse(s) as RoomDef[]; } catch {}
    return INITIAL_ROOMS.map(r => ({ ...r, bbox: [...r.bbox] as [number,number,number,number] }));
  });
  const [nodes, setNodes] = useState<Record<string, {x: number, y: number}>>(() => {
    try { const s = localStorage.getItem('hmap-nodes-v2'); if (s) return JSON.parse(s); } catch {}
    return { ...INITIAL_NODES };
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => { localStorage.setItem('hmap-rooms-v2', JSON.stringify(rooms)); }, [rooms]);
  useEffect(() => { localStorage.setItem('hmap-nodes-v2', JSON.stringify(nodes)); }, [nodes]);

  // Drag ref for edit mode
  const dragRef = useRef<{
    type: 'room' | 'node' | 'room-resize';
    id: string; startSvgX: number; startSvgY: number;
    origX: number; origY: number; origW?: number; origH?: number;
  } | null>(null);

  const allRoomNames = useMemo(() => rooms.map((r: RoomDef) => r.name).sort((a: string, b: string) => a.localeCompare(b,'vi')), [rooms]);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  // Window drag listeners
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const svgPos = clientToSvg(e.clientX, e.clientY);
      const dx = svgPos.x - dragRef.current.startSvgX;
      const dy = svgPos.y - dragRef.current.startSvgY;
      const { type, id, origX, origY, origW, origH } = dragRef.current;
      if (type === 'room') {
        setRooms((prev: RoomDef[]) => prev.map((r: RoomDef) => r.id === id
          ? { ...r, bbox: [Math.round(origX+dx), Math.round(origY+dy), r.bbox[2], r.bbox[3]] as [number,number,number,number] }
          : r));
      } else if (type === 'room-resize') {
        setRooms((prev: RoomDef[]) => prev.map((r: RoomDef) => r.id === id
          ? { ...r, bbox: [r.bbox[0], r.bbox[1], Math.max(20, Math.round(origW!+dx)), Math.max(20, Math.round(origH!+dy))] as [number,number,number,number] }
          : r));
      } else if (type === 'node') {
        setNodes(prev => ({ ...prev, [id]: { x: Math.round(origX+dx), y: Math.round(origY+dy) } }));
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [clientToSvg]);

  const handleRoomPointerDown = useCallback((e: React.PointerEvent, roomId: string) => {
    if (!editMode) return;
    e.stopPropagation(); e.preventDefault();
    const svgPos = clientToSvg(e.clientX, e.clientY);
    const room = rooms.find((r: RoomDef) => r.id === roomId)!;
    dragRef.current = { type:'room', id:roomId, startSvgX:svgPos.x, startSvgY:svgPos.y, origX:room.bbox[0], origY:room.bbox[1] };
  }, [editMode, rooms, clientToSvg]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent, roomId: string) => {
    if (!editMode) return;
    e.stopPropagation(); e.preventDefault();
    const svgPos = clientToSvg(e.clientX, e.clientY);
    const room = rooms.find((r: RoomDef) => r.id === roomId)!;
    dragRef.current = { type:'room-resize', id:roomId, startSvgX:svgPos.x, startSvgY:svgPos.y, origX:room.bbox[0], origY:room.bbox[1], origW:room.bbox[2], origH:room.bbox[3] };
  }, [editMode, rooms, clientToSvg]);

  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    if (!editMode) return;
    e.stopPropagation(); e.preventDefault();
    const svgPos = clientToSvg(e.clientX, e.clientY);
    const node = nodes[nodeId];
    dragRef.current = { type:'node', id:nodeId, startSvgX:svgPos.x, startSvgY:svgPos.y, origX:node.x, origY:node.y };
  }, [editMode, nodes, clientToSvg]);

  const handleCopyJson = useCallback(() => {
    const roomsJson = rooms.map((r: RoomDef) => `  { id: "${r.id}", name: "${r.name}", bbox: [${r.bbox.join(', ')}] }`).join(',\n');
    const nodesJson = Object.entries(nodes).map(([k,v]) => `  ${k}: {x:${v.x}, y:${v.y}}`).join(',\n');
    navigator.clipboard.writeText(`const ROOMS = [\n${roomsJson}\n];\n\nconst NODES = {\n${nodesJson}\n};`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [rooms, nodes]);

  const handleReset = useCallback(() => {
    if (!confirm('Đặt lại về dữ liệu gốc?')) return;
    localStorage.removeItem('hmap-rooms-v2'); localStorage.removeItem('hmap-nodes-v2');
    setRooms(INITIAL_ROOMS.map(r => ({ ...r, bbox: [...r.bbox] as [number,number,number,number] })));
    setNodes({ ...INITIAL_NODES });
  }, []);

  // Pan/zoom handlers
  const handlePanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editMode) return;
    setIsPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };
  const handlePanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editMode || !isPanning) return;
    setTransform(prev => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
  };
  const handlePanPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const newScale = Math.min(Math.max(0.3, transform.scale * (1 + -e.deltaY * 0.002)), 4);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const dx = (mx - transform.x) * (newScale / transform.scale - 1);
      const dy = (my - transform.y) * (newScale / transform.scale - 1);
      setTransform(t => ({ x: t.x-dx, y: t.y-dy, scale: newScale }));
    }
  };

  // ── Fetch patients from backend ──────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const res = await fetch(`${API_URL}/api/patients-live`);
      const json = await res.json();
      if (json.status === 'success') setPatients(json.data);
    } catch (e) {
      console.warn('Không thể tải bệnh nhân:', e);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  // ── Auto recompute route khi patients data thay đổi ──────────────────
  useEffect(() => {
    if (!selectedPatient) return;
    const updated = patients.find(p => p.id === selectedPatient.id);
    if (updated) handleSelectPatient(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  // ── Select patient → compute multi-stop route ──────────────────────
  const handleSelectPatient = useCallback((p: Patient) => {
    setSelectedPatient(p);
    setManualPath(null);

    // Giữ thứ tự gốc theo requiredRooms (không sort lộn)
    const ordered = p.requiredRooms
      .map(id => p.roomStatuses.find(rs => rs.roomId === id) ?? { roomId: id, roomName: id, status: 'none' });

    // Tìm index đầu tiên của phòng chưa done
    const firstPendingIdx = ordered.findIndex(rs => rs.status !== 'done');

    // Tất cả đã xong
    if (firstPendingIdx === -1) {
      setPatientRouteResult({ segments: [], totalDistance: 0, error: "Bệnh nhân đã hoàn thành tất cả các phòng." });
      return;
    }

    const firstPending = ordered[firstPendingIdx];
    const isArrived = firstPending.status === 'checkin' || firstPending.status === 'progress' || firstPending.status === 'waiting';

    // Chỉ hiển thị đúng 1 chặng:
    // - BN chưa checkin phòng tiếp → vẽ đường từ phòng done liền trước đến phòng tiếp theo
    // - BN đã checkin/progress/waiting → vẽ đường từ phòng đó đến phòng kế tiếp (nếu có)
    let fromId: string;
    let toId: string | null = null;

    if (!isArrived && firstPendingIdx > 0) {
      // Chưa đến: from = phòng done trước, to = phòng pending đầu tiên
      fromId = ordered[firstPendingIdx - 1].roomId;
      toId = firstPending.roomId;
    } else {
      // Đang ở phòng này: from = phòng hiện tại, to = phòng kế tiếp chưa done
      fromId = firstPending.roomId;
      const nextPending = ordered.slice(firstPendingIdx + 1).find(rs => rs.status !== 'done');
      toId = nextPending?.roomId ?? null;
    }

    if (!toId) {
      // Chỉ còn 1 phòng cuối, không có chặng tiếp
      setPatientRouteResult({ segments: [{ from: fromId, to: fromId, path: [fromId] }], totalDistance: 0, error: null });
      return;
    }

    const result = buildMultiStopPath([fromId, toId], rooms, nodes);
    setPatientRouteResult(result);
  }, [rooms, nodes]);

  // ── Manual route ──────────────────────────────────────────────────
  const handleFindRoute = () => {
    if (!startRoom || !endRoom) return;
    const startId = rooms.find((r: RoomDef) => r.name === startRoom)?.id || startRoom;
    const endId   = rooms.find((r: RoomDef) => r.name === endRoom)?.id || endRoom;
    setManualPath(dijkstra(startId, endId, rooms, nodes));
    setSelectedPatient(null); setPatientRouteResult(null);
  };
  const handleClear = () => {
    setStartRoom(""); setEndRoom(""); setManualPath(null);
    setSelectedPatient(null); setPatientRouteResult(null);
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  // ── Compute highlighted route ───────────────────────────────────────
  const activeSegments = patientRouteResult?.segments ?? [];

  const activeRoutePaths = useMemo(() => {
    if (tab === 'patient') {
      return activeSegments
        .filter(seg => seg.path.length > 1)
        .map((seg, idx) => ({
          ...seg,
          index: idx,
          d: getRoutePathD(seg.path, rooms, nodes),
        }))
        .filter(seg => Boolean(seg.d));
    }

    if (tab === 'route' && manualPath?.path?.length > 1) {
      return [{
        from: manualPath.path[0],
        to: manualPath.path[manualPath.path.length - 1],
        path: manualPath.path,
        index: 0,
        d: getRoutePathD(manualPath.path, rooms, nodes),
      }];
    }

    return [];
  }, [tab, activeSegments, manualPath, rooms, nodes]);

  const allHighlightedNodes = useMemo(() => {
    if (tab === 'patient' && activeSegments.length > 0) {
      return flattenSegments(activeSegments);
    }

    if (tab === 'route' && manualPath?.path) {
      return new Set(manualPath.path);
    }

    return new Set<string>();
  }, [tab, activeSegments, manualPath]);

  const hasRoute = activeRoutePaths.length > 0;

  const s1Highlighted =
    hasRoute &&
    allHighlightedNodes.has("Sảnh chờ-1") &&
    allHighlightedNodes.has("A4");

  const segmentColors = [
    "#06b6d4", // cyan-500
    "#3b82f6", // blue-500
    "#8b5cf6", // violet-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ec4899", // pink-500
  ];

  const nodeSegmentColor = useMemo(() => {
    const m: Record<string, string> = {};
    activeSegments.forEach((seg, idx) => {
      const color = segmentColors[idx % segmentColors.length];
      seg.path.forEach(n => {
        if (!m[n]) m[n] = color;
      });
    });
    return m;
  }, [activeSegments]);

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row overflow-hidden bg-background font-sans text-foreground">

      {/* ── LEFT: SVG MAP ── */}
      <div
        className={cn("flex-1 relative overflow-hidden bg-[#fafafa] dark:bg-[#0a0a0a]", !editMode && "cursor-grab active:cursor-grabbing")}
        ref={containerRef}
        onPointerDown={handlePanPointerDown} onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerUp} onPointerLeave={handlePanPointerUp}
        onWheel={handleWheel} style={{ touchAction: 'none' }}
      >
        <div className="w-full h-full origin-top-left will-change-transform"
          style={{ transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})` }}>
          <svg ref={svgRef} viewBox="0 0 1000 870" width="1000" height="870" className="max-w-none block">
            <image href={floorplanImg} width="1000" height="870" opacity={floorOpacity} className="pointer-events-none" />

            {/* Corridor network — tất cả đều là đường 90° */}
            <g pointerEvents="none">
              {EDGES.map(([u, v]) => {
                const from = nodes[u];
                const to = nodes[v];
                if (!from || !to) return null;

                const d = pointsToSvgPath(orthogonalConnector(from, to));

                return (
                  <path
                    key={`corridor-${u}-${v}`}
                    d={d}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={hasRoute ? 0.12 : 0.30}
                  />
                );
              })}
            </g>

            {/* ĐƯỜNG A → B — một tuyến liên tục */}
            {hasRoute && (
              <g pointerEvents="none">
                {activeRoutePaths.map((route, idx) => {
                  const color = tab === 'patient'
                    ? segmentColors[route.index % segmentColors.length]
                    : "#06b6d4";

                  return (
                    <g key={`route-${route.from}-${route.to}-${idx}`}>
                      {/* Layer 1: Glow ngoài — nhấp nháy nhẹ */}
                      <path d={route.d} fill="none" stroke={color} strokeWidth={18}
                        strokeLinecap="round" strokeLinejoin="round" className="path-glow" />
                      {/* Layer 2: Nền đường liền */}
                      <path d={route.d} fill="none" stroke={color} strokeWidth={7}
                        strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
                      {/* Layer 3: Nét đứt chảy — hiệu ứng dòng chảy chính */}
                      <path d={route.d} fill="none" stroke={color} strokeWidth={7}
                        strokeLinecap="round" strokeLinejoin="round" className="path-flow" />
                      {/* Layer 4: Shine */}
                      <path d={route.d} fill="none" stroke="white" strokeWidth={3.5}
                        strokeLinecap="round" strokeLinejoin="round" className="path-shine" />
                    </g>
                  );
                })}
              </g>
            )}

            {/* Sảnh chờ-1 stub */}
            {(!hasRoute || s1Highlighted) && (
              <path
                d={`M ${nodes.A4?.x ?? 0} 70 V ${nodes.A4?.y ?? 0}`}
                fill="none"
                stroke="#22c55e"
                strokeWidth={4}
                strokeLinecap="round"
                opacity={s1Highlighted ? 0.5 : 0.3}
              />
            )}

            {/* Phòng → cửa → hành lang.
                Không nối từ tâm phòng nữa. */}
            <g pointerEvents="none">
              {Object.entries(ROOM_NODES).flatMap(([roomId, nodeIds]) =>
                nodeIds.map(nodeId => {
                  if (roomId === "Sảnh chờ-1" && nodeId === "A4") return null;

                  const room = rooms.find((r: RoomDef) => r.id === roomId);
                  const node = nodes[nodeId];

                  if (!room || !node) return null;

                  const door = getRoomDoorPoint(room, node);
                  const d = pointsToSvgPath(orthogonalConnector(door, node));

                  const isStart =
                    tab === 'route' &&
                    rooms.find((r: RoomDef) => r.name === startRoom)?.id === roomId;

                  const isEnd =
                    tab === 'route' &&
                    rooms.find((r: RoomDef) => r.name === endRoom)?.id === roomId;

                  const isActiveRoom =
                    allHighlightedNodes.has(roomId) &&
                    allHighlightedNodes.has(nodeId);

                  return (
                    <g key={`door-${roomId}-${nodeId}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke={isActiveRoom ? "#06b6d4" : "#22c55e"}
                        strokeWidth={isActiveRoom ? 4 : 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={isActiveRoom ? 0.7 : 0.10}
                      />
                    </g>
                  );
                })
              )}
            </g>

            {/* Rooms */}
            <g>
              {rooms.map(({ id, name, bbox: [x, y, w, h] }: RoomDef) => {
                const isStart = tab === 'route' && rooms.find((r: RoomDef) => r.name === startRoom)?.id === id;
                const isEnd   = tab === 'route' && rooms.find((r: RoomDef) => r.name === endRoom)?.id === id;
                const isInPath = allHighlightedNodes.has(id);
                const isStop   = tab === 'patient' && selectedPatient?.requiredRooms.includes(id);
                const segColor = nodeSegmentColor[id];

                // Style phòng start/end — nổi bật cyan
                const roomStyle: React.CSSProperties =
                  isStart || isEnd
                    ? { fill: '#06b6d4' + '33', stroke: '#06b6d4', strokeWidth: 2.5 }
                    : isInPath && segColor
                    ? { fill: segColor + '22', stroke: segColor + '66' }
                    : {};

                return (
                  <g key={id} style={editMode ? { cursor:'move' } : {}}>
                    {/* Pulse ring cho start/end khi tìm được đường */}
                    {(isStart || isEnd) && hasRoute && (
                      <rect
                        x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={10}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        opacity={0.5}
                        className="animate-pulse"
                      />
                    )}
                    <rect x={x} y={y} width={w} height={h} rx={6}
                      className={cn("transition-colors duration-300",
                        !(isStart || isEnd) && !isInPath && (
                          isStop ? "fill-blue-500/10 stroke-blue-400/40 stroke-border" : "fill-card/90 hover:fill-accent stroke-border"
                        )
                      )}
                      style={roomStyle}
                      onPointerDown={editMode ? e => handleRoomPointerDown(e, id) : undefined}
                    />
                    <text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="middle"
                      className={cn("pointer-events-none",
                        (isStart || isEnd) ? "fill-foreground font-bold" : "fill-foreground/80 font-medium"
                      )} style={{ fontSize: w < 80 ? '8px' : '10px' }}>
                      {name.length > 22 ? name.slice(0,20)+'…' : name}
                    </text>
                    {/* Label A / B trên phòng */}
                    {(isStart || isEnd) && hasRoute && (
                      <g pointerEvents="none">
                        <circle cx={x + w - 10} cy={y + 10} r={9} fill="#06b6d4" stroke="white" strokeWidth={2} />
                        <text x={x + w - 10} y={y + 10} textAnchor="middle" dominantBaseline="middle"
                          fontSize="8" fontWeight="800" fill="white">
                          {isStart ? 'A' : 'B'}
                        </text>
                      </g>
                    )}
                    {editMode && (
                      <rect x={x+w-8} y={y+h-8} width={10} height={10} rx={2}
                        fill="#3b82f6" opacity={0.8} style={{ cursor:'se-resize' }}
                        onPointerDown={e => handleResizePointerDown(e, id)} />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Nodes — chỉ hiện trong edit mode, ẩn hết khi có route */}
            <g>
              {Object.entries(nodes).map(([id, pos]) => {
                if (!editMode) return null; // ẩn toàn bộ node khi không edit
                return (
                  <g key={id} className="group">
                    <circle cx={pos.x} cy={pos.y} r={7}
                      fill="#f97316"
                      stroke="#ea580c"
                      strokeWidth={1.5} className="transition-all"
                      style={{ cursor:'move' }}
                      onPointerDown={e => handleNodePointerDown(e, id)}
                    />
                    <text x={pos.x} y={pos.y-10} fontSize="9" textAnchor="middle"
                      className="fill-foreground font-bold pointer-events-none opacity-100">
                      {id}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Stop markers for patient route */}
            {tab === 'patient' && selectedPatient && activeSegments.map((seg, idx) => {
              const stopId = seg.from;
              const r = rooms.find((r: RoomDef) => r.id === stopId);
              if (!r) return null;
              const cx = r.bbox[0]+r.bbox[2]/2, cy = r.bbox[1]+r.bbox[3]/2;
              const color = segmentColors[idx % segmentColors.length];
              return (
                <g key={`marker-${stopId}-${idx}`}>
                  <circle cx={cx} cy={cy} r={24} fill={color} opacity={0.15} className="animate-pulse pointer-events-none" />
                  <circle cx={cx} cy={cy} r={8} fill={color} className="pointer-events-none" />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill="white" className="pointer-events-none">{idx+1}</text>
                </g>
              );
            })}

            {/* Manual route: A/B đã được render trực tiếp trên phòng ở block Rooms ở trên */}
          </svg>
        </div>

        {/* Map controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 bg-card/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-border z-10">
          <button onClick={() => setTransform(t => ({...t, scale:t.scale*1.2}))} className="p-2 hover:bg-accent rounded-md transition-colors" title="Phóng to"><ZoomIn className="w-5 h-5" /></button>
          <button onClick={() => setTransform(t => ({...t, scale:t.scale/1.2}))} className="p-2 hover:bg-accent rounded-md transition-colors" title="Thu nhỏ"><ZoomOut className="w-5 h-5" /></button>
          <div className="h-px w-full bg-border my-1" />
          <button onClick={() => setTransform({x:0,y:0,scale:1})} className="p-2 hover:bg-accent rounded-md transition-colors" title="Khôi phục"><Maximize className="w-5 h-5" /></button>
        </div>

        {/* Edit toolbar */}
        {editMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-border z-10">
            <span className="text-xs text-muted-foreground mr-1">Nền:</span>
            <input type="range" min={0.05} max={1} step={0.05} value={floorOpacity} onChange={e => setFloorOpacity(Number(e.target.value))} className="w-24 accent-primary" />
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={handleCopyJson} className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors", copied ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
              <Copy className="w-3.5 h-3.5" />{copied ? "Đã copy!" : "Copy JSON"}
            </button>
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border border-border bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="h-[50dvh] md:h-[100dvh] w-full md:w-[420px] bg-card border-t md:border-t-0 md:border-l border-border flex flex-col z-20 shadow-2xl shrink-0">

        {/* Header */}
        <div className="p-5 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                <MapIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Bản đồ Bệnh viện</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Chỉ đường theo bệnh nhân</p>
              </div>
            </div>
            <button onClick={() => setEditMode(e => !e)}
              className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                editMode ? "bg-orange-500 text-white border-orange-500" : "bg-background text-muted-foreground border-border hover:bg-accent")}>
              {editMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {editMode ? "Xem" : "Sửa"}
            </button>
          </div>
          {editMode && (
            <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400 space-y-1">
              <p className="font-semibold">Chế độ chỉnh sửa đang bật</p>
              <p>• Kéo phòng để di chuyển · Kéo góc xanh để resize · Kéo node cam</p>
              <p>• Nhấn <b>Copy JSON</b> ở thanh dưới màn hình để lưu</p>
            </div>
          )}
          {/* Tabs */}
          <div className="mt-4 flex gap-1 bg-muted/50 p-1 rounded-lg">
            <button onClick={() => setTab('patient')}
              className={cn("flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors",
                tab === 'patient' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Users className="w-3.5 h-3.5" /> Theo Bệnh Nhân
            </button>
            <button onClick={() => setTab('route')}
              className={cn("flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors",
                tab === 'route' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Navigation className="w-3.5 h-3.5" /> Tìm Đường
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── TAB: PATIENT ── */}
          {tab === 'patient' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {patients.length} bệnh nhân hôm nay
                </span>
                <button onClick={fetchPatients} disabled={loadingPatients}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
                  <RefreshCw className={cn("w-3 h-3", loadingPatients && "animate-spin")} />
                  Làm mới
                </button>
              </div>

              {patients.length === 0 && !loadingPatients && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Chưa có bệnh nhân hôm nay.<br/>
                  <span className="text-xs">Hãy nạp danh sách trong Dashboard.</span>
                </div>
              )}

              {patients.map(p => {
                const isSelected = selectedPatient?.id === p.id;
                const doneCount = p.roomStatuses.filter(rs => rs.status === 'done').length;
                const total = p.roomStatuses.length;
                return (
                  <div key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className={cn(
                      "rounded-xl border p-3 cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                    )}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-bold text-foreground">{p.id}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{doneCount}/{total}</span>
                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform text-muted-foreground", isSelected && "text-primary rotate-90")} />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${total > 0 ? (doneCount/total)*100 : 0}%` }} />
                    </div>
                    {/* Room chips */}
                    <div className="flex flex-wrap gap-1">
                      {p.roomStatuses.map(rs => (
                        <div key={rs.roomId} className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-muted-foreground">{rs.roomId}</span>
                          <StatusBadge status={rs.status} />
                        </div>
                      ))}
                    </div>
                    {/* Route result for selected patient */}
                    {isSelected && patientRouteResult && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        {patientRouteResult.error && (
                          <p className="text-xs text-destructive">{patientRouteResult.error}</p>
                        )}
                        {patientRouteResult.segments.length > 0 && !patientRouteResult.error && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-foreground">
                              Lộ trình gợi ý · ~{(patientRouteResult.totalDistance * 0.1).toFixed(0)}m
                            </p>
                            {patientRouteResult.segments.map((seg, idx) => (
                              seg.from !== seg.to && (
                                <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ background: segmentColors[idx % segmentColors.length] }}>{idx + 1}</span>
                                  <span className="font-medium">{seg.from}</span>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="font-medium">{seg.to}</span>
                                </div>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TAB: MANUAL ROUTE ── */}
          {tab === 'route' && (
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Điểm bắt đầu
                </label>
                <Combobox options={allRoomNames} value={startRoom}
                  onChange={v => { setStartRoom(v); setManualPath(null); }} placeholder="Chọn phòng..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-destructive" /> Điểm đích
                </label>
                <Combobox options={allRoomNames} value={endRoom}
                  onChange={v => { setEndRoom(v); setManualPath(null); }} placeholder="Chọn phòng..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button className="flex-1 bg-primary text-primary-foreground h-11 rounded-md font-medium hover:bg-primary/90 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  onClick={handleFindRoute} disabled={!startRoom || !endRoom}>
                  <Search className="w-4 h-4" /> Tìm đường
                </button>
                <button className="w-11 h-11 border border-input bg-background flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
                  onClick={handleClear} title="Xóa"><X className="w-4 h-4" /></button>
              </div>

              {manualPath?.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0" />{manualPath.error}
                </div>
              )}

              {manualPath && manualPath.path.length > 0 && !manualPath.error && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">A</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">B</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Đường đi vuông góc 90°</span>
                    </div>
                    
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
                    <Navigation className="w-4 h-4 text-primary" /> Lộ trình · ~{(manualPath.distance * 0.1).toFixed(0)}m
                  </h3>
                  <div className="relative border-l-2 border-border/70 ml-3 pl-5 space-y-5 py-2">
                    {manualPath.path.map((step, idx) => {
                      const isRoom = rooms.some((r: RoomDef) => r.id === step);
                      const isStart = idx === 0, isEnd = idx === manualPath.path.length - 1;
                      return (
                        <div key={`${step}-${idx}`} className="relative">
                          <div className={cn("absolute -left-[33px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow-sm border-2 border-card",
                            isStart ? "bg-primary text-primary-foreground" : isEnd ? "bg-destructive text-destructive-foreground" : "bg-yellow-400 text-yellow-900")}>
                            {isStart || isEnd ? <Building2 className="w-2.5 h-2.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-yellow-900" />}
                          </div>
                          <div className={cn("text-sm", isRoom ? "font-bold text-foreground" : "text-muted-foreground text-xs")}>{step}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-border bg-card/80">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground justify-center">
            <div className="flex items-center gap-1.5"><div className="w-4 h-1.5 bg-[#22c55e] rounded-full opacity-50" /> Hành lang</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-1.5 bg-[#2563eb] rounded-full" /> Đường A → B</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-[1.5px] border-[#22c55e] bg-white" /> Node hành lang</div>
          </div>
        </div>
      </div>
    </div>
  );
}