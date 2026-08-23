export default function MiniStat({ icon, title, value }) {
	return <div className="mini-stat"><span>{icon}</span><div><small>{title}</small><strong>{value}</strong></div></div>;
}