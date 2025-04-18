/**
 * Web Worker for decompressing Gzip data (e.g., .json.gz files).
 * Uses pako library (expected to be available).
 * Uses pako library (expected to be available).
 */

import pako from 'pako';

console.log('Decompression Worker: Initialized.');

self.onmessage = async (event) => {
  const { id, arrayBuffer, filePath } = event.data; // Expect an ID, the buffer, and the original path for context

  if (!arrayBuffer) {
    console.error('Decompression Worker: Received message without arrayBuffer.');
    self.postMessage({ id, error: 'No arrayBuffer received', filePath });
    return;
  }

  console.log(`Decompression Worker: Received data for ${filePath} (ID: ${id}, ${arrayBuffer.byteLength} bytes). Starting decompression...`);

  try {
    // Decompress the ArrayBuffer using pako
    // Convert ArrayBuffer to Uint8Array for pako
    const uint8Array = new Uint8Array(arrayBuffer);
    // Inflate (decompress Gzip) and convert the result to a UTF-8 string
    const decompressedString = pako.inflate(uint8Array, { to: 'string' });

    // Parse the JSON string
    const papersData = JSON.parse(decompressedString);

    // Validate the expected structure (optional but recommended)
    if (!papersData || !Array.isArray(papersData.papers)) {
        throw new Error('Invalid data structure after decompression. Expected { papers: [...] }');
    }

    console.log(`Decompression Worker: Decompression successful for ${filePath} (ID: ${id}). Found ${papersData.papers.length} papers.`);
    // Send the decompressed data (the object containing the papers array) back to the main thread
    self.postMessage({ id, papersData, filePath });

  } catch (error) {
    console.error(`Decompression Worker: Error processing ${filePath} (ID: ${id}):`, error);
    // Send error details back to the main thread
    self.postMessage({ id, error: error.message || 'Decompression failed', filePath });
  }
};

// Optional: Handle potential errors during worker initialization or unhandled rejections
self.onerror = (event) => {
  console.error('Decompression Worker: Uncaught error:', event.message, event);
};

self.onunhandledrejection = (event) => {
  console.error('Decompression Worker: Unhandled promise rejection:', event.reason);
};
