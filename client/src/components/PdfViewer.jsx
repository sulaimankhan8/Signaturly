import { Document, Page, pdfjs } from "react-pdf";
import { useMemo, useRef } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

export default function PdfViewer({ fileUrl, pageNumber, onPageRender }) {
  const containerRef = useRef(null);
  const file = useMemo(
    () => ({
      url: encodeURI(fileUrl),
      withCredentials: false,
    }),
    [fileUrl]
  );

  const handleRenderSuccess = () => {
    if (containerRef.current) {
      const canvas = containerRef.current.querySelector("canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        onPageRender({
          width: rect.width || canvas.offsetWidth,
          height: rect.height || canvas.offsetHeight,
        });
      }
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block pdf-page shadow-2xl rounded-lg overflow-hidden border border-gray-700 bg-white">
      <Document file={file}>
        <Page
          pageNumber={pageNumber}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={handleRenderSuccess}
        />
      </Document>
    </div>
  );
}
