import { useState } from "react";

export default function SignatureUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Url = evt.target.result;
      setPreview(base64Url);
      // Immediately notify parent with base64 Data URL so signatures work instantly!
      onUploaded(base64Url);
    };
    reader.readAsDataURL(selectedFile);
  };

  const uploadToCloudinary = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "suleman");

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dez68hqzq/image/upload",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      if (data.secure_url) {
        onUploaded(data.secure_url);
      } else if (data.url) {
        onUploaded(data.url);
      }
    } catch (error) {
      console.error("Cloudinary upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer"
      />

      {preview && (
        <div className="bg-white p-2 rounded-lg border border-gray-700 flex flex-col items-center">
          <img
            src={preview}
            className="max-h-20 object-contain"
            alt="Signature preview"
          />
          <span className="text-[10px] text-green-600 font-semibold mt-1">Signature Attached</span>
        </div>
      )}
    </div>
  );
}