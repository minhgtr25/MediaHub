import { Route, Navigate } from "react-router-dom";
import {
  SupportInbox,
  SupportConversation,
  PaymentsPage,
  PaymentSettingsPage,
  CaseStudyReviewPage,
  CreatorOnboardingPage,
  CreatorShowcasePage,
  RequestList,
  RequestWorkspace,
  FinanceReportPage,
  AdminServicePackages,
  OrderList,
  OrderWorkspace,
  Profile,
  Notifications,
  AdminDashboard,
  AdminProjects,
  AdminProjectDetail,
  AdminContent,
  AdminCustomers,
  AdminRevenue,
  AdminEmployees,
  AdminServices,
  AdminPortfolio,
  AdminTestimonials,
  AdminLeads,
  AdminLeadDetail,
  CustomerInvoices,
  CustomerInvoice,
  CustomerQuotations,
  ProjectMessages,
  ProcessPage,
  ActivityLogs,
  AdminUsers,
  AdminFiles,
  AdminQuotation,
} from "./lazyPages";
import { AdminRoute } from "../contexts/AuthContext";
import { AdminLayout } from "../layouts/AdminLayout";

export const adminRoutes = (
  <>
    <Route element={<AdminRoute />}>
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/:id" element={<RequestWorkspace />} />
        <Route path="service-packages" element={<AdminServicePackages />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/:id" element={<OrderWorkspace />} />
        <Route path="support" element={<SupportInbox />} />
        <Route path="support/:id" element={<SupportConversation />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="payment-settings" element={<PaymentSettingsPage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="finance" element={<FinanceReportPage />} />
        <Route path="files" element={<AdminFiles />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="creators" element={<CreatorOnboardingPage />} />
        <Route path="creator-showcase" element={<CreatorShowcasePage />} />
        <Route path="case-studies" element={<CaseStudyReviewPage />} />
        <Route path="invoices" element={<CustomerInvoices admin />} />
        <Route path="invoices/:id" element={<CustomerInvoice admin />} />
        <Route path="quotations" element={<CustomerQuotations admin />} />
        <Route path="quotations/:id" element={<AdminQuotation />} />
        <Route path="partners" element={<AdminContent resource="partners" />} />
        <Route
          path="process"
          element={
            <>
              <p className="panel">
                Quy trình được thiết kế cố định trong giao diện và dùng chung
                với trang chủ. Nội dung được cập nhật trong mã nguồn khi nghiệp
                vụ thay đổi.
              </p>
              <ProcessPage />
            </>
          }
        />
        <Route
          path="settings"
          element={<AdminContent resource="website_settings" />}
        />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="projects/:id/messages" element={<ProjectMessages />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="leads/:id" element={<AdminLeadDetail />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="projects/:id" element={<AdminProjectDetail />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="revenue" element={<AdminRevenue />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="services/new" element={<AdminServices />} />
        <Route path="services/:id/edit" element={<AdminServices />} />
        <Route path="portfolio" element={<AdminPortfolio />} />
        <Route path="portfolio/new" element={<AdminPortfolio />} />
        <Route path="portfolio/:id/edit" element={<AdminPortfolio />} />
        <Route path="website-projects" element={<AdminPortfolio />} />
        <Route path="website-projects/new" element={<AdminPortfolio />} />
        <Route path="website-projects/:id/edit" element={<AdminPortfolio />} />
        <Route path="testimonials" element={<AdminTestimonials />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Route>
  </>
);
