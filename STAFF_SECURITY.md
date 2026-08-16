# Staff Role Security Documentation

## Overview
The staff role has been implemented with comprehensive security features to ensure that only authorized staff members can access staff-specific functionality.

## Security Architecture

### 1. **Authentication & Authorization**

#### StaffRoute Component (`src/routes/StaffRoute.jsx`)
- **Purpose**: Protects all staff routes from unauthorized access
- **Security Checks**:
  - Verifies user is authenticated (redirects to login if not)
  - Validates user role is "staff"
  - Checks staff member status (blocks inactive accounts)
  - Redirects unauthorized users back to login page

```jsx
// Security flow:
1. User attempts to access /staff route
2. StaffRoute checks if user exists
3. Validates user.role === "staff"
4. Checks if user.status !== "inactive"
5. Allows access only if all checks pass
```

### 2. **Role-Based Access Control (RBAC)**

#### User Roles in System
- **admin**: Full system access, can manage staff, bookings, payments, users, reports
- **customer**: Can book services, view bookings, make payments, manage profile
- **staff**: Can view assigned bookings, manage tasks, view reports, track performance

#### Role Enforcement Points

**RoleRoute Component** (`src/routes/RoleRoute.jsx`)
```jsx
// For admin and customer roles
if (user.role !== allowedRole) {
  return <Navigate to="/" replace />;
}
```

**StaffRoute Component** (`src/routes/StaffRoute.jsx`)
```jsx
// For staff role with additional security
- Authentication check
- Role validation
- Status verification
```

### 3. **Staff Routes & Access Paths**

#### Protected Routes
All staff routes require staff authentication:

```
/staff/                 → StaffDashboard (overview & metrics)
/staff/bookings         → Bookings (assigned laundry jobs)
/staff/tasks           → Tasks (daily work assignments)
/staff/reports         → Reports (performance & activity)
```

#### Unprotected Routes
```
/                      → Login page (accessible to all)
/admin/*               → Admin pages (requires admin role)
/customer/*            → Customer pages (requires customer role)
```

### 4. **Firebase Security**

#### User Data Structure (Firestore)
```json
{
  "uid": "user-unique-id",
  "email": "staff@laundrymate.com",
  "role": "staff",
  "status": "active",
  "name": "John Doe",
  "assignedBy": "admin-id",
  "createdAt": "2025-08-16T00:00:00Z"
}
```

#### Security Rules (Should be enforced in Firestore)
```
// Only authenticated users can read their own data
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow write: if request.auth.uid == userId && 
                  resource.data.role == "staff"; // Prevent role escalation
}

// Bookings accessible only to assigned staff
match /bookings/{bookingId} {
  allow read: if request.auth.uid in resource.data.assignedStaffIds;
  allow write: if request.auth.uid in resource.data.assignedStaffIds;
}

// Tasks accessible only by assigned staff
match /tasks/{taskId} {
  allow read: if request.auth.uid == resource.data.assignedStaffId;
  allow write: if request.auth.uid == resource.data.assignedStaffId;
}
```

### 5. **Session Management**

#### Authentication Context (`src/context/AuthContext.jsx`)
- Monitors Firebase authentication state
- Maintains user data in context
- Automatically logs out on sign-out
- Loading state prevents UI flashing

#### Logout Security
```jsx
export const logout = async () => {
  return await signOut(auth);
  // Clears Firebase session
  // Redirects to login page
  // Context updates user to null
};
```

### 6. **Frontend Security Best Practices**

#### Protected Component Pattern
```jsx
function StaffRoute({ children }) {
  const { user, loading } = useAuth();
  
  // Wait for auth to load
  if (loading) return <div>Loading...</div>;
  
  // Check authentication
  if (!user) return <Navigate to="/" />;
  
  // Check authorization
  if (user.role !== "staff") return <Navigate to="/" />;
  
  // Additional security checks
  if (user.status === "inactive") return <AccessDenied />;
  
  return children;
}
```

#### Secure Routing
- All staff routes wrapped in StaffRoute component
- No direct URL access without proper authentication
- Automatic redirection on unauthorized access
- Client-side validation supported by server-side rules

### 7. **Data Access Control**

#### Staff Dashboard
- Shows only user's assigned tasks and bookings
- Displays performance metrics based on staff member's work
- Cannot access other staff members' data

#### Staff Bookings
- Filtered to show only assigned bookings
- Can update status but cannot delete
- All changes logged for audit trail

#### Staff Tasks
- Shows only tasks assigned to current user
- Task completion tracked and reported
- Cannot reassign tasks (admin only)

#### Staff Reports
- Personal performance metrics only
- Activity logs show only own actions
- Cannot view other staff reports

### 8. **Incident Response**

#### Account Deactivation
If a staff member needs to be removed:
1. Admin sets `status: "inactive"` in Firestore
2. StaffRoute blocks access immediately
3. User sees "Account Inactive" message
4. Logout is enforced

#### Session Timeout
- Implement token refresh in production
- Consider session timeout after inactivity
- Automatic redirect to login

### 9. **Audit & Logging**

#### Recommended Implementation
```javascript
// Log all staff actions
const logAction = async (staffId, action, details) => {
  await addDoc(collection(db, "auditLog"), {
    staffId,
    action,
    details,
    timestamp: new Date(),
    ipAddress: req.ip, // if using backend
    userAgent: navigator.userAgent
  });
};
```

### 10. **Security Checklist**

#### Development
- [ ] Environment variables for Firebase config secured
- [ ] No API keys in client-side code (use Firebase security rules)
- [ ] HTTPS only in production
- [ ] Input validation on all forms
- [ ] Output encoding to prevent XSS

#### Deployment
- [ ] Firebase authentication enabled
- [ ] Security rules deployed to Firestore
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Monitoring & alerting set up

#### Ongoing
- [ ] Regular security audits
- [ ] Staff access reviews (quarterly)
- [ ] Inactive account cleanup
- [ ] Dependency updates for vulnerabilities
- [ ] Password policy enforcement

## Testing Security

### Test Cases
```javascript
// 1. Unauthenticated user cannot access /staff
// Expected: Redirect to login

// 2. Customer tries to access /staff
// Expected: Redirect to login

// 3. Admin tries to access /staff
// Expected: Redirect to login

// 4. Staff member with active status accesses /staff
// Expected: Dashboard loads

// 5. Staff member with inactive status accesses /staff
// Expected: "Account Inactive" message

// 6. Staff tries to view other staff's data
// Expected: Data not accessible (403 Forbidden)

// 7. Logout clears session
// Expected: Redirect to login, context updated
```

## Future Enhancements

1. **Two-Factor Authentication (2FA)** for staff accounts
2. **Role-based permissions matrix** for granular control
3. **Activity logging** with timestamps and IP tracking
4. **Session management** with timeout enforcement
5. **Data encryption** for sensitive staff information
6. **API rate limiting** to prevent brute force attacks
7. **Automated backup** of staff data and audit logs

## References

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Router Protected Routes](https://reactrouter.com/en/main/start/overview)

## Support & Questions

For security concerns or questions:
1. Contact: security@laundrymate.com
2. Review: Quarterly security audit schedule
3. Report: Security vulnerabilities responsibly
