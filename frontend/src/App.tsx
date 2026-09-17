import {SupportInbox,SupportConversation} from './pages/shared/SupportPages';
import {PaymentSettingsPage,PaymentsPage} from './pages/shared/PaymentPages';
import { RouteMetadata } from "./components/Metadata";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PublicLayout, CustomerLayout, AdminLayout, StaffLayout } from "./layouts/ApplicationLayouts";
import { CustomerRoute, AdminRoute, StaffRoute, AuthenticatedRoute } from "./contexts/AuthContext";
const Login = lazy(() =>
  import("./pages/auth/AuthenticationPages").then((module) => ({ default: module.Login })),
);
const Register = lazy(() =>
  import("./pages/auth/AuthenticationPages").then((module) => ({ default: module.Register })),
);
const ForgotPassword = lazy(() =>
  import("./pages/auth/AuthenticationPages").then((module) => ({
    default: module.ForgotPassword,
  })),
);
const ResetPassword = lazy(() =>
  import("./pages/auth/AuthenticationPages").then((module) => ({
    default: module.ResetPassword,
  })),
);
const Profile = lazy(() =>
  import("./pages/auth/AuthenticationPages").then((module) => ({ default: module.Profile })),
);
const Notifications = lazy(() =>
  import("./pages/auth/AuthenticationPages").then((module) => ({
    default: module.Notifications,
  })),
);
const ProjectList = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.ProjectList,
  })),
);
const CustomerDashboard = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.CustomerDashboard,
  })),
);
const CreateProject = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.CreateProject,
  })),
);
const CustomerProject = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.CustomerProject,
  })),
);
const AdminDashboard = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.AdminDashboard,
  })),
);
const AdminProjects = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.AdminProjects,
  })),
);
const AdminProjectDetail = lazy(() =>
  import("./pages/shared/WorkspacePages").then((module) => ({
    default: module.AdminProjectDetail,
  })),
);
const AdminContent = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({ default: module.AdminContent })),
);
const AdminCustomers = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminCustomers,
  })),
);
const AdminRevenue = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({ default: module.AdminRevenue })),
);
const AdminEmployees = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminEmployees,
  })),
);
const AdminServices = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({ default: module.AdminServices })),
);
const AdminPortfolio = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminPortfolio,
  })),
);
const AdminTestimonials = lazy(() =>
  import("./pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminTestimonials,
  })),
);
const Home = lazy(() =>
  import("./pages/public/HomePage").then((module) => ({ default: module.HomePage })),
);
const Projects = lazy(() =>
  import("./pages/public/ProjectPortfolioPages").then((module) => ({ default: module.Projects })),
);
const Creators = lazy(() =>
  import("./pages/public/CreatorDiscoveryPage").then((module) => ({ default: module.Creators })),
);
const CreatorProfile = lazy(() =>
  import("./pages/public/CreatorDiscoveryPage").then((module) => ({ default: module.CreatorProfile })),
);
const MessengerPage = lazy(() => import("./pages/shared/MessengerPage").then((module) => ({ default: module.MessengerPage })));
const ProjectDetail = lazy(() =>
  import("./pages/public/ProjectPortfolioPages").then((module) => ({ default: module.ProjectDetail })),
);
const NotFound = lazy(() =>
  import("./pages/public/ProjectPortfolioPages").then((module) => ({ default: module.NotFound })),
);
const Services = lazy(() =>
  import("./pages/public/PublicServiceAndEnquiryPages").then((module) => ({ default: module.Services })),
);
const ServiceDetail = lazy(() =>
  import("./pages/public/PublicServiceAndEnquiryPages").then((module) => ({
    default: module.ServiceDetail,
  })),
);
const Enquiry = lazy(() =>
  import("./pages/public/PublicServiceAndEnquiryPages").then((module) => ({ default: module.Enquiry })),
);
const AdminLeads = lazy(() =>
  import("./pages/public/PublicServiceAndEnquiryPages").then((module) => ({ default: module.AdminLeads })),
);
const AdminLeadDetail = lazy(() =>
  import("./pages/public/PublicServiceAndEnquiryPages").then((module) => ({
    default: module.AdminLeadDetail,
  })),
);

const CustomerInvoices = lazy(() =>
  import("./pages/customer/CustomerBillingAndMessagesPages").then((module) => ({
    default: module.CustomerInvoices,
  })),
);
const CustomerInvoice = lazy(() =>
  import("./pages/customer/CustomerBillingAndMessagesPages").then((module) => ({
    default: module.CustomerInvoice,
  })),
);
const CustomerQuotations = lazy(() =>
  import("./pages/customer/CustomerBillingAndMessagesPages").then((module) => ({
    default: module.CustomerQuotations,
  })),
);
const ProjectMessages = lazy(() =>
  import("./pages/customer/CustomerBillingAndMessagesPages").then((module) => ({
    default: module.ProjectMessages,
  })),
);
const ContentPage = lazy(() =>
  import("./pages/public/PublicContentPages").then((module) => ({ default: module.ContentPage })),
);
const PartnersPage = lazy(() =>
  import("./pages/public/PublicContentPages").then((module) => ({
    default: module.PartnersPage,
  })),
);
const ProcessPage = lazy(() =>
  import("./pages/public/PublicContentPages").then((module) => ({ default: module.ProcessPage })),
);
const ActivityLogs = lazy(() =>
  import("./pages/public/PublicContentPages").then((module) => ({
    default: module.ActivityLogs,
  })),
);
const AdminUsers = lazy(() =>
  import("./pages/admin/AdminAccountPages").then((module) => ({
    default: module.AdminUsers,
  })),
);
const AdminFiles = lazy(() =>
  import("./pages/admin/ProjectFileManagementPage").then((module) => ({
    default: module.AdminFiles,
  })),
);
const AdminQuotation = lazy(() =>
  import("./pages/admin/QuotationManagementPage").then((module) => ({
    default: module.AdminQuotation,
  })),
);
const ErrorPage = lazy(() =>
  import("./pages/shared/ErrorPage").then((module) => ({ default: module.ErrorPage })),
);
export default function App() {
  return (
    <>
      <RouteMetadata />
      <Suspense
        fallback={
          <div className="app-loading" role="status" aria-live="polite">
            <span className="loading-mark">▶</span>
            <span>Đang tải MediaHub…</span>
          </div>
        }
      >
        <Routes>
          <Route element={<StaffRoute/>}><Route path="/staff" element={<StaffLayout/>}><Route index element={<Navigate to="dashboard" replace/>}/><Route path="dashboard" element={<SupportInbox/>}/><Route path="support" element={<SupportInbox/>}/><Route path="support/:id" element={<SupportConversation/>}/><Route path="profile" element={<Profile/>}/><Route path="notifications" element={<Notifications/>}/></Route></Route>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route
              path="/about"
              element={<ContentPage name="about" title="Về MediaHub" />}
            />
            <Route
              path="/privacy"
              element={
                <ContentPage name="privacy" title="Chính sách bảo mật" />
              }
            />
            <Route
              path="/terms"
              element={<ContentPage name="terms" title="Điều khoản sử dụng" />}
            />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:slug" element={<ServiceDetail />} />
            <Route path="/contact" element={<Enquiry contact />} />
            <Route path="/request-project" element={<Enquiry />} />
            <Route path="/portfolio" element={<Projects />} />
            <Route path="/portfolio/:id" element={<ProjectDetail />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/creators" element={<Creators />} />
            <Route path="/creators/:slug" element={<CreatorProfile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>
          <Route element={<AuthenticatedRoute />}>
            <Route path="/messages" element={<MessengerPage />} />
            <Route path="/messages/:id" element={<MessengerPage />} />
          </Route>
          <Route element={<CustomerRoute />}>
            <Route path="/customer" element={<CustomerLayout />}>
              <Route path="support" element={<SupportInbox/>}/><Route path="support/:id" element={<SupportConversation/>}/><Route path="payments" element={<PaymentsPage/>}/>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="projects" element={<ProjectList />} />
              <Route path="invoices" element={<CustomerInvoices />} />
              <Route path="invoices/:id" element={<CustomerInvoice />} />
              <Route path="quotations" element={<CustomerQuotations />} />
              <Route
                path="projects/:id/messages"
                element={<ProjectMessages />}
              />
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
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="support" element={<SupportInbox/>}/><Route path="support/:id" element={<SupportConversation/>}/><Route path="payments" element={<PaymentsPage/>}/><Route path="payment-settings" element={<PaymentSettingsPage/>}/>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="files" element={<AdminFiles />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="invoices" element={<CustomerInvoices admin />} />
              <Route path="invoices/:id" element={<CustomerInvoice admin />} />
              <Route path="quotations" element={<CustomerQuotations admin />} />
              <Route path="quotations/:id" element={<AdminQuotation />} />
              <Route
                path="partners"
                element={<AdminContent resource="partners" />}
              />
              <Route
                path="process"
                element={<AdminContent resource="work_processes" />}
              />
              <Route
                path="settings"
                element={<AdminContent resource="website_settings" />}
              />
              <Route path="activity-logs" element={<ActivityLogs />} />
              <Route
                path="projects/:id/messages"
                element={<ProjectMessages />}
              />
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
              <Route path="testimonials" element={<AdminTestimonials />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>
          <Route path="/403" element={<ErrorPage kind="403" />} />
          <Route path="/500" element={<ErrorPage kind="500" />} />
          <Route path="/network-error" element={<ErrorPage kind="network" />} />
          <Route
            path="/session-expired"
            element={<ErrorPage kind="session" />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
