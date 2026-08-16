import { useAuth } from "../../context/AuthContext";

function StaffBookings() {
  const { user } = useAuth();

  return (
    <div className="staff-bookings">
      <div className="section-header">
        <h1>Assigned Bookings</h1>
        <p>Manage and track your assigned laundry bookings</p>
      </div>

      <div className="filters">
        <select className="filter-select">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <input type="search" placeholder="Search bookings..." className="filter-input" />
      </div>

      <table className="bookings-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Customer</th>
            <th>Service Type</th>
            <th>Status</th>
            <th>Pickup Date</th>
            <th>Delivery Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>#BK001</td>
            <td>John Doe</td>
            <td>Dry Cleaning</td>
            <td><span className="status pending">Pending</span></td>
            <td>2025-08-18</td>
            <td>2025-08-20</td>
            <td>
              <button className="action-btn">View</button>
              <button className="action-btn update">Update</button>
            </td>
          </tr>
          <tr>
            <td>#BK002</td>
            <td>Jane Smith</td>
            <td>Regular Wash</td>
            <td><span className="status in-progress">In Progress</span></td>
            <td>2025-08-17</td>
            <td>2025-08-19</td>
            <td>
              <button className="action-btn">View</button>
              <button className="action-btn update">Update</button>
            </td>
          </tr>
          <tr>
            <td>#BK003</td>
            <td>Bob Johnson</td>
            <td>Ironing</td>
            <td><span className="status completed">Completed</span></td>
            <td>2025-08-16</td>
            <td>2025-08-17</td>
            <td>
              <button className="action-btn">View</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default StaffBookings;
