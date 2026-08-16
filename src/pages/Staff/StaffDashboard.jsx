import { useAuth } from "../../context/AuthContext";

function StaffDashboard() {
  const { user } = useAuth();

  return (
    <div className="staff-dashboard">
      <div className="dashboard-header">
        <h1>Staff Dashboard</h1>
        <p>Welcome, {user?.name || "Staff Member"}</p>
      </div>

      <div className="dashboard-cards">
        <div className="card">
          <div className="card-icon">📅</div>
          <div className="card-content">
            <h3>Today's Tasks</h3>
            <p className="card-number">12</p>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">✓</div>
          <div className="card-content">
            <h3>Completed</h3>
            <p className="card-number">8</p>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">⏳</div>
          <div className="card-content">
            <h3>In Progress</h3>
            <p className="card-number">4</p>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <h3>Assigned By</h3>
            <p className="card-name">{user?.assignedBy || "Unassigned"}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Recent Bookings</h2>
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>#BK001</td>
              <td>John Doe</td>
              <td><span className="status pending">Pending</span></td>
              <td>2025-08-20</td>
            </tr>
            <tr>
              <td>#BK002</td>
              <td>Jane Smith</td>
              <td><span className="status in-progress">In Progress</span></td>
              <td>2025-08-21</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StaffDashboard;
