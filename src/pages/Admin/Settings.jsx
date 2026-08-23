import { useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";

export default function Settings() {
	const [saved, setSaved] = useState(false);
	return <><AdminPageHeader title="Settings" description="Manage business information, defaults, and account preferences." /><section className="portal-card settings-form"><h2>General</h2><label>Business name<input defaultValue="LaundryMate" /></label><label>Pickup & Delivery window<select defaultValue="Same day"><option>Same day</option><option>Next day</option></select></label><h2>Notification Preferences</h2><label><input type="checkbox" defaultChecked />Payment notifications</label><label><input type="checkbox" defaultChecked />Pickup assignment notifications</label><button className="primary-action" type="button" onClick={() => setSaved(true)}>Save changes</button>{saved && <small>Settings saved.</small>}</section></>;
}