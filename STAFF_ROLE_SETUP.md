# Staff Role Setup Guide

## Overview
The staff role has been fully integrated into the login and routing system. This guide explains how to create and manage staff users.

## Creating a Staff User

### Method 1: Firebase Console (Recommended for Admin Setup)

#### Step 1: Create Authentication User
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your "laundrysystem" project
3. Navigate to **Authentication** > **Users**
4. Click **Add user** button
5. Enter:
   - **Email**: `staff@example.com` (or any staff email)
   - **Password**: Create a secure password
6. Click **Add user**

#### Step 2: Create User Document in Firestore
1. Navigate to **Firestore Database**
2. Go to **Collection: users**
3. Click **Add document**
4. Document ID: Use the **UID** from the Firebase user you just created
5. Fill in the following fields:

```json
{
  "uid": "user-id-from-firebase",
  "email": "staff@example.com",
  "role": "staff",
  "status": "active",
  "name": "John Doe",
  "assignedBy": "admin-uid",
  "createdAt": "2025-08-16",
  "department": "Operations"
}
```

**Required Fields:**
- `email` (string): User's email address
- `role` (string): **MUST BE** `"staff"` (case-sensitive)
- `status` (string): `"active"` or `"inactive"`

**Optional Fields:**
- `name` (string): Staff member's full name
- `assignedBy` (string): UID of admin who created the staff account
- `department` (string): Department or team assignment
- `phone` (string): Contact number

#### Step 3: Verify
1. The staff member can now log in with their email and password
2. They will be automatically redirected to `/staff` dashboard

---

## Staff Role Configuration

### Role Value
```
role: "staff"
```
⚠️ **Important**: The role must be exactly `"staff"` (lowercase, no spaces)

### Valid Status Values
```
"active"    → Staff can access the portal
"inactive"  → Staff cannot access (blocked by StaffRoute)
```

---

## Staff Portal Access Paths

Once logged in, staff members can access:

| Path | Description | Component |
|------|-------------|-----------|
| `/staff` | Dashboard with overview | StaffDashboard |
| `/staff/bookings` | Assigned bookings | StaffBookings |
| `/staff/tasks` | Daily tasks | StaffTasks |
| `/staff/reports` | Performance reports | StaffReports |

---

## Role-Based Redirection Logic

### Login Redirection
When a user logs in, they are redirected based on their role:

| Role | Redirects To | Component |
|------|------------|-----------|
| `admin` | `/admin` | AdminLayout |
| `customer` | `/customer` | CustomerLayout |
| `staff` | `/staff` | StaffLayout |
| (invalid) | Shows error | Alert message |

### Code Implementation
```javascript
// authService.jsx
export const getNavigationPathByRole = (role) => {
    switch (role) {
        case "admin":
            return "/admin";
        case "customer":
            return "/customer";
        case "staff":
            return "/staff";
        default:
            return null; // Invalid role
    }
};
```

---

## Security Features

### Authentication Checks
1. **User Authentication**: User must be logged in with valid Firebase credentials
2. **Role Validation**: User role must match the required role (`"staff"`)
3. **Status Verification**: Account status must be `"active"`
4. **Loading State**: Proper handling of auth initialization

### Access Control
```
StaffRoute Component Flow:
1. Check if user is authenticated → If not: redirect to login
2. Wait for auth loading to complete
3. Check if user.role === "staff" → If not: redirect to login
4. Check if user.status === "inactive" → If true: show access denied
5. Allow access to staff portal
```

---

## Troubleshooting

### Issue: "Invalid user role" message on login
**Cause**: User document in Firestore doesn't exist or role is not set to "staff"

**Solution**:
1. Check that user document exists in Firestore under `users` collection
2. Verify role field is exactly `"staff"` (case-sensitive, lowercase)
3. Ensure document ID matches the Firebase Authentication UID

### Issue: Staff member cannot access /staff
**Cause**: Several possible causes

**Solutions**:
1. Verify user authentication is successful (check Firebase auth logs)
2. Check that `userData` is being fetched correctly (check browser console)
3. Verify role in Firestore is `"staff"` (not "Staff" or "STAFF")
4. Check that status is `"active"` (not "inactive")

### Issue: Blank loading screen
**Cause**: Authentication is still loading

**Solution**:
1. Normal behavior during app initialization
2. Wait for auth to load
3. Check browser console for any errors
4. If persists, clear cache and reload

### Issue: User can access admin/customer routes
**Cause**: Role-based routing protection not working

**Solution**:
1. Verify RoleRoute component in `src/routes/RoleRoute.jsx`
2. Ensure it checks user.role matches allowedRole
3. Check that loading state is handled correctly
4. Verify firestore security rules restrict access

---

## Firebase Firestore Security Rules

To protect staff data, add these security rules:

```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read their own data
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId && 
                      (resource.data.role == "staff" || 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin");
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

    // Only admins can manage staff
    match /staff/{staffId} {
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

---

## Testing the Staff Role

### Manual Testing Checklist
- [ ] Create test staff user in Firebase Console
- [ ] Add user document to Firestore with `role: "staff"`
- [ ] Log in with staff credentials
- [ ] Verify redirect to `/staff` (not `/admin` or `/customer`)
- [ ] Verify all staff navigation links work
- [ ] Test logout functionality
- [ ] Verify staff cannot access admin routes directly
- [ ] Test account deactivation (set status to "inactive")

### Browser Console Testing
```javascript
// After login, check user object in console
// This should appear in browser console if logged in as staff
{
  uid: "...",
  email: "staff@example.com",
  role: "staff",
  status: "active",
  name: "John Doe",
  ...
}
```

---

## Quick Reference

### Creating a Staff User (Steps Summary)
1. Firebase Console → Authentication → Add user (enter email & password)
2. Copy the UID
3. Firestore → users collection → Add document
4. Document ID = UID
5. Add fields: email, role="staff", status="active", name
6. Save
7. Staff can now log in

### Valid Firestore User Document Example
```json
{
  "uid": "abc123xyz789",
  "email": "john@laundrymate.com",
  "role": "staff",
  "status": "active",
  "name": "John Doe",
  "assignedBy": "admin-uid-456",
  "createdAt": "2025-08-16T10:00:00Z",
  "department": "Operations",
  "phone": "+1-234-567-8900"
}
```

### Role Values (Case-Sensitive)
```
"admin"    → Admin portal access
"customer" → Customer portal access  
"staff"    → Staff portal access
```

---

## Support & Next Steps

### Implementation Tasks
- [ ] Deploy Firebase security rules
- [ ] Create staff users in production
- [ ] Test staff portal functionality
- [ ] Set up notification system for staff
- [ ] Implement staff performance tracking

### Advanced Features (Future)
- Staff team management
- Skill-based task assignment
- Automated performance metrics
- Two-factor authentication for staff
- Staff mobile app
