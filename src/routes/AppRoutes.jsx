import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Registration from "../pages/Registration";
import AdminPortalLayout from "../layouts/AdminLayout";
import RoleRoute from "./RoleRoute";
import AdminDashboard from "../pages/Admin/AdminDashboard";
import AdminCustomers from "../pages/Admin/AdminCustomers";
import Services from "../pages/Admin/Services";
import Pricing from "../pages/Admin/Pricing";
import Staff from "../pages/Admin/Staff";
import PaymentsAdmin from "../pages/Admin/Payments";
import PickupDelivery from "../pages/Admin/PickupDelivery";
import Reports from "../pages/Admin/Reports";
import Notifications from "../pages/Admin/Notifications";
import Settings from "../pages/Admin/Settings";
import AdminProfile from "../pages/Admin/AdminProfile";
import CustomerLayout from "../layouts/CustomerLayout";
import CustomerDashboard from "../pages/Customer/CustomerDashboard";
import BookNow from "../pages/Customer/BookNow";
import MyBookings from "../pages/Customer/MyBookings";
import Payments from "../pages/Customer/Payments";
import Transactions from "../pages/Customer/Transactions";
import Notification from "../pages/Customer/Notifications";
import Profile from "../pages/Customer/Profile";
import StaffLayout from "../layouts/StaffLayout";
import StaffRoute from "./StaffRoute";
import CustomerMap from "../pages/Staff/CustomerMap";
import StaffDashboard from "../pages/Staff/StaffDashboard";
import StaffBookings from "../pages/Staff/Bookings";
import StaffTasks from "../pages/Staff/Tasks";
import StaffReports from "../pages/Staff/Reports";
import RiderLayout from "../layouts/RiderLayout";
import RiderRoute from "./RiderRoute";
import RiderDashboard from "../pages/Rider/RiderDashboard";
import RiderProfile from "../pages/Rider/RiderProfile";
import StaffPayments from "../pages/Staff/Payments";
import StaffNotifications from "../pages/Staff/Notifications";
import StaffProfile from "../pages/Staff/Profile";
function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRole="admin">
              <AdminPortalLayout />
            </RoleRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="services" element={<Services />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="staff" element={<Staff />} />
          <Route path="payments" element={<PaymentsAdmin />} />
          <Route path="pickup-delivery" element={<PickupDelivery />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<AdminProfile />} />
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
          <Route path="transactions" element={<Transactions />} />
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
          <Route path="CustomerMap" element={<CustomerMap />} />
          <Route path="payments" element={<StaffPayments />} />
          <Route path="notifications" element={<StaffNotifications />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="tasks" element={<StaffTasks />} />
          <Route path="reports" element={<StaffReports />} />
        </Route>
        <Route
          path="/rider"
          element={
            <RiderRoute>
              <RiderLayout />
            </RiderRoute>
          }
        >
          <Route index element={<RiderDashboard />} />
          <Route path="pickups" element={<RiderDashboard />} />
          <Route path="profile" element={<RiderProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default AppRoutes;
