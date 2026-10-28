import { Route, Navigate } from "react-router-dom";
import {
  SupportInbox,
  SupportConversation,
  RequestList,
  RequestWorkspace,
  StaffRequestDashboard,
  FinanceReportPage,
  OrderList,
  OrderWorkspace,
  Profile,
  Notifications,
} from "./lazyPages";
import { StaffRoute } from "../contexts/AuthContext";
import { StaffLayout } from "../layouts/WorkspaceLayouts";

export const staffRoutes = (
  <>
    <Route element={<StaffRoute />}>
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StaffRequestDashboard />} />
        <Route path="finance" element={<FinanceReportPage />} />
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/:id" element={<RequestWorkspace />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/:id" element={<OrderWorkspace />} />
        <Route path="support" element={<SupportInbox />} />
        <Route path="support/:id" element={<SupportConversation />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Route>
  </>
);
