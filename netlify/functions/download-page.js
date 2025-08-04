exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const sessionId = queryParams.session;
    const pageIndex = parseInt(queryParams.page);

    if (!sessionId || pageIndex === undefined || isNaN(pageIndex)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing session or page parameter' }),
      };
    }

    // Check if session exists
    if (!global.pdfSessions || !global.pdfSessions[sessionId]) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found or expired' }),
      };
    }

    // Check if page exists
    const pdfBytes = global.pdfSessions[sessionId][pageIndex];
    if (!pdfBytes) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Page not found' }),
      };
    }

    // Return the PDF page as binary data
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="page_${pageIndex + 1}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
      body: Buffer.from(pdfBytes).toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Download function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to download page',
        details: error.message 
      }),
    };
  }
};