import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import FieldPalette from "../components/FieldPalette";
import DraggableField from "../components/DraggableField";
import SignatureUpload from "../components/SignatureUpload";
import API from "../api/axios";
import { useSelector } from "react-redux";

export default function PdfEditor() {
  const { pdfId } = useParams();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fields, setFields] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });
  const [signatureUrl, setSignatureUrl] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  const accessToken = useSelector((state) => state.auth.accessToken);

  console.log("PdfEditor init " + JSON.stringify({ pdfId, accessToken }));

  useEffect(() => {
    console.log("PdfEditor useEffect start " + JSON.stringify({ pdfId, accessToken }));
    if (!accessToken) {
      console.log("PdfEditor useEffect exit: no accessToken");
      return;
    }

    const fetchPdf = async () => {
      try {
        console.log("PdfEditor fetching PDF " + JSON.stringify({ pdfId }));
        const res = await API.get(`/pdf/${pdfId}`);
        console.log("PdfEditor fetchPdf response " + JSON.stringify(res?.data));
        const url = `http://localhost:5000${res.data.data.url}`;
        setPdfUrl(url);
        console.log("PdfEditor setPdfUrl " + JSON.stringify({ url }));
      } catch (error) {
        console.error("Error fetching PDF:", error);
        alert("Error loading PDF. Please try again.");
      }
    };

    fetchPdf();
  }, [pdfId, accessToken]);

  const handlePageRender = ({ width, height }) => {
    console.log("handlePageRender " + JSON.stringify({ width, height }));
    setPageDims({ width, height });
  };

  const addField = (type) => {
    const newField = {
      id: crypto.randomUUID(),
      type,
      page: currentPage,
      xPercent: 0.1,
      yPercent: 0.1,
      widthPercent: 0.2,
      heightPercent: 0.08,
      value: type === "date" ? new Date().toLocaleDateString() : "",
      checked: false,
      signatureUrl: "",
    };
    console.log("addField " + JSON.stringify({ type, newField }));
    setFields((prev) => [...prev, newField]);
  };

  const updateField = (updatedField) => {
    console.log("updateField " + JSON.stringify({ updatedField }));
    setFields((all) => all.map((x) => (x.id === updatedField.id ? updatedField : x)));
  };

  const signPdf = async () => {
    try {
      console.log("signPdf start " + JSON.stringify({ pdfId, fieldsCount: fields.length, signatureUrl }));
      setIsSigning(true);

      // Validate fields
      const hasEmptyTextFields = fields.some((f) => f.type === "text" && !f.value.trim());
      console.log("signPdf validation: hasEmptyTextFields " + JSON.stringify({ hasEmptyTextFields }));

      if (hasEmptyTextFields) {
        console.warn("signPdf abort: empty text fields");
        alert("Please fill in all text fields before signing.");
        setIsSigning(false);
        return;
      }

      const hasSignatureFields = fields.some((f) => f.type === "signature");
      const hasSignature = hasSignatureFields && signatureUrl;
      console.log("signPdf signature check " + JSON.stringify({ hasSignatureFields, hasSignature }));

      if (hasSignatureFields && !hasSignature) {
        console.warn("signPdf abort: missing signature");
        alert("Please upload a signature before signing.");
        setIsSigning(false);
        return;
      }

      // Add signature URL to signature fields
      const fieldsWithSignature = fields.map((f) => (f.type === "signature" ? { ...f, signatureUrl } : f));
      console.log("signPdf fieldsWithSignature " + JSON.stringify({ fieldsWithSignature }));

      console.log("signPdf posting to /pdf/sign " + JSON.stringify({ pdfId, fieldsCount: fieldsWithSignature.length }));
      const response = await API.post("/pdf/sign", { pdfId, fields: fieldsWithSignature });
      console.log("signPdf response " + JSON.stringify(response?.data));

      // Download the signed PDF
      const url = `http://localhost:5000${response.data.data.signedPdfUrl}`;
      console.log("signPdf signed PDF url " + JSON.stringify({ url }));
      window.open(url, "_blank", "noopener,noreferrer");


      console.log("signPdf success - download triggered");
      alert("PDF signed and downloaded successfully!");
    } catch (error) {
      console.error("Error signing PDF: " + (error?.stack || error?.message || JSON.stringify(error)));
      alert(error.response?.data?.message || "Error signing PDF. Please try again.");
    } finally {
      console.log("signPdf finished, clearing isSigning");
      setIsSigning(false);
    }
  };

  if (!pdfUrl) {
    console.log("PdfEditor render: loading PDF");
    return <p>Loading PDF...</p>;
  }

  return (
    <div className="flex gap-6">
      <div className="space-y-4">
        <FieldPalette onAdd={addField} />

        <SignatureUpload
          onUploaded={(url) => {
            console.log("SignatureUpload onUploaded " + JSON.stringify({ url }));
            setSignatureUrl(url);
            setFields((prev) =>
              prev.map((f) =>
                f.type === "signature" && !f.signatureUrl
                  ? (console.log("updating signature field " + JSON.stringify({ fieldId: f.id, url })), { ...f, signatureUrl: url })
                  : f
              )
            );
          }}
        />

        <button
          onClick={signPdf}
          disabled={isSigning}
          className="w-full bg-green-600 text-white py-2 rounded disabled:bg-gray-400"
        >
          {isSigning ? "Signing..." : "Sign & Save"}
        </button>
      </div>

      <div className="relative inline-block">
  <PdfViewer
    fileUrl={pdfUrl}
    pageNumber={currentPage}
    onPageRender={handlePageRender}
  />
{console.log("PdfEditor render state " + JSON.stringify({ currentPage, pageDims, fieldsCount: fields.length }))}

  {/* OVERLAY LAYER – SAME SIZE AS PDF */}
  <div
    className="absolute top-0 left-0"
    style={{
      width: pageDims.width,
      height: pageDims.height,
    }}
  >
    {fields
      .filter((f) => f.page === currentPage)
      .map((f) => (
        <DraggableField
          key={f.id}
          field={f}
          pageWidth={pageDims.width}
          pageHeight={pageDims.height}
          onUpdate={updateField}
        />
      ))}
  </div>
</div>

    </div>
  );
}