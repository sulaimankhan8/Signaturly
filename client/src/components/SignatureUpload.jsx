import { useState } from "react";

export default function SignatureUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);

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
      console.log("Cloudinary upload response:", data);
      
      // Check if the response contains the secure_url
      if (data.secure_url) {
        onUploaded(data.secure_url);
      } else if (data.url) {
        // Fallback to url if secure_url is not available
        onUploaded(data.url);
      } else {
        console.error("No URL found in response:", data);
        alert("Error uploading signature. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading signature. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/png"
        onChange={(e) => {
          const selectedFile = e.target.files[0];
          if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
          }
        }}
      />

      {preview && (
        <img
          src={preview}
          className="h-20 border rounded"
          alt="Signature preview"
        />
      )}

      <button
        onClick={uploadToCloudinary}
        disabled={uploading || !file}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {uploading ? "Uploading..." : "Upload Signature"}
      </button>
    </div>
  );
}