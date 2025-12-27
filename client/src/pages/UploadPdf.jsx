import { uploadPdfApi } from "../api/pdf.api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function UploadPdf() {
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const upload = async () => {
    if (!file) {
      alert("Please select a PDF");
      return;
    }

    const data = await uploadPdfApi(file);
    console.log("Uploaded PDF data:", data);
    
    navigate(`/editor/${data.id}`);
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={upload}>Upload PDF</button>
    </div>
  );
}
