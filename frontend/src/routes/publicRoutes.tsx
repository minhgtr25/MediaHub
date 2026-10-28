import { Route } from "react-router-dom";
import {
  CompanyIntakePage,
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
  PolicyPage,
  Home,
  Projects,
  Creators,
  CreatorProfile,
  CompanyExcerptPage,
  ProjectDetail,
  Services,
  ServiceDetail,
  Enquiry,
  ContentPage,
  PartnersPage,
  ProcessPage,
  PartnerDetailPage,
} from "./lazyPages";
import { PublicLayout } from "../layouts/PublicLayout";

export const publicRoutes = (
  <>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<Home />} />
      <Route
        path="/about"
        element={<ContentPage name="about" title="Về MediaHub" />}
      />
      <Route path="/privacy" element={<PolicyPage kind="privacy" />} />
      <Route path="/terms" element={<PolicyPage kind="terms" />} />
      <Route
        path="/operating-rules"
        element={<PolicyPage kind="operations" />}
      />
      <Route path="/payment-policy" element={<PolicyPage kind="payments" />} />
      <Route path="/partners" element={<PartnersPage />} />
      <Route path="/partners/:id" element={<PartnerDetailPage />} />
      <Route path="/process" element={<ProcessPage />} />
      <Route path="/services" element={<Services />} />
      <Route path="/services/:slug" element={<ServiceDetail />} />
      <Route path="/contact" element={<Enquiry contact />} />
      <Route
        path="/business-contact"
        element={<CompanyIntakePage key="business" kind="business" />}
      />
      <Route
        path="/creator-application"
        element={<CompanyIntakePage key="creator" kind="creator" />}
      />
      <Route path="/request-project" element={<Enquiry />} />
      <Route path="/portfolio" element={<Projects />} />
      <Route path="/portfolio/:id" element={<ProjectDetail />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/case/:id" element={<CompanyExcerptPage />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/creators" element={<Creators />} />
      <Route path="/creators/:slug" element={<CreatorProfile />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Route>
  </>
);
