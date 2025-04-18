/**
 * Web Worker for building and querying a FlexSearch index for research papers.
 */

// Note: FlexSearch doesn't have a default export, need to import specific classes/functions
// Adjust based on how FlexSearch is structured if using specific builds (e.g., 'flexsearch/dist/flexsearch.compact.js')
import FlexSearch from 'flexsearch'; 

console.log('Search Worker: Initialized.');

let index = null;
let indexReady = false;
let documentsToAdd = []; // Buffer for documents before index is ready

// Initialize the FlexSearch Document index
// Indexing 'title' and 'abstract' fields, storing 'id' for retrieval.
// Customize options as needed (e.g., tokenize, resolution)
try {
  index = new FlexSearch.Document({
    document: {
      id: "id", // Field name for the unique ID
      index: ["title", "abstract"] // Fields to index for searching
      // store: ["title"] // Optionally store fields directly in the index result
    },
    tokenize: "forward", // Example tokenizer setting
    resolution: 9 // Example resolution setting
  });
  console.log('Search Worker: FlexSearch index instance created.');
  indexReady = true; // Mark index as ready for adding documents immediately

  // Process any documents that arrived before initialization finished (unlikely with current setup, but good practice)
  if (documentsToAdd.length > 0) {
    console.log(`Search Worker: Processing ${documentsToAdd.length} buffered documents.`);
    documentsToAdd.forEach(doc => index.add(doc.id, doc)); // Use add(id, document)
    documentsToAdd = []; // Clear buffer
    self.postMessage({ type: 'indexStatus', status: 'ready' }); // Notify main thread
  }

} catch (error) {
  console.error('Search Worker: Failed to initialize FlexSearch index:', error);
  self.postMessage({ type: 'error', message: 'Failed to initialize search index.', detail: error.message });
}


// Handle messages from the main thread
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  if (!index && type !== 'init') { // Allow init even if index failed initially
      console.error('Search Worker: Index not available.');
      self.postMessage({ type: 'error', message: 'Search index is not available.' });
      return;
  }

  switch (type) {
    case 'add':
      // Add documents (papers) to the index
      // Expect payload to be an array of objects: [{ id, title, abstract }, ...]
      if (!payload || !Array.isArray(payload)) {
        console.error('Search Worker (add): Invalid payload received.');
        return;
      }
      
      if (!indexReady) {
        // If index isn't ready yet (e.g., async initialization), buffer the docs
        console.log(`Search Worker (add): Index not ready, buffering ${payload.length} documents.`);
        documentsToAdd.push(...payload);
      } else {
        console.log(`Search Worker (add): Adding ${payload.length} documents to index.`);
        try {
          // Use async add for potentially better performance with large batches
          // Note: FlexSearch add/update/remove might not be truly async in all contexts, 
          // but using await ensures completion before proceeding if it were.
          // Use add(id, document) format
          payload.forEach(doc => {
            if (doc && doc.id) { // Basic validation
              index.add(doc.id, doc); 
            } else {
              console.warn('Search Worker (add): Skipping document without ID:', doc);
            }
          });
          // Consider sending progress back for large additions
          console.log(`Search Worker (add): Finished adding batch.`);
          // Optionally signal completion of batch?
          // self.postMessage({ type: 'addComplete', count: payload.length }); 
        } catch (error) {
            console.error('Search Worker (add): Error adding documents:', error);
            self.postMessage({ type: 'error', message: 'Error adding documents to search index.', detail: error.message });
        }
      }
      break;

    case 'search':
      // Perform a search query
      // Expect payload to be an object: { query: "search terms", limit: 100 }
      if (!payload || typeof payload.query !== 'string') {
        console.error('Search Worker (search): Invalid payload received.');
        return;
      }
      
      if (!indexReady) {
          console.warn('Search Worker (search): Index not ready for searching.');
          self.postMessage({ type: 'searchResults', query: payload.query, results: [], error: 'Index not ready' });
          return;
      }

      console.log(`Search Worker (search): Searching for "${payload.query}"`);
      try {
        // Perform the search. FlexSearch search returns results based on index configuration.
        // If fields were stored, results are objects. If not, results might be just IDs.
        // The result structure is complex: an array of objects, one per indexed field, 
        // each containing a 'result' array of matching IDs or documents.
        const searchResults = await index.searchAsync(payload.query, { 
            limit: payload.limit || 100, 
            // index: ["title", "abstract"], // Specify fields to search (optional if searching all)
            // enrich: true // If you want the full stored documents back
        });

        // Process results: Flatten and deduplicate IDs from all fields searched
        const uniqueIds = new Set();
        searchResults.forEach(fieldResult => {
            if (fieldResult && Array.isArray(fieldResult.result)) {
                fieldResult.result.forEach(idOrDoc => {
                    // If enrich: true, idOrDoc is the document, otherwise it's the ID
                    const id = typeof idOrDoc === 'object' ? idOrDoc.id : idOrDoc;
                    if (id) uniqueIds.add(id);
                });
            }
        });
        const finalResultIds = Array.from(uniqueIds);

        console.log(`Search Worker (search): Found ${finalResultIds.length} unique matching document IDs.`);
        self.postMessage({ type: 'searchResults', query: payload.query, results: finalResultIds });

      } catch (error) {
        console.error(`Search Worker (search): Error during search for "${payload.query}":`, error);
        self.postMessage({ type: 'searchResults', query: payload.query, results: [], error: error.message });
      }
      break;
      
    case 'signalReady':
        // Main thread signals all data has been sent for indexing
        console.log('Search Worker: Received signal that all data has been sent.');
        // If buffering was used, ensure buffer is clear now
        if (documentsToAdd.length > 0) {
             console.warn('Search Worker: Received ready signal, but buffer still contains documents. Processing now.');
             documentsToAdd.forEach(doc => index.add(doc.id, doc));
             documentsToAdd = [];
        }
        indexReady = true; // Ensure flag is set
        self.postMessage({ type: 'indexStatus', status: 'ready' });
        console.log('Search Worker: Index is ready for searching.');
        break;

    default:
      console.warn(`Search Worker: Received unknown message type "${type}"`);
  }
};

// Optional: Handle potential errors during worker initialization or unhandled rejections
self.onerror = (event) => {
  console.error('Search Worker: Uncaught error:', event.message, event);
  // Optionally notify the main thread about a critical worker error
  // self.postMessage({ type: 'error', message: 'Critical worker error occurred.', detail: event.message });
};

self.onunhandledrejection = (event) => {
  console.error('Search Worker: Unhandled promise rejection:', event.reason);
};
