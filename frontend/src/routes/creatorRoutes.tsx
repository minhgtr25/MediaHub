import { Route, Navigate } from "react-router-dom";
import {
  CreatorDashboard,
  CreatorWorkspacePage,
  Profile,
  Notifications,
} from "./lazyPages";
import { CreatorRoute } from "../contexts/AuthContext";
import { CreatorLayout } from "../layouts/WorkspaceLayouts";

export const creatorRoutes = (
  <>
    <Route element={<CreatorRoute />}>
      <Route path="/creator" element={<CreatorLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CreatorDashboard />} />
        <Route path="assignments/:id" element={<CreatorWorkspacePage />} />
        <Route path="requests/:id" element={<CreatorWorkspacePage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Route>
  </>
);
