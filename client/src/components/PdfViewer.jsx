import { Document, Page, pdfjs } from "react-pdf";
import { useMemo } from "react";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

export default function PdfViewer({ fileUrl, pageNumber, onPageRender }) {
  const file = useMemo(
    () => ({
      url: encodeURI(fileUrl),
      withCredentials: false,
    }),
    [fileUrl]
  );

  return (
  <div className="relative inline-block pdf-page boarder-red-500">
    <Document file={file}>
      <Page
        pageNumber={pageNumber}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onRenderSuccess={(page) => {
          const viewport = page.getViewport({ scale: 1 });
          onPageRender({
            width: viewport.width,
            height: viewport.height,
          });
        }}
      />
    </Document>
  </div>
);

}
