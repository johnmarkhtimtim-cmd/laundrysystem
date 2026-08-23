import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminDataTable from "../../components/admin/AdminDataTable";
import { adminData } from "../../data/adminData";
export default function Services() {
  const config = adminData.services;
  return (
    <>
      <AdminPageHeader {...config} />
      <AdminDataTable config={config} />
    </>
  );
}
