import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UploadPdf from "./pages/UploadPdf";
import HomeRedirect from "./pages/HomeRedirect";
import PdfEditor from "./pages/PdfEditor";
import SignatureRemover from "./pages/RemoveBg";
import { hydrateAuth } from "./store/authActions";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

export default function App() {
  const dispatch = useDispatch();

  // 🔁 Restore auth state on reload
  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/upload" element={<UploadPdf />} />
        <Route path="/signature-remover" element={<SignatureRemover />} />
      <Route path="/editor/:pdfId" element={<PdfEditor />} />
      </Routes>
    </BrowserRouter>
  );
}
