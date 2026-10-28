import { Route } from "react-router-dom";
import { NotFound, ErrorPage } from "./lazyPages";

export const errorRoutes = (
  <>
    <Route path="/403" element={<ErrorPage kind="403" />} />
    <Route path="/500" element={<ErrorPage kind="500" />} />
    <Route path="/network-error" element={<ErrorPage kind="network" />} />
    <Route path="/session-expired" element={<ErrorPage kind="session" />} />
    <Route path="*" element={<NotFound />} />
  </>
);
