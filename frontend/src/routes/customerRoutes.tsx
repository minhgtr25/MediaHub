import { Route, Navigate } from "react-router-dom";
import {
  SupportInbox,
  SupportConversation,
  PaymentsPage,
  RequestList,
  CreateRequest,
  RequestWorkspace,
  OrderList,
  OrderWorkspace,
  Profile,
  Notifications,
  ProjectList,
  CustomerDashboard,
  CreateProject,
  CustomerProject,
  CustomerInvoices,
  CustomerInvoice,
  CustomerQuotations,
  ProjectMessages,
} from "./lazyPages";
import { CustomerRoute } from "../contexts/AuthContext";
import { CustomerLayout } from "../layouts/CustomerLayout";

export const customerRoutes = (
  <>
    <Route element={<CustomerRoute />}>
      <Route path="/customer" element={<CustomerLayout />}>
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/new" element={<CreateRequest />} />
        <Route path="requests/:id" element={<RequestWorkspace />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/:id" element={<OrderWorkspace />} />
        <Route path="support" element={<SupportInbox />} />
        <Route path="support/:id" element={<SupportConversation />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="invoices/:id" element={<CustomerInvoice />} />
        <Route path="quotations" element={<CustomerQuotations />} />
        <Route path="projects/:id/messages" element={<ProjectMessages />} />
        {["quotation", "files", "revisions"].map((path) => (
          <Route
            key={path}
            path={`projects/:id/${path}`}
            element={<CustomerProject />}
          />
        ))}
        <Route path="projects/new" element={<CreateProject />} />
        <Route path="projects/:id" element={<CustomerProject />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Route>
  </>
);
