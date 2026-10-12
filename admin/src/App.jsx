import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from "react-router-dom";
import RequireAdmin from "./auth/AdminAuth.jsx";
import AdminLayout from "./layout/AdminLayout.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import Login from "./pages/Login.jsx";
import Overview from "./pages/Overview.jsx";
import Users from "./pages/Users.jsx";
import UserDetail from "./pages/UserDetail.jsx";
import Documents from "./pages/Documents.jsx";
import DocumentDetail from "./pages/DocumentDetail.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import Payments from "./pages/Payments.jsx";
import Plans from "./pages/Plans.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import Enquiries from "./pages/Enquiries.jsx";
import Operations from "./pages/Operations.jsx";
import Activity from "./pages/Activity.jsx";
import Templates from "./pages/Templates.jsx";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      {/* Every other screen needs an admin session and sits in the same frame */}
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/enquiries" element={<Enquiries />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/templates" element={<Templates />} />
        </Route>
      </Route>
      <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </>
  )
);

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
