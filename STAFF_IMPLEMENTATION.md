# Staff Role Implementation Guide

## Quick Start

### File Structure
```
src/
├── layouts/
│   └── StaffLayout.jsx              # Main staff layout component
├── pages/
│   └── Staff/
│       ├── StaffDashboard.jsx       # Overview & metrics
│       ├── Bookings.jsx             # Assigned bookings
│       ├── Tasks.jsx                # Daily tasks
│       └── Reports.jsx              # Performance reports
├── routes/
│   ├── StaffRoute.jsx               # Staff security wrapper
│   └── AppRoutes.jsx                # Updated with staff routes
├── styles/
│   └── StaffLayout.css              # Responsive staff styling
└── context/
    └── AuthContext.jsx              # Updated with loading state
```

## Component Overview

### 1. StaffLayout.jsx
Main layout component that provides consistent UI for all staff pages.

**Features:**
- Header with staff branding
- Sidebar navigation
- Logout button
- User avatar with email display

**Usage:**
```jsx
<StaffRoute>
  <StaffLayout />
</StaffRoute>
```

### 2. StaffRoute.jsx
Security wrapper that protects all staff routes.

**Security Features:**
- Authentication check (verifies user exists)
- Role validation (ensures user.role === "staff")
- Status check (blocks inactive accounts)
- Automatic redirection on unauthorized access

**Usage:**
```jsx
<StaffRoute>
  <Component />
</StaffRoute>
```

### 3. Staff Pages

#### StaffDashboard.jsx
Overview of staff member's work and metrics.

**Displays:**
- Daily task count
- Completed tasks
- In-progress tasks
- Assigned manager
- Recent booking assignments

#### Bookings.jsx
Manage assigned laundry bookings.

**Features:**
- View all assigned bookings
- Filter by status (pending, in-progress, completed)
- Search functionality
- Update booking status
- View booking details

#### Tasks.jsx
Track daily work tasks and assignments.

**Features:**
- List of assigned tasks
- Filter by completion status
- Mark tasks complete
- Priority indicators
- Due dates

#### Reports.jsx
Performance metrics and activity logs.

**Displays:**
- Weekly statistics
- Monthly performance
- Customer satisfaction scores
- On-time delivery rates
- Detailed activity logs

## Routes Configuration

### New Routes Added
```javascript
<Route path="/staff" element={<StaffRoute><StaffLayout /></StaffRoute>}>
  <Route index element={<StaffDashboard />} />
  <Route path="bookings" element={<StaffBookings />} />
  <Route path="tasks" element={<StaffTasks />} />
  <Route path="reports" element={<StaffReports />} />
</Route>
```

### Access Points
- **Dashboard**: `/staff`
- **Bookings**: `/staff/bookings`
- **Tasks**: `/staff/tasks`
- **Reports**: `/staff/reports`

## Database Schema (Firestore)

### Users Collection
```json
{
  "users": {
    "staff-id-123": {
      "email": "john@example.com",
      "role": "staff",
      "status": "active",
      "name": "John Doe",
      "assignedBy": "admin-id-456",
      "createdAt": "2025-08-16T10:00:00Z",
      "department": "Operations",
      "phone": "+1234567890"
    }
  }
}
```

### Bookings Collection
```json
{
  "bookings": {
    "booking-123": {
      "customerId": "cust-456",
      "assignedStaffId": "staff-id-123",
      "status": "pending",
      "pickupDate": "2025-08-18",
      "deliveryDate": "2025-08-20",
      "serviceType": "Dry Cleaning",
      "notes": "Important items"
    }
  }
}
```

### Tasks Collection
```json
{
  "tasks": {
    "task-789": {
      "assignedStaffId": "staff-id-123",
      "title": "Process Booking #BK001",
      "description": "Complete washing for John Doe",
      "priority": "high",
      "dueDate": "2025-08-20",
      "completed": false,
      "createdAt": "2025-08-16T09:00:00Z"
    }
  }
}
```

## Adding to Authentication Flow

### User Registration (Admin Creates Staff)
1. Admin creates new staff user in Firebase Auth
2. Admin sets role to "staff" in Firestore users collection
3. Admin sets status to "active"
4. Staff member receives login credentials
5. Staff member logs in and is redirected to `/staff`

### Login Flow
```
1. User enters email & password
2. authService.login() authenticates with Firebase
3. AuthContext fetches user data from Firestore
4. User data includes role and status
5. Route component checks role and redirects accordingly:
   - role: "admin" → /admin
   - role: "staff" → /staff
   - role: "customer" → /customer
```

## Styling

### CSS Classes Used
- `.staff-layout` - Main container
- `.staff-header` - Top navigation bar
- `.sidebar` - Left navigation
- `.content` - Main content area
- `.dashboard-cards` - Card grid layout
- `.card` - Individual card component
- `.status` - Status badges
- `.nav-link` - Navigation links
- `.action-btn` - Action buttons

### Color Scheme
- **Primary Purple**: `#667eea`
- **Secondary Purple**: `#764ba2`
- **Dark Text**: `#2d3748`
- **Light Gray**: `#f5f5f5`
- **White**: `#ffffff`
- **Success Green**: `#48bb78`

### Responsive Breakpoints
- Mobile: `max-width: 480px`
- Tablet: `max-width: 768px`
- Desktop: `max-width: 1400px`

## Usage Examples

### Displaying User Info
```jsx
import { useAuth } from "../context/AuthContext";

function MyComponent() {
  const { user } = useAuth();
  
  return (
    <div>
      <p>Name: {user?.name}</p>
      <p>Email: {user?.email}</p>
      <p>Status: {user?.status}</p>
    </div>
  );
}
```

### Protecting Component
```jsx
import StaffRoute from "../routes/StaffRoute";

function ProtectedComponent() {
  return (
    <StaffRoute>
      <div>This is only visible to staff members</div>
    </StaffRoute>
  );
}
```

### Logging Out
```jsx
import { logout } from "../services/authService";
import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  
  return <button onClick={handleLogout}>Logout</button>;
}
```

## Testing the Implementation

### Manual Testing Checklist
- [ ] Create a test staff account in Firebase
- [ ] Log in as staff member
- [ ] Verify redirect to `/staff` works
- [ ] Test all navigation links (bookings, tasks, reports)
- [ ] Verify staff cannot access admin routes
- [ ] Verify staff cannot access customer routes
- [ ] Test logout functionality
- [ ] Test account deactivation (if implemented)
- [ ] Verify responsive design on mobile

### Browser Console Testing
```javascript
// Check current user in console
const { user } = useAuth();
console.log(user);

// Should show:
// {
//   uid: "...",
//   email: "staff@example.com",
//   role: "staff",
//   status: "active",
//   name: "John Doe"
// }
```

## Common Issues & Solutions

### Issue: Staff member cannot access /staff
**Solution**: Check that user.role in Firestore is exactly "staff" (case-sensitive)

### Issue: Redirect to login on staff routes
**Solution**: Verify user is authenticated and role is "staff", check StaffRoute.jsx

### Issue: Styling not loading
**Solution**: Ensure StaffLayout.css is imported in StaffLayout.jsx

### Issue: User data not loading
**Solution**: Check Firebase configuration and ensure getUserData returns correct data

## Next Steps

1. **Setup Firebase Security Rules** - Deploy rules to production Firestore
2. **Create Admin Panel for Staff Management** - Allow admins to create/deactivate staff
3. **Add Notifications** - Real-time updates for new bookings/tasks
4. **Implement Analytics** - Track staff performance metrics
5. **Add Two-Factor Authentication** - Enhanced security for staff accounts

## Support Resources

- [React Router Documentation](https://reactrouter.com/)
- [Firebase Authentication Guide](https://firebase.google.com/docs/auth)
- [Firestore Database](https://firebase.google.com/docs/firestore)
- See `STAFF_SECURITY.md` for detailed security information
