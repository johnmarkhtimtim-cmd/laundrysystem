import { Plus } from "lucide-react";

export default function AdminPageHeader({ title, description, action }) {
	return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action && <button className="primary-action" type="button"><Plus size={17} />{action}</button>}</div>;
}