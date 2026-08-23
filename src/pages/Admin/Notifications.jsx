import { useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";

const initialNotifications = [{ id: 1, title: "Payment received", message: "GCash payment from Juan Dela Cruz was recorded.", read: false }, { id: 2, title: "Pickup assignment needed", message: "A new pickup is waiting for staff assignment.", read: false }, { id: 3, title: "Service updated", message: "Wash & Fold pricing was updated.", read: true }];

export default function Notifications() {
	const [items, setItems] = useState(initialNotifications);
	const unreadCount = items.filter((item) => !item.read).length;
	const markAllRead = () => setItems((current) => current.map((item) => ({ ...item, read: true })));
	return <>
		<AdminPageHeader title="Notifications" description="Stay up to date with payment, delivery, and system activity." />
		<section className="portal-card notification-list"><div className="section-heading"><strong>{unreadCount} unread notifications</strong><button className="light-action" type="button" onClick={markAllRead}>Mark all as read</button></div>{items.map((item) => <article className={item.read ? "read" : "unread"} key={item.id}><div><strong>{item.title}</strong><p>{item.message}</p></div><button type="button" onClick={() => setItems((current) => current.filter((notification) => notification.id !== item.id))}>Remove</button></article>)}</section>
	</>;
}