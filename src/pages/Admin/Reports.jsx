import { Download, FileBarChart } from "lucide-react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";

const reportOptions = [
  "Revenue Report",
  "Payment Report",
  "Customer Report",
  "Service Performance",
  "Staff Activity",
  "Pickup & Delivery",
];

export default function Reports() {
  return (
    <>
      <AdminPageHeader
        title="Reports"
        description="Generate business insights and export operational reports."
        action="Generate report"
      />
      <section className="portal-card">
        <h2>
          <FileBarChart size={20} /> Report options
        </h2>
        <div className="report-options">
          {reportOptions.map((report) => (
            <label key={report}>
              <input
                type="radio"
                name="report"
                defaultChecked={report === reportOptions[0]}
              />
              {report}
            </label>
          ))}
        </div>
        <label>
          Report period
          <select defaultValue="This month">
            <option>This month</option>
            <option>Last month</option>
            <option>This year</option>
          </select>
        </label>
        <button className="light-action" type="button">
          <Download size={16} />
          Export CSV
        </button>
      </section>
    </>
  );
}
