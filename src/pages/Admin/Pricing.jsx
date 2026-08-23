import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminDataTable from "../../components/admin/AdminDataTable";
import { adminData } from "../../data/adminData";
export default function Pricing() {
  const config = adminData.pricing;
  return (
    <>
      <AdminPageHeader {...config} />
      <AdminDataTable config={config} />
    </>
  );
}
