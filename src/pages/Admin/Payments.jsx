import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminDataTable from "../../components/admin/AdminDataTable";
import Summary from "../../components/admin/Summary";
import { adminData } from "../../data/adminData";
export default function Payments() {
  const config = adminData.payments;
  return (
    <>
      <AdminPageHeader {...config} />
      <Summary />
      <AdminDataTable config={config} />
    </>
  );
}
