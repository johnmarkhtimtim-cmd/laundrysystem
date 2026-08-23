import { CheckCircle2, CreditCard, Wallet } from "lucide-react";
import MiniStat from "./MiniStat";

const defaultItems = [[<Wallet />, "Total Revenue", "₱45,850"], [<CheckCircle2 />, "Paid", "₱39,230"], [<CreditCard />, "Pending", "₱5,420"], [<Wallet />, "Failed", "₱1,200"]];

export default function Summary({ items = defaultItems }) {
	return <div className="mini-stats">{items.map(([icon, title, value]) => <MiniStat key={title} icon={icon} title={title} value={value} />)}</div>;
}