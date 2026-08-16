function StaffReports() {
  return (
    <div className="staff-reports">
      <div className="section-header">
        <h1>Work Reports</h1>
        <p>View your performance metrics and statistics</p>
      </div>

      <div className="reports-grid">
        <div className="report-card">
          <h3>This Week</h3>
          <div className="stat">
            <span className="label">Tasks Completed</span>
            <span className="value">47</span>
          </div>
          <div className="stat">
            <span className="label">Average Time per Task</span>
            <span className="value">18 min</span>
          </div>
        </div>

        <div className="report-card">
          <h3>This Month</h3>
          <div className="stat">
            <span className="label">Total Bookings Processed</span>
            <span className="value">156</span>
          </div>
          <div className="stat">
            <span className="label">Customer Satisfaction</span>
            <span className="value">98%</span>
          </div>
        </div>

        <div className="report-card">
          <h3>Performance</h3>
          <div className="stat">
            <span className="label">On-time Delivery Rate</span>
            <span className="value">99.2%</span>
          </div>
          <div className="stat">
            <span className="label">Quality Score</span>
            <span className="value">9.8/10</span>
          </div>
        </div>
      </div>

      <div className="report-section">
        <h2>Detailed Activity Log</h2>
        <table className="activity-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>Booking</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2025-08-16 14:30</td>
              <td>Completed Washing</td>
              <td>#BK001</td>
              <td><span className="status completed">Done</span></td>
            </tr>
            <tr>
              <td>2025-08-16 12:15</td>
              <td>Quality Check</td>
              <td>#BK002</td>
              <td><span className="status completed">Done</span></td>
            </tr>
            <tr>
              <td>2025-08-16 10:00</td>
              <td>Started Washing</td>
              <td>#BK003</td>
              <td><span className="status in-progress">In Progress</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StaffReports;
