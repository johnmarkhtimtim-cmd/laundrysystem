import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  PackageCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import MiniStat from "../../components/admin/MiniStat";
import AdminDataTable from "../../components/admin/AdminDataTable";
import { subscribeToAllBookings } from "../../services/bookingService";
import { subscribeToServices } from "../../services/laundryService";
import { subscribeToAllPayments } from "../../services/paymentService";
import { subscribeToUsersByRoles } from "../../services/userService";
import "../../styles/AdminSalesCharts.css";

function formatCurrency(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompact(amount) {
  const value = Number(amount) || 0;
  if (value >= 1000) {
    return `₱${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return formatCurrency(value);
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDayKeys(days) {
  const keys = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    keys.push(day);
  }
  return keys;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function paymentMoment(payment) {
  return (
    toDate(payment.payment_date) ||
    toDate(payment.updated_at) ||
    toDate(payment.created_at)
  );
}

function bookingMoment(booking) {
  return (
    toDate(booking.updated_at) ||
    toDate(booking.created_at) ||
    toDate(booking.booking_date) ||
    toDate(booking.schedule)
  );
}

function buildLinePath(coords) {
  return coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function SalesLineChart({ points }) {
  const width = 640;
  const height = 260;
  const padX = 36;
  const padY = 24;
  const maxValue = Math.max(
    ...points.map((point) => Math.max(point.sales || 0, point.paid || 0)),
    1
  );
  const stepX =
    points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = padX + index * stepX;
    const chartHeight = height - padY * 2 - 10;
    return {
      ...point,
      x,
      yAll: height - padY - ((point.sales || 0) / maxValue) * chartHeight,
      yPaid: height - padY - ((point.paid || 0) / maxValue) * chartHeight,
    };
  });

  const allPath = buildLinePath(
    coords.map((point) => ({ x: point.x, y: point.yAll }))
  );
  const paidPath = buildLinePath(
    coords.map((point) => ({ x: point.x, y: point.yPaid }))
  );
  const areaPath = `${allPath} L ${coords[coords.length - 1]?.x || padX} ${
    height - padY
  } L ${coords[0]?.x || padX} ${height - padY} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = height - padY - ratio * (height - padY * 2 - 10);
    return { y, label: formatCompact(maxValue * ratio) };
  });

  if (!points.length) {
    return <div className="analytics-empty">No sales data yet</div>;
  }

  return (
    <div className="analytics-chart-wrap tall">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales trend">
        {gridLines.map((line) => (
          <g key={line.y}>
            <line
              x1={padX}
              y1={line.y}
              x2={width - padX}
              y2={line.y}
              stroke="#e8edf5"
              strokeWidth="1"
            />
            <text
              x={8}
              y={line.y + 4}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="inherit"
            >
              {line.label}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#salesArea)" opacity="0.9" />
        <path
          d={allPath}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={paidPath}
          fill="none"
          stroke="#059669"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.yAll} r="4.5" fill="#2563eb" />
            <circle cx={point.x} cy={point.yPaid} r="3.5" fill="#059669" />
            <text
              x={point.x}
              y={height - 6}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontFamily="inherit"
            >
              {point.label}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
      </svg>
      <div className="donut-legend" style={{ marginTop: 8 }}>
        <div className="donut-legend-item">
          <span style={{ background: "#2563eb" }} />
          <strong>All payments</strong>
          <em />
        </div>
        <div className="donut-legend-item">
          <span style={{ background: "#059669" }} />
          <strong>Paid only</strong>
          <em />
        </div>
      </div>
    </div>
  );
}

function StackedBarChart({ points }) {
  const width = 420;
  const height = 260;
  const padX = 28;
  const padY = 28;
  const maxValue = Math.max(
    ...points.map((point) => point.sales + point.bookings),
    1
  );
  const barWidth = Math.min(36, ((width - padX * 2) / Math.max(points.length, 1)) * 0.55);
  const gap =
    points.length > 0
      ? (width - padX * 2 - barWidth * points.length) / Math.max(points.length - 1, 1)
      : 0;

  if (!points.length) {
    return <div className="analytics-empty">No weekly data yet</div>;
  }

  return (
    <div className="analytics-chart-wrap tall">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly sales mix">
        {points.map((point, index) => {
          const x = padX + index * (barWidth + gap);
          const salesHeight =
            (point.sales / maxValue) * (height - padY * 2);
          const bookingHeight =
            (point.bookings / maxValue) * (height - padY * 2);
          const salesY = height - padY - salesHeight;
          const bookingY = salesY - bookingHeight;

          return (
            <g key={point.label}>
              <rect
                x={x}
                y={bookingY}
                width={barWidth}
                height={Math.max(bookingHeight, 0)}
                rx="8"
                fill="#7c3aed"
                opacity="0.85"
              />
              <rect
                x={x}
                y={salesY}
                width={barWidth}
                height={Math.max(salesHeight, 0)}
                rx="8"
                fill="#2563eb"
              />
              <text
                x={x + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="inherit"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="donut-legend" style={{ marginTop: 8 }}>
        <div className="donut-legend-item">
          <span style={{ background: "#2563eb" }} />
          <strong>All payment volume</strong>
          <em />
        </div>
        <div className="donut-legend-item">
          <span style={{ background: "#7c3aed" }} />
          <strong>Booking volume</strong>
          <em />
        </div>
      </div>
    </div>
  );
}

function DonutChart({ segments }) {
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;

  let offset = 0;

  return (
    <div className="donut-layout">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eef2f7"
          strokeWidth={stroke}
        />
        {segments.map((segment) => {
          const length = (segment.value / total) * circumference;
          const circle = (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += length;
          return circle;
        })}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          fill="#172033"
          fontSize="20"
          fontWeight="750"
          fontFamily="inherit"
        >
          {Math.round(
            ((segments.find((item) => item.label === "Paid")?.value || 0) /
              total) *
              100
          )}
          %
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          fill="#64748b"
          fontSize="11"
          fontFamily="inherit"
        >
          paid rate
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((segment) => (
          <div className="donut-legend-item" key={segment.label}>
            <span style={{ background: segment.color }} />
            <div>
              <strong>{segment.label}</strong>
              <small>
                {" "}
                · {Math.round((segment.value / total) * 100)}%
              </small>
            </div>
            <em>{formatCurrency(segment.value)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ values, color = "#2563eb" }) {
  const width = 180;
  const height = 48;
  const maxValue = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / maxValue) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg width="100%" height="48" viewBox={`0 0 ${width} ${height}`}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminDashboard() {
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [rangeDays, setRangeDays] = useState(7);

  useEffect(() => {
    const unsubs = [
      subscribeToAllPayments(
        setPayments,
        (error) => console.error("Dashboard payments failed:", error)
      ),
      subscribeToAllBookings(
        setBookings,
        (error) => console.error("Dashboard bookings failed:", error)
      ),
      subscribeToServices(
        setServices,
        (error) => console.error("Dashboard services failed:", error)
      ),
      subscribeToUsersByRoles(
        ["customer"],
        setCustomers,
        (error) => console.error("Dashboard customers failed:", error)
      ),
      subscribeToUsersByRoles(
        ["staff", "rider"],
        setStaffMembers,
        (error) => console.error("Dashboard staff failed:", error)
      ),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe?.());
  }, []);

  const paymentAmount = (payment) =>
    Number(payment.amount ?? payment.total_amount ?? 0) || 0;

  const bookingAmount = (booking) =>
    Number(
      booking.total_amount ??
        booking.totalAmount ??
        booking.estimatedTotal ??
        booking.payment?.amount ??
        0
    ) || 0;

  const revenue = useMemo(() => {
    const totalRevenue = payments
      .filter((p) => p.payment_status === "Paid")
      .reduce((sum, p) => sum + paymentAmount(p), 0);
    const pendingRevenue = payments
      .filter((p) => p.payment_status === "Pending")
      .reduce((sum, p) => sum + paymentAmount(p), 0);
    const rejectedRevenue = payments
      .filter((p) => p.payment_status === "Rejected")
      .reduce((sum, p) => sum + paymentAmount(p), 0);
    const allVolume = payments.reduce((sum, p) => sum + paymentAmount(p), 0);
    const todayRevenue = payments
      .filter((p) => isSameDay(p.payment_date || p.updated_at || p.created_at))
      .reduce((sum, p) => sum + paymentAmount(p), 0);
    const todayPaid = payments
      .filter(
        (p) =>
          p.payment_status === "Paid" &&
          isSameDay(p.payment_date || p.updated_at || p.created_at)
      )
      .reduce((sum, p) => sum + paymentAmount(p), 0);

    return {
      totalRevenue,
      pendingRevenue,
      rejectedRevenue,
      allVolume,
      todayRevenue,
      todayPaid,
    };
  }, [payments]);

  const salesTrend = useMemo(() => {
    const days = buildDayKeys(rangeDays);
    const allByDay = Object.fromEntries(days.map((day) => [dayKey(day), 0]));
    const paidByDay = Object.fromEntries(days.map((day) => [dayKey(day), 0]));

    payments.forEach((payment) => {
      const moment = paymentMoment(payment);
      if (!moment) return;
      const key = dayKey(startOfDay(moment));
      if (!(key in allByDay)) return;

      const amount = paymentAmount(payment);
      allByDay[key] += amount;
      if (payment.payment_status === "Paid") {
        paidByDay[key] += amount;
      }
    });

    // Include booking totals for days with laundry activity even if payment row is missing
    bookings.forEach((booking) => {
      const moment = bookingMoment(booking);
      if (!moment) return;
      const key = dayKey(startOfDay(moment));
      if (!(key in allByDay)) return;

      const hasPayment = payments.some(
        (payment) => String(payment.booking_id) === String(booking.id)
      );
      if (!hasPayment) {
        allByDay[key] += bookingAmount(booking);
      }
    });

    return days.map((day) => ({
      label: day.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
      sales: allByDay[dayKey(day)] || 0,
      paid: paidByDay[dayKey(day)] || 0,
    }));
  }, [payments, bookings, rangeDays]);

  const weeklyMix = useMemo(() => {
    const days = buildDayKeys(7);
    const sales = Object.fromEntries(days.map((day) => [dayKey(day), 0]));
    const bookingCounts = Object.fromEntries(
      days.map((day) => [dayKey(day), 0])
    );
    const bookingTotals = Object.fromEntries(
      days.map((day) => [dayKey(day), 0])
    );

    payments.forEach((payment) => {
      const moment = paymentMoment(payment);
      if (!moment) return;
      const key = dayKey(startOfDay(moment));
      if (key in sales) sales[key] += paymentAmount(payment);
    });

    bookings.forEach((booking) => {
      const moment = bookingMoment(booking);
      if (!moment) return;
      const key = dayKey(startOfDay(moment));
      if (!(key in bookingCounts)) return;
      bookingCounts[key] += 1;
      bookingTotals[key] += bookingAmount(booking);
    });

    const maxSales = Math.max(...Object.values(sales), 1);
    const maxBookingTotals = Math.max(...Object.values(bookingTotals), 1);
    const scale = Math.max(maxSales, maxBookingTotals);

    return days.map((day) => {
      const key = dayKey(day);
      const bookingVolume =
        bookingTotals[key] > 0
          ? bookingTotals[key] * 0.55
          : ((bookingCounts[key] || 0) /
              Math.max(...Object.values(bookingCounts), 1)) *
            scale *
            0.35;

      return {
        label: day.toLocaleDateString("en-PH", { weekday: "short" }),
        sales: sales[key] || 0,
        bookings: bookingVolume,
        bookingCount: bookingCounts[key] || 0,
      };
    });
  }, [payments, bookings]);

  const methodSegments = useMemo(() => {
    const statusSegments = [
      { label: "Paid", value: revenue.totalRevenue, color: "#2563eb" },
      { label: "Pending", value: revenue.pendingRevenue, color: "#7c3aed" },
      { label: "Rejected", value: revenue.rejectedRevenue, color: "#fb923c" },
    ].filter((item) => item.value > 0);

    if (statusSegments.length) return statusSegments;

    const gcash = payments
      .filter((payment) => payment.payment_method === "GCash")
      .reduce((sum, payment) => sum + paymentAmount(payment), 0);
    const cash = payments
      .filter((payment) => payment.payment_method !== "GCash")
      .reduce((sum, payment) => sum + paymentAmount(payment), 0);

    return [
      { label: "GCash", value: gcash, color: "#22c55e" },
      { label: "Cash", value: cash, color: "#38bdf8" },
    ].filter((item) => item.value > 0);
  }, [payments, revenue]);

  const growthMetrics = useMemo(() => {
    const days = buildDayKeys(14);
    const mid = 7;
    const recent = days.slice(mid);
    const previous = days.slice(0, mid);

    const sumAll = (dayList) =>
      payments
        .filter((payment) => {
          const moment = paymentMoment(payment);
          if (!moment) return false;
          const key = dayKey(startOfDay(moment));
          return dayList.some((day) => dayKey(day) === key);
        })
        .reduce((sum, payment) => sum + paymentAmount(payment), 0);

    const recentSales = sumAll(recent);
    const previousSales = sumAll(previous);
    const salesGrowth =
      previousSales === 0
        ? recentSales > 0
          ? 100
          : 0
        : ((recentSales - previousSales) / previousSales) * 100;

    const paidCount = payments.filter((p) => p.payment_status === "Paid").length;
    const collectionRate =
      payments.length === 0 ? 0 : (paidCount / payments.length) * 100;

    const completed = bookings.filter((booking) =>
      ["delivered", "completed"].includes(
        String(booking.status || "").toLowerCase()
      )
    ).length;
    const completionRate =
      bookings.length === 0 ? 0 : (completed / bookings.length) * 100;

    return {
      salesGrowth,
      collectionRate,
      completionRate,
      recentSales,
      previousSales,
    };
  }, [payments, bookings]);

  const activeServices = services.filter(
    (service) => service.status !== "Inactive"
  ).length;

  const todaysPickups = useMemo(() => {
    return bookings.filter((booking) => {
      const schedule =
        booking.schedule ||
        booking.pickup_date ||
        booking.pickupDate ||
        booking.booking_date ||
        booking.created_at;
      const status = String(booking.status || "").toLowerCase();
      if (["completed", "cancelled", "canceled", "declined"].includes(status)) {
        return false;
      }
      return isSameDay(schedule);
    });
  }, [bookings]);

  const completedDeliveries = bookings.filter((booking) =>
    ["delivered", "completed"].includes(String(booking.status || "").toLowerCase())
  ).length;

  const recentPaymentsConfig = useMemo(() => {
    const rows = payments.slice(0, 8).map((payment) => [
      `#${payment.booking_id?.slice(-6) || payment.id?.slice(-6) || "N/A"}`,
      payment.customer_name || payment.customer?.name || "Unknown",
      payment.services || "Laundry",
      formatCurrency(payment.amount),
      payment.payment_method || "Cash",
      payment.payment_status || "Pending",
    ]);

    return {
      title: "Recent payments",
      description: "Live payment activity from Firestore.",
      columns: ["Booking", "Customer", "Service", "Amount", "Method", "Status"],
      rows,
    };
  }, [payments]);

  const deliveryConfig = useMemo(() => {
    const rows = todaysPickups.slice(0, 8).map((booking) => [
      booking.customer_name || "Customer",
      booking.address || booking.pickupAddress || "—",
      booking.time || formatDate(booking.schedule || booking.pickup_date),
      booking.pickupType || booking.deliveryType || "Pickup & Delivery",
      booking.rider_name || booking.staff_name || "Unassigned",
      booking.status || "Pending",
    ]);

    return {
      title: "Pickup & delivery today",
      description: "Live bookings scheduled for today.",
      columns: [
        "Customer",
        "Address",
        "Schedule",
        "Type",
        "Assigned staff",
        "Status",
      ],
      rows,
    };
  }, [todaysPickups]);

  const stats = [
    [Users, "Total Customers", String(customers.length)],
    [PackageCheck, "Active Services", String(activeServices)],
    [Users, "Total Staff", String(staffMembers.length)],
    [Wallet, "Total Revenue", formatCurrency(revenue.totalRevenue)],
    [Wallet, "Today's Volume", formatCurrency(revenue.todayRevenue)],
    [CreditCard, "Pending Payments", formatCurrency(revenue.pendingRevenue)],
    [CalendarDays, "Scheduled Pickups", String(todaysPickups.length)],
    [CheckCircle2, "Completed Deliveries", String(completedDeliveries)],
  ];

  const rangeSales = salesTrend.reduce((sum, point) => sum + point.sales, 0);
  const rangePaid = salesTrend.reduce((sum, point) => sum + point.paid, 0);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Charts auto-update from all live payments and bookings."
      />

      <div className="mini-stats">
        {stats.map(([Icon, title, value]) => (
          <MiniStat
            key={title}
            icon={<Icon size={20} />}
            title={title}
            value={value}
          />
        ))}
      </div>

      <section className="admin-sales-analytics">
        <div className="analytics-card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ margin: 0 }}>Sales analytics</h2>
            <p style={{ margin: "6px 0 0" }}>
              Auto-fed from Firestore payments and bookings
            </p>
          </div>
          <span className="analytics-live-badge">
            <i />
            Live feed
          </span>
        </div>

        <div className="analytics-row top">
          <article className="analytics-card">
            <div className="analytics-card-head">
            <div>
              <h2>Sales trend</h2>
              <p>
                {formatCurrency(rangeSales)} total volume ·{" "}
                {formatCurrency(rangePaid)} paid
              </p>
            </div>
              <div className="analytics-range">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={rangeDays === days ? "active" : ""}
                    onClick={() => setRangeDays(days)}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
            <SalesLineChart points={salesTrend} />
          </article>

          <article className="analytics-card">
            <div className="analytics-card-head">
            <div>
              <h2>Weekly mix</h2>
              <p>All payment volume stacked with booking totals</p>
            </div>
            </div>
            <StackedBarChart points={weeklyMix} />
          </article>
        </div>

        <div className="analytics-row middle">
          <article className="analytics-card">
            <div className="analytics-card-head">
            <div>
              <h2>Revenue mix</h2>
              <p>All payment statuses from live Firestore data</p>
            </div>
            </div>
            {methodSegments.length ? (
              <DonutChart segments={methodSegments} />
            ) : (
              <div className="analytics-empty">No payment mix yet</div>
            )}
          </article>

          <article className="analytics-card">
            <div className="analytics-card-head">
              <div>
                <h2>Performance</h2>
                <p>Compared against the previous 7 days</p>
              </div>
            </div>
            <div className="metric-grid">
              <div className="metric-tile">
                <small>Sales growth</small>
                <strong>
                  {growthMetrics.salesGrowth >= 0 ? "+" : ""}
                  {growthMetrics.salesGrowth.toFixed(0)}%
                </strong>
                <b className={growthMetrics.salesGrowth < 0 ? "down" : ""}>
                  <TrendingUp size={14} /> vs last week
                </b>
              </div>
              <div className="metric-tile">
                <small>Collection rate</small>
                <strong>{growthMetrics.collectionRate.toFixed(0)}%</strong>
                <b>Paid / all payments</b>
              </div>
              <div className="metric-tile">
                <small>Completion rate</small>
                <strong>{growthMetrics.completionRate.toFixed(0)}%</strong>
                <b>Finished bookings</b>
              </div>
            </div>
          </article>
        </div>

        <div className="analytics-row bottom">
          <article className="analytics-card spark-card">
            <div className="spark-top">
              <small>Range volume pulse</small>
              <strong>{formatCompact(rangeSales)}</strong>
            </div>
            <Sparkline values={salesTrend.map((point) => point.sales)} />
            <div className="spark-bar">
              <i
                style={{
                  width: `${Math.min(
                    100,
                    (rangeSales / Math.max(revenue.allVolume, 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </article>

          <article className="analytics-card spark-card">
            <div className="spark-top">
              <small>Today vs all volume</small>
              <strong>
                {(
                  (revenue.todayRevenue / Math.max(revenue.allVolume, 1)) *
                  100
                ).toFixed(0)}
                %
              </strong>
            </div>
            <div className="spark-bar">
              <i
                className="purple"
                style={{
                  width: `${Math.min(
                    100,
                    (revenue.todayRevenue / Math.max(revenue.allVolume, 1)) *
                      100
                  )}%`,
                }}
              />
            </div>
            <span className="spark-trend">
              <ArrowUpRight size={14} />
              {formatCurrency(revenue.todayRevenue)} today
            </span>
          </article>

          <article className="analytics-card spark-card">
            <div className="spark-top">
              <small>Pending queue</small>
              <strong>{formatCompact(revenue.pendingRevenue)}</strong>
            </div>
            <div className="spark-bar">
              <i
                className="green"
                style={{
                  width: `${Math.min(
                    100,
                    (revenue.pendingRevenue /
                      Math.max(
                        revenue.pendingRevenue + revenue.totalRevenue,
                        1
                      )) *
                      100
                  )}%`,
                }}
              />
            </div>
            <span className="spark-trend">
              Awaiting staff verification
            </span>
          </article>
        </div>
      </section>

      <AdminDataTable config={recentPaymentsConfig} />
      <AdminDataTable config={deliveryConfig} />
    </>
  );
}
