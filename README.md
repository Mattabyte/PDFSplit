# PDF Split API - Usage Guide

## Overview
This Netlify function splits a multi-page PDF file into individual PDF files (one per page).

## Deployment
1. Deploy your site to Netlify
2. The function will be available at: `https://your-site.netlify.app/.netlify/functions/split-pdf`

## API Endpoint
- **URL**: `/.netlify/functions/split-pdf`
- **Method**: `POST`
- **Content-Type**: `application/json`

## Request Format

### Option 1: JSON with Base64 PDF
```json
{
  "pdf": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFI..."
}
```

### Option 2: Raw Binary Data
Send the PDF file directly as binary data in the request body.

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "totalPages": 3,
  "files": [
    {
      "page": 1,
      "filename": "page_1.pdf",
      "data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PA...",
      "size": 12345
    },
    {
      "page": 2,
      "filename": "page_2.pdf",
      "data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PA...",
      "size": 12890
    }
  ]
}
```

### Error Response (400/500)
```json
{
  "error": "Failed to process PDF",
  "details": "Invalid PDF format"
}
```

## Usage Examples

### JavaScript/Fetch
```javascript
// Convert file to base64 first
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// Upload and split PDF
const splitPDF = async (file) => {
  const base64 = await fileToBase64(file);
  
  const response = await fetch('/.netlify/functions/split-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pdf: base64 })
  });
  
  return await response.json();
};
```

### cURL
```bash
# First convert PDF to base64
base64_pdf=$(base64 -w 0 your-file.pdf)

curl -X POST https://your-site.netlify.app/.netlify/functions/split-pdf \
  -H "Content-Type: application/json" \
  -d "{\"pdf\":\"$base64_pdf\"}"
```

### Python
```python
import requests
import base64
import json

def split_pdf(pdf_file_path, api_url):
    # Read and encode PDF
    with open(pdf_file_path, 'rb') as f:
        pdf_data = base64.b64encode(f.read()).decode('utf-8')
    
    # Make request
    response = requests.post(
        f"{api_url}/.netlify/functions/split-pdf",
        headers={'Content-Type': 'application/json'},
        json={'pdf': pdf_data}
    )
    
    return response.json()

# Usage
result = split_pdf('document.pdf', 'https://your-site.netlify.app')
```

## Testing
1. Visit `https://your-site.netlify.app/test-pdf-split.html` for a web interface to test the function
2. Upload a PDF file and click "Split PDF"
3. Download the individual page files

## Response Data Usage
The `data` field in each file object contains the PDF file as a base64 string. To use it:

### Download in Browser
```javascript
const downloadFile = (base64Data, filename) => {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64Data}`;
  link.download = filename;
  link.click();
};
```

### Save in Node.js
```javascript
const fs = require('fs');

// Save each split PDF
result.files.forEach(file => {
  const buffer = Buffer.from(file.data, 'base64');
  fs.writeFileSync(file.filename, buffer);
});
```

## Limitations
- Maximum file size depends on Netlify function limits
- Processing time increases with PDF size and page count
- Large PDFs may timeout (Netlify functions have a 10-second timeout for free plans)

## Error Handling
- 400: Bad request (invalid or missing PDF data)
- 405: Method not allowed (only POST is accepted)
- 500: Internal server error (PDF processing failed)

Always check the `success` field in the response and handle errors appropriately.
