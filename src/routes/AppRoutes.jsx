import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import AdminDashboard from "../pages/Admin/AdminDashboard";
import AdminLayout from "../layouts/AdminLayout";
import RoleRoute from "./RoleRoute";
import Booking from "../pages/Admin/Booking";
import StaffManagement from "../pages/Admin/StaffManagement";
import Payment from "../pages/Admin/Payment";
import User from "../pages/Admin/User";
import Reports from "../pages/Admin/Reports";
import CustomerLayout from "../layouts/CustomerLayout";
import CustomerDashboard from "../pages/Customer/CustomerDashboard";
import BookNow from "../pages/Customer/BookNow";
import MyBookings from "../pages/Customer/MyBookings";
import Payments from "../pages/Customer/Payments";
import Notification from "../pages/Customer/Notifications";
import Profile from "../pages/Customer/Profile";
import StaffLayout from "../layouts/StaffLayout";
import StaffRoute from "./StaffRoute";
import StaffDashboard from "../pages/Staff/StaffDashboard";
import StaffBookings from "../pages/Staff/Bookings";
import StaffTasks from "../pages/Staff/Tasks";
import StaffReports from "../pages/Staff/Reports";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRole="admin">
              <AdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="booking" element={<Booking />} />
          <Route path="staff-management" element={<StaffManagement />} />
          <Route path="payment" element={<Payment />} />
          <Route path="user" element={<User />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route
          path="/customer"
          element={
            <RoleRoute allowedRole="customer">
              <CustomerLayout />
            </RoleRoute>
          }
        >
          <Route index element={<CustomerDashboard />} />
          <Route path="booknow" element={<BookNow />} />
          <Route path="mybookings" element={<MyBookings />} />
          <Route path="payments" element={<Payments />} />
          <Route path="notification" element={<Notification />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route
          path="/staff"
          element={
            <StaffRoute>
              <StaffLayout />
            </StaffRoute>
          }
        >
          <Route index element={<StaffDashboard />} />
          <Route path="bookings" element={<StaffBookings />} />
          <Route path="tasks" element={<StaffTasks />} />
          <Route path="reports" element={<StaffReports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
