import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UploadPdf from "./pages/UploadPdf";
import HomeRedirect from "./pages/HomeRedirect";
import Dashboard from "./pages/Dashboard";
import PdfEditor from "./pages/PdfEditor";
import SendDocument from "./pages/SendDocument";
import AssignFields from "./pages/AssignFields";
import SigningPage from "./pages/SigningPage";
import SignatureRemover from "./pages/RemoveBg";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";
import UseTemplate from "./pages/UseTemplate";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import BulkSend from "./pages/BulkSend";
import Landing from "./pages/Landing";
import { hydrateAuth } from "./store/authActions";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

export default function App() {
  const dispatch = useDispatch();

  // Restore auth state on reload
  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/upload" element={<UploadPdf />} />
        <Route path="/signature-remover" element={<SignatureRemover />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/bulk" element={<BulkSend />} />
        <Route path="/templates/edit/:templateId" element={<TemplateEditor />} />
        <Route path="/templates/use/:templateId" element={<UseTemplate />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/editor/:pdfId" element={<PdfEditor />} />
        <Route path="/send/:pdfId" element={<SendDocument />} />
        <Route path="/assign/:pdfId" element={<AssignFields />} />
        <Route path="/sign/:token" element={<SigningPage />} />
      </Routes>
    </BrowserRouter>
  );
}

