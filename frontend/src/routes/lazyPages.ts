import { lazy } from "react";

export const CreatorDashboard = lazy(() =>
  import("../pages/creator/CreatorWorkspacePages").then((m) => ({
    default: m.CreatorDashboard,
  })),
);
export const SupportInbox = lazy(() =>
  import("../pages/shared/SupportPages").then((module) => ({
    default: module.SupportInbox,
  })),
);
export const SupportConversation = lazy(() =>
  import("../pages/shared/SupportPages").then((module) => ({
    default: module.SupportConversation,
  })),
);
export const PaymentsPage = lazy(() =>
  import("../pages/shared/PaymentPages").then((module) => ({
    default: module.PaymentsPage,
  })),
);
export const PaymentSettingsPage = lazy(() =>
  import("../pages/shared/PaymentPages").then((module) => ({
    default: module.PaymentSettingsPage,
  })),
);
export const CaseStudyReviewPage = lazy(() =>
  import("../pages/admin/CaseStudyReviewPage").then((m) => ({
    default: m.CaseStudyReviewPage,
  })),
);
export const CreatorOnboardingPage = lazy(() =>
  import("../pages/admin/CreatorOnboardingPage").then((m) => ({
    default: m.CreatorOnboardingPage,
  })),
);
export const CreatorWorkspacePage = lazy(() =>
  import("../pages/creator/CreatorWorkspacePages").then((m) => ({
    default: m.CreatorWorkspacePage,
  })),
);
export const RequestList = lazy(() =>
  import("../pages/shared/RequestPages").then((m) => ({
    default: m.RequestList,
  })),
);
export const CompanyIntakePage = lazy(() =>
  import("../pages/public/CompanyIntakePage").then((m) => ({
    default: m.CompanyIntakePage,
  })),
);
export const CreateRequest = lazy(() =>
  import("../pages/shared/RequestPages").then((m) => ({
    default: m.CreateRequest,
  })),
);
export const RequestWorkspace = lazy(() =>
  import("../pages/shared/RequestWorkspacePage").then((m) => ({
    default: m.RequestWorkspace,
  })),
);
export const StaffRequestDashboard = lazy(() =>
  import("../pages/shared/RequestPages").then((m) => ({
    default: m.StaffRequestDashboard,
  })),
);
export const FinanceReportPage = lazy(() =>
  import("../pages/shared/FinanceReportPage").then((m) => ({
    default: m.FinanceReportPage,
  })),
);
export const AdminServicePackages = lazy(() =>
  import("../pages/admin/ServicePackagePages").then((m) => ({
    default: m.AdminServicePackages,
  })),
);
export const OrderList = lazy(() =>
  import("../pages/shared/OrderPages").then((m) => ({ default: m.OrderList })),
);
export const OrderWorkspace = lazy(() =>
  import("../pages/shared/OrderPages").then((m) => ({
    default: m.OrderWorkspace,
  })),
);
export const Login = lazy(() =>
  import("../pages/auth/AuthenticationPages").then((module) => ({
    default: module.Login,
  })),
);
export const Register = lazy(() =>
  import("../pages/auth/AuthenticationPages").then((module) => ({
    default: module.Register,
  })),
);
export const ForgotPassword = lazy(() =>
  import("../pages/auth/AuthenticationPages").then((module) => ({
    default: module.ForgotPassword,
  })),
);
export const ResetPassword = lazy(() =>
  import("../pages/auth/AuthenticationPages").then((module) => ({
    default: module.ResetPassword,
  })),
);
export const Profile = lazy(() =>
  import("../pages/auth/AccountPages").then((module) => ({
    default: module.Profile,
  })),
);
export const Notifications = lazy(() =>
  import("../pages/auth/AccountPages").then((module) => ({
    default: module.Notifications,
  })),
);
export const ProjectList = lazy(() =>
  import("../pages/shared/DashboardPages").then((module) => ({
    default: module.ProjectList,
  })),
);
export const CustomerDashboard = lazy(() =>
  import("../pages/shared/DashboardPages").then((module) => ({
    default: module.CustomerDashboard,
  })),
);
export const CreateProject = lazy(() =>
  import("../pages/shared/CreateProjectPage").then((module) => ({
    default: module.CreateProject,
  })),
);
export const CustomerProject = lazy(() =>
  import("../pages/shared/ProjectWorkspacePages").then((module) => ({
    default: module.CustomerProject,
  })),
);
export const AdminDashboard = lazy(() =>
  import("../pages/shared/DashboardPages").then((module) => ({
    default: module.AdminDashboard,
  })),
);
export const AdminVisitAnalytics = lazy(() =>
  import("../pages/admin/AdminVisitAnalyticsPage").then((module) => ({
    default: module.AdminVisitAnalyticsPage,
  })),
);
export const AdminProjects = lazy(() =>
  import("../pages/shared/DashboardPages").then((module) => ({
    default: module.AdminProjects,
  })),
);
export const AdminProjectDetail = lazy(() =>
  import("../pages/shared/ProjectWorkspacePages").then((module) => ({
    default: module.AdminProjectDetail,
  })),
);
export const AdminContent = lazy(() =>
  import("../pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminContent,
  })),
);
export const AdminCustomers = lazy(() =>
  import("../pages/admin/AdminCustomersPage").then((module) => ({
    default: module.AdminCustomers,
  })),
);
export const AdminRevenue = lazy(() =>
  import("../pages/admin/AdminRevenuePage").then((module) => ({
    default: module.AdminRevenue,
  })),
);
export const AdminEmployees = lazy(() =>
  import("../pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminEmployees,
  })),
);
export const AdminServices = lazy(() =>
  import("../pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminServices,
  })),
);
export const AdminPortfolio = lazy(() =>
  import("../pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminPortfolio,
  })),
);
export const AdminTestimonials = lazy(() =>
  import("../pages/admin/AdminResourcePages").then((module) => ({
    default: module.AdminTestimonials,
  })),
);
export const PolicyPage = lazy(() =>
  import("../pages/public/PolicyPage").then((m) => ({ default: m.PolicyPage })),
);
export const Home = lazy(() =>
  import("../pages/public/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);
export const Projects = lazy(() =>
  import("../pages/public/ProjectPortfolioPages").then((module) => ({
    default: module.Projects,
  })),
);
export const Creators = lazy(() =>
  import("../pages/public/CreatorDirectoryPage").then((module) => ({
    default: module.Creators,
  })),
);
export const CreatorProfile = lazy(() =>
  import("../pages/public/CreatorProfilePage").then((module) => ({
    default: module.CreatorProfile,
  })),
);
export const MessengerPage = lazy(() =>
  import("../pages/shared/MessengerPage").then((module) => ({
    default: module.MessengerPage,
  })),
);
export const CompanyExcerptPage = lazy(() =>
  import("../pages/public/CompanyExcerptPage").then((module) => ({
    default: module.CompanyExcerptPage,
  })),
);
export const ProjectDetail = lazy(() =>
  import("../pages/public/ProjectPortfolioPages").then((module) => ({
    default: module.ProjectDetail,
  })),
);
export const NotFound = lazy(() =>
  import("../pages/public/ProjectPortfolioPages").then((module) => ({
    default: module.NotFound,
  })),
);
export const Services = lazy(() =>
  import("../pages/public/ServiceCatalogPages").then((module) => ({
    default: module.Services,
  })),
);
export const ServiceDetail = lazy(() =>
  import("../pages/public/ServiceCatalogPages").then((module) => ({
    default: module.ServiceDetail,
  })),
);
export const Enquiry = lazy(() =>
  import("../pages/public/EnquiryPage").then((module) => ({
    default: module.Enquiry,
  })),
);
export const AdminLeads = lazy(() =>
  import("../pages/admin/AdminLeadPages").then((module) => ({
    default: module.AdminLeads,
  })),
);
export const AdminLeadDetail = lazy(() =>
  import("../pages/admin/AdminLeadPages").then((module) => ({
    default: module.AdminLeadDetail,
  })),
);

export const CustomerInvoices = lazy(() =>
  import("../pages/customer/CustomerBillingPages").then((module) => ({
    default: module.CustomerInvoices,
  })),
);
export const CustomerInvoice = lazy(() =>
  import("../pages/customer/CustomerBillingPages").then((module) => ({
    default: module.CustomerInvoice,
  })),
);
export const CustomerQuotations = lazy(() =>
  import("../pages/customer/CustomerBillingPages").then((module) => ({
    default: module.CustomerQuotations,
  })),
);
export const ProjectMessages = lazy(() =>
  import("../pages/shared/ProjectWorkspacePanels").then((module) => ({
    default: module.ProjectMessages,
  })),
);
export const ContentPage = lazy(() =>
  import("../pages/public/PublicContentPages").then((module) => ({
    default: module.ContentPage,
  })),
);
export const PartnersPage = lazy(() =>
  import("../pages/public/PublicContentPages").then((module) => ({
    default: module.PartnersPage,
  })),
);
export const ProcessPage = lazy(() =>
  import("../pages/public/PublicContentPages").then((module) => ({
    default: module.ProcessPage,
  })),
);
export const PartnerDetailPage = lazy(() =>
  import("../pages/public/PartnerDetailPage").then((module) => ({
    default: module.PartnerDetailPage,
  })),
);
export const ActivityLogs = lazy(() =>
  import("../pages/public/PublicContentPages").then((module) => ({
    default: module.ActivityLogs,
  })),
);
export const AdminUsers = lazy(() =>
  import("../pages/admin/AdminAccountPages").then((module) => ({
    default: module.AdminUsers,
  })),
);
export const AdminFiles = lazy(() =>
  import("../pages/admin/ProjectFileManagementPage").then((module) => ({
    default: module.AdminFiles,
  })),
);
export const AdminQuotation = lazy(() =>
  import("../pages/admin/QuotationManagementPage").then((module) => ({
    default: module.AdminQuotation,
  })),
);
export const ErrorPage = lazy(() =>
  import("../pages/shared/ErrorPage").then((module) => ({
    default: module.ErrorPage,
  })),
);
export const CreatorShowcasePage = lazy(() =>
  import("../pages/admin/CreatorShowcasePage").then((m) => ({
    default: m.CreatorShowcasePage,
  })),
);
