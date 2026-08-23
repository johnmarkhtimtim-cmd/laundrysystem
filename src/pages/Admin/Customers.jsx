import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { adminData } from "../../data/adminData";

export default function Customers() {
  const config = adminData.customers;

  return <><AdminPageHeader {...config} /><AdminDataTable config={config} /></>;
}
