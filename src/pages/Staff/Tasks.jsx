function StaffTasks() {
  return (
    <div className="staff-tasks">
      <div className="section-header">
        <h1>My Tasks</h1>
        <p>Track your daily work tasks and assignments</p>
      </div>

      <div className="task-filter">
        <button className="filter-btn active">All</button>
        <button className="filter-btn">Today</button>
        <button className="filter-btn">Overdue</button>
        <button className="filter-btn">Completed</button>
      </div>

      <div className="tasks-list">
        <div className="task-item">
          <div className="task-header">
            <input type="checkbox" className="task-checkbox" />
            <h3>Process Booking #BK001</h3>
          </div>
          <p>Complete washing for John Doe's dry cleaning order</p>
          <div className="task-meta">
            <span className="priority high">High Priority</span>
            <span className="due-date">Due: 2025-08-20</span>
          </div>
        </div>

        <div className="task-item">
          <div className="task-header">
            <input type="checkbox" className="task-checkbox" />
            <h3>Quality Check #BK002</h3>
          </div>
          <p>Inspect and approve finished items for Jane Smith</p>
          <div className="task-meta">
            <span className="priority medium">Medium Priority</span>
            <span className="due-date">Due: 2025-08-19</span>
          </div>
        </div>

        <div className="task-item completed">
          <div className="task-header">
            <input type="checkbox" className="task-checkbox" checked readOnly />
            <h3>Delivery Coordination #BK003</h3>
          </div>
          <p>Arrange delivery for Bob Johnson's ironed clothes</p>
          <div className="task-meta">
            <span className="priority low">Low Priority</span>
            <span className="due-date">Due: 2025-08-17</span>
          </div>
        </div>

        <div className="task-item">
          <div className="task-header">
            <input type="checkbox" className="task-checkbox" />
            <h3>Inventory Update</h3>
          </div>
          <p>Update laundry supply inventory levels</p>
          <div className="task-meta">
            <span className="priority low">Low Priority</span>
            <span className="due-date">Due: 2025-08-25</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StaffTasks;
