import { CalendarDays, CheckCircle2, CreditCard, PackageCheck, Users, Wallet } from "lucide-react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import MiniStat from "../../components/admin/MiniStat";
import AdminDataTable from "../../components/admin/AdminDataTable";
import { adminData } from "../../data/adminData";

const stats = [[Users, "Total Customers", "248"], [PackageCheck, "Active Services", "6"], [Users, "Total Staff", "12"], [Wallet, "Total Revenue", "₱45,850"], [Wallet, "Today's Revenue", "₱3,420"], [CreditCard, "Pending Payments", "₱5,420"], [CalendarDays, "Scheduled Pickups", "8"], [CheckCircle2, "Completed Deliveries", "21"]];

export default function AdminDashboard() {
	return <>
		<AdminPageHeader title="Dashboard" description="Welcome back, Admin." />
		<div className="mini-stats">{stats.map(([Icon, title, value]) => <MiniStat key={title} icon={<Icon size={20} />} title={title} value={value} />)}</div>
		<section className="portal-card"><h2>Revenue Overview</h2><div className="chart-bars">{[48, 65, 54, 78, 62, 88, 72].map((height, index) => <div className="chart-bar" key={index} style={{ height: `${height}%` }}><span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span></div>)}</div></section>
		<section className="portal-card"><h2>Service Performance</h2><div className="performance-list"><div><span>Wash & Fold</span><b style={{ width: "82%" }} /></div><div><span>Dry Cleaning</span><b style={{ width: "64%" }} /></div><div><span>Pickup Service</span><b style={{ width: "91%" }} /></div></div></section>
		<AdminDataTable config={{ ...adminData.payments, title: "Recent payments", action: undefined }} />
		<AdminDataTable config={{ ...adminData.delivery, title: "Pickup & delivery today", action: undefined }} />
	</>;
}