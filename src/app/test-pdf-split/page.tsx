'use client'

import { useState, useRef } from 'react'

interface SplitFile {
  page: number
  filename: string
  data: string
  size: number
}

interface SplitResult {
  success: boolean
  totalPages: number
  files: SplitFile[]
  error?: string
  details?: string
}

export default function TestPDFSplit() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SplitResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0])
      setResult(null)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const files = event.dataTransfer.files
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setSelectedFile(files[0])
      setResult(null)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data:application/pdf;base64, prefix
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = error => reject(error)
    })
  }

  const splitPDF = async () => {
    if (!selectedFile) return

    setLoading(true)
    setResult(null)

    try {
      // Convert file to base64
      const base64 = await fileToBase64(selectedFile)

      // Call the Netlify function
      const response = await fetch('/.netlify/functions/split-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdf: base64 })
      })

      const data: SplitResult = await response.json()
      setResult(data)

    } catch (error) {
      setResult({
        success: false,
        totalPages: 0,
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = (base64Data: string, filename: string) => {
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${base64Data}`
    link.download = filename
    link.click()
  }

  const downloadAll = (files: SplitFile[]) => {
    files.forEach((file, index) => {
      setTimeout(() => downloadFile(file.data, file.filename), index * 100)
    })
  }

  const clearResults = () => {
    setResult(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <h1 className="text-3xl font-bold mb-4">PDF Split Function Test</h1>
      <p className="mb-6 text-gray-600">Upload a PDF file to split it into individual pages.</p>
      
      <div 
        className={`border-2 border-dashed rounded-lg p-10 text-center mb-4 transition-colors cursor-pointer ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {selectedFile ? (
          <p className="text-green-600">Selected: {selectedFile.name}</p>
        ) : (
          <>
            <p className="mb-4">Drag and drop a PDF file here, or click to select</p>
            <button 
              type="button"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Select PDF File
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={splitPDF}
          disabled={!selectedFile || loading}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Split PDF
        </button>
        <button
          onClick={clearResults}
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition-colors"
        >
          Clear Results
        </button>
      </div>
      
      {loading && (
        <div className="text-center mb-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2">Processing PDF...</p>
        </div>
      )}
      
      {result && (
        <div className="mt-6">
          {result.success ? (
            <>
              <h3 className="text-xl font-semibold mb-4">
                Split Complete! Total Pages: {result.totalPages}
              </h3>
              
              <div className="grid gap-4 mb-6">
                {result.files.map((file, index) => (
                  <div key={index} className="border rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold">{file.filename}</h4>
                      <p className="text-gray-600">Size: {(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button
                      onClick={() => downloadFile(file.data, file.filename)}
                      className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => downloadAll(result.files)}
                className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600 transition-colors"
              >
                Download All
              </button>
            </>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 font-semibold">Error: {result.error}</p>
              {result.details && (
                <p className="text-red-500 mt-2">Details: {result.details}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}