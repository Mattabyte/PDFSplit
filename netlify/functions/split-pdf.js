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
    // Parse the request body - now optimized to handle binary data efficiently
    let pdfBuffer;
    
    if (event.isBase64Encoded) {
      // If the PDF is already base64 encoded (fallback for older clients)
      pdfBuffer = Buffer.from(event.body, 'base64');
    } else {
      // Check content type to determine how to handle the body
      const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
      
      if (contentType.includes('application/pdf')) {
        // Handle binary PDF data directly (most efficient)
        pdfBuffer = Buffer.from(event.body, 'binary');
      } else if (contentType.includes('application/json')) {
        // Handle JSON with base64 data (legacy fallback)
        try {
          const parsedBody = JSON.parse(event.body);
          if (parsedBody.pdf) {
            pdfBuffer = Buffer.from(parsedBody.pdf, 'base64');
          } else {
            throw new Error('No PDF data found in JSON body');
          }
        } catch (jsonError) {
          throw new Error('Invalid JSON format: ' + jsonError.message);
        }
      } else {
        // Default to binary data
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

    // Log file size for debugging
    console.log(`Processing PDF file of size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    // Check if file is too large (Netlify has a 6MB limit)
    const maxSize = 6 * 1024 * 1024; // 6MB
    if (pdfBuffer.length > maxSize) {
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify({ 
          error: 'PDF file too large', 
          details: `File size ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of 6MB` 
        }),
      };
    }

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    // Generate a session ID for this split operation
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    const splitPdfs = [];

    // Split the PDF into individual pages and return metadata only
    for (let i = 0; i < pageCount; i++) {
      // Create a new PDF document
      const newPdfDoc = await PDFDocument.create();
      
      // Copy the page to the new document
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
      newPdfDoc.addPage(copiedPage);

      // Serialize the PDF
      const pdfBytes = await newPdfDoc.save();
      
      // Store pages in global variable for this session (temporary solution)
      if (!global.pdfSessions) {
        global.pdfSessions = {};
      }
      if (!global.pdfSessions[sessionId]) {
        global.pdfSessions[sessionId] = {};
      }
      
      global.pdfSessions[sessionId][i] = pdfBytes;
      
      // Return metadata with download URL instead of data
      splitPdfs.push({
        page: i + 1,
        filename: `page_${i + 1}.pdf`,
        downloadUrl: `/.netlify/functions/download-page?session=${sessionId}&page=${i}`,
        size: pdfBytes.length
      });
    }

    // Clean up session after 10 minutes
    setTimeout(() => {
      if (global.pdfSessions && global.pdfSessions[sessionId]) {
        delete global.pdfSessions[sessionId];
      }
    }, 10 * 60 * 1000);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        totalPages: pageCount,
        files: splitPdfs,
        sessionId: sessionId
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