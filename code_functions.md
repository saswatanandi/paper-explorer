# Code Structure and Functionality Guide

This document outlines the primary components, modules, and workers, detailing their responsibilities and suggested file locations (assuming a React integration within Astro).

## 1. Astro Pages

*   **File(s):** `src/pages/index.astro` (or relevant page)
*   **Purpose:** Renders the main page layout, including static content and Astro islands for dynamic sections.
*   **Key Functions:**
    *   Define overall page structure (header, footer, main content area).
    *   Include the main interactive React component (`<PaperApp client:load />`) responsible for fetching, managing state, and displaying papers.

## 2. Main React Application Component

*   **File(s):** `src/components/PaperApp.jsx`
*   **Purpose:** Orchestrates the entire client-side application logic: data loading, state management, and rendering child components.
*   **Key Functions:**
    *   Manage overall application state:
        *   `isLoading`, `loadingProgress`, `isDataReady`, `isSearchIndexReady`
        *   `papers` (currently displayed page of papers)
        *   `totalPaperCount` (for pagination, after filtering/search)
        *   `currentPage`
        *   `activeFilters` (object: `{ topic: '...', journal: '...', year: '...' }`)
        *   `searchQuery`
        *   `currentView` ('date_added', 'topic', 'journal', 'year')
        *   `availableTopics`, `availableJournals`, `availableYears` (for filter controls)
    *   Render child components (`PaperLoader`, `FilterControls`, `SearchBar`, `PaperList`).
    *   Handle the "Load Papers" action trigger.
    *   Instantiate and manage communication with Web Workers (Decompression, Search Indexing).
    *   Implement the core data fetching logic (`fetchAndProcessData`).
    *   Implement the function to query Dexie.js based on `currentView`, `activeFilters`, `searchQuery`, and `currentPage` (`getPapersFromDb`).
    *   Fetch unique filter values (`availableTopics`, etc.) from Dexie.js once data is loaded.
    *   Update state based on worker messages, user interactions (filter changes, search input, pagination clicks).

## 3. Data Loading Orchestrator Component

*   **File(s):** `src/components/PaperLoader.jsx` (May be integrated into `PaperApp.jsx`)
*   **Purpose:** Handles the user trigger to start loading, displays progress, and coordinates the fetching/decompression/DB population process.
*   **Key Functions:**
    *   Render the "Load Papers" button initially.
    *   On click, initiate the data pipeline managed by `PaperApp`.
    *   Display loading indicators (spinner, progress bar) based on state from `PaperApp`.
    *   Communicate with `PaperApp` about the loading status.

## 4. Filter Controls Component

*   **File(s):** `src/components/FilterControls.jsx`
*   **Purpose:** Displays UI elements (dropdowns, lists) for filtering by Topic, Journal, and Year.
*   **Key Functions:**
    *   Receive `availableTopics`, `availableJournals`, `availableYears`, and `activeFilters` as props from `PaperApp`.
    *   Render select dropdowns or similar UI elements.
    *   Call handler functions passed from `PaperApp` when a filter selection changes.

## 5. Search Bar Component

*   **File(s):** `src/components/SearchBar.jsx`
*   **Purpose:** Provides the text input for full-text search.
*   **Key Functions:**
    *   Render the search input field.
    *   Implement **debouncing** on the input's `onChange` event.
    *   Call a handler function passed from `PaperApp` with the debounced search query.

## 6. Paper List & Pagination Component

*   **File(s):** `src/components/PaperList.jsx`
*   **Purpose:** Displays the current page of papers and handles pagination controls.
*   **Key Functions:**
    *   Receive the current page of `papers`, `currentPage`, `totalPaperCount`, and `itemsPerPage` (10) as props from `PaperApp`.
    *   Render the list of paper items (passing data to a `PaperItem` sub-component).
    *   Calculate the total number of pages.
    *   Render pagination controls ("Previous", "Next", page numbers).
    *   Call handler functions passed from `PaperApp` when pagination controls are clicked.

## 7. Individual Paper Item Component

*   **File(s):** `src/components/PaperItem.jsx`
*   **Purpose:** Renders the details for a single paper in the list.
*   **Key Functions:**
    *   Receive a single `paper` object as a prop.
    *   Display title, authors (formatted), year, abstract snippet (optional), journal, topic(s), date added.

## 8. Dexie Database Setup

*   **File(s):** `src/db.js` (or `src/lib/db.js`)
*   **Purpose:** Defines the Dexie database instance, schema, and versioning.
*   **Key Functions:**
    *   Initialize Dexie: `const db = new Dexie('ResearchPapersDB');`
    *   Define schema and indexes using `db.version(1).stores({...})`:
        ```javascript
        db.version(1).stores({
          papers: '&unique_id, date_added, year, journal, *topic' // & enforces unique_id, * allows multi-entry for topic array
        });
        ```
    *   Export the `db` instance for use in components and workers.

## 9. Decompression Web Worker

*   **File(s):** `src/workers/decompress.worker.js`
*   **Purpose:** Runs in a separate thread to decompress Brotli data without blocking the UI.
*   **Key Functions:**
    *   Import `brotli-wasm` decompression function.
    *   Listen for `message` events containing compressed `ArrayBuffer` data from the main thread.
    *   Use `brotli-wasm`'s `decompress` function.
    *   Use `JSON.parse()` on the decompressed buffer (assuming it's UTF8 JSON).
    *   Send the resulting array of paper objects back to the main thread via `postMessage`.
    *   Implement error handling (`try...catch`) and send error messages back if decompression fails.

## 10. Search Indexing Web Worker

*   **File(s):** `src/workers/search.worker.js`
*   **Purpose:** Runs in a separate thread to build and query the FlexSearch index.
*   **Key Functions:**
    *   Import `FlexSearch`.
    *   Initialize a FlexSearch index instance: `const index = new FlexSearch.Document({ document: { id: "unique_id", index: ["title", "abstract"] } });`
    *   Listen for `message` events from the main thread:
        *   Command `add`: Receive batches of paper data (`{ unique_id, title, abstract }`) and add them to the FlexSearch index (`index.add(data)`).
        *   Command `search`: Receive a search query string. Perform the search (`index.search(query)`). Send the resulting array of matching documents (or just their `unique_id`s) back to the main thread via `postMessage`.
    *   Signal the main thread when indexing is complete or ready for searching.
    *   Implement error handling.