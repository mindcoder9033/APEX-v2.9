import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function inspect() {
  try {
    const pdfBytes = fs.readFileSync('Track_Day_Session_Report (9).pdf');
    const doc = await PDFDocument.load(pdfBytes);
    console.log('Page count:', doc.getPageCount());
    
    // Let's print the first page's text if possible, or some metadata
    const title = doc.getTitle();
    const author = doc.getAuthor();
    console.log('Title:', title);
    console.log('Author:', author);
    
    const pages = doc.getPages();
    pages.forEach((page, index) => {
      console.log(`Page ${index + 1} dimensions:`, page.getWidth(), 'x', page.getHeight());
    });
  } catch (err) {
    console.error('Error inspecting PDF:', err);
  }
}

inspect();
