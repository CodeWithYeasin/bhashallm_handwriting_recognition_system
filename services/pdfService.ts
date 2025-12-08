import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFPageImage {
  dataUrl: string;
  pageNumber: number;
  width: number;
  height: number;
}

export const processPDF = async (file: File): Promise<PDFPageImage[]> => {
  console.log("processPDF: Starting PDF processing", {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      console.log("processPDF: PDF loaded", {
        numPages: pdf.numPages
      });

      const pageImages: PDFPageImage[] = [];

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`processPDF: Processing page ${pageNum}/${pdf.numPages}`);

        const page = await pdf.getPage(pageNum);

        // Set up canvas for rendering
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not get canvas context');
        }

        // Calculate scale for high quality rendering
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        await page.render(renderContext).promise;

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png', 0.95); // High quality PNG

        pageImages.push({
          dataUrl,
          pageNumber: pageNum,
          width: viewport.width,
          height: viewport.height,
        });

        console.log(`processPDF: Page ${pageNum} processed`, {
          width: viewport.width,
          height: viewport.height,
          dataUrlLength: dataUrl.length
        });
      }

      console.log("processPDF: PDF processing complete", {
        totalPages: pageImages.length
      });

      resolve(pageImages);
    } catch (error) {
      console.error("processPDF: Error processing PDF", error);
      reject(error);
    }
  });
};

export const isPDFFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
};