import { Route } from "react-router-dom";
import { MessengerPage } from "./lazyPages";
import { AuthenticatedRoute } from "../contexts/AuthContext";

export const authenticatedRoutes = (
  <>
    <Route element={<AuthenticatedRoute />}>
      <Route path="/messages" element={<MessengerPage />} />
      <Route path="/messages/:id" element={<MessengerPage />} />
    </Route>
  </>
);
