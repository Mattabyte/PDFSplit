const { PDFDocument } = require('pdf-lib');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the request body - expect base64 encoded PDF
    let pdfBuffer;
    
    if (event.isBase64Encoded) {
      // If the PDF is already base64 encoded
      pdfBuffer = Buffer.from(event.body, 'base64');
    } else {
      // Try to parse as JSON first (for base64 in JSON)
      try {
        const parsedBody = JSON.parse(event.body);
        if (parsedBody.pdf) {
          pdfBuffer = Buffer.from(parsedBody.pdf, 'base64');
        } else {
          throw new Error('No PDF data found in JSON body');
        }
      } catch (jsonError) {
        // If JSON parsing fails, assume the body is the raw PDF data
        pdfBuffer = Buffer.from(event.body, 'binary');
      }
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No PDF data provided' }),
      };
    }

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    const splitPdfs = [];

    // Split the PDF into individual pages
    for (let i = 0; i < pageCount; i++) {
      // Create a new PDF document
      const newPdfDoc = await PDFDocument.create();
      
      // Copy the page to the new document
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
      newPdfDoc.addPage(copiedPage);

      // Serialize the PDF
      const pdfBytes = await newPdfDoc.save();
      
      // Convert to base64 for response
      const base64Pdf = Buffer.from(pdfBytes).toString('base64');
      
      splitPdfs.push({
        page: i + 1,
        filename: `page_${i + 1}.pdf`,
        data: base64Pdf,
        size: pdfBytes.length
      });
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        totalPages: pageCount,
        files: splitPdfs
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to process PDF',
        details: error.message 
      }),
    };
  }
};