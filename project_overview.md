# Project Overview: Astro Static Site for Research Papers

## 1. Goal

To create a static website using Astro, hosted on GitHub Pages, to display a large collection (10,000-20,000) of research papers. Data resides in a separate GitHub repository as yearly Brotli-compressed JSON files (`YYYY.json.br`) plus an index file listing them. The site must fetch, decompress, store, and index this data entirely client-side at runtime, supporting various views (topic, journal, year, date added) and full-text search (title, abstract) without pre-built indexes or views.

## 2. Core Architecture

*   **Static Site Generator:** Astro.
*   **Hosting:** GitHub Pages.
*   **Client-Side Interactivity:** Astro islands using a UI framework (**React** assumed) with `client:load` or `client:idle` directives.
*   **Data Storage:** Browser's **IndexedDB** managed via **Dexie.js**.
*   **Background Processing:** **Web Workers** for CPU-intensive tasks (decompression, search indexing).
*   **Runtime Data Fetching:** Data fetched from the separate raw GitHub content URL *after* initial page load.
*   **No Server/Backend:** All logic runs in the user's browser.

## 3. Data Pipeline (Client-Side, Runtime)

1.  **Initial Load:** Astro renders the basic page structure (header, controls placeholder, empty content area). No paper data is loaded initially.
2.  **User Trigger:** User clicks a "Load Papers" button (or similar).
3.  **Fetch Index:** Client-side script fetches the `index.json` file from the data repository to get the list of `YYYY.json.gz` files.
4.  **Fetch Compressed Data:** Concurrently fetch all listed `YYYY.json.gz` files as `ArrayBuffer`s using the `fetch` API.
5.  **Decompression (Worker):**
    *   Send each fetched `ArrayBuffer` to a dedicated Decompression Web Worker.
    *   Worker uses `pako` or `fflate` to decompress (Gzip/Deflate) the data.
    *   Worker sends the resulting JSON array (papers for that year) back to the main thread.
6.  **Populate IndexedDB:**
    *   Main thread receives decompressed paper arrays.
    *   Uses `Dexie.js` (`db.papers.bulkAdd()`) to efficiently store papers in the `papers` object store in IndexedDB.
    *   Update UI to show loading progress.
7.  **Build Search Index (Worker):**
    *   Once data starts arriving (or after all data is in IndexedDB), fetch necessary fields (`id`, `title`, `abstract`) from IndexedDB.
    *   Send this data in batches to a dedicated Search Indexing Web Worker.
    *   Worker uses `FlexSearch` to build the full-text search index.
    *   Worker signals the main thread when indexing is complete (or usable).
8.  **UI Ready:** Once enough data is in IndexedDB for the initial view, enable UI interactions (displaying default list, filters, search).

## 4. Key Technologies

*   **Astro:** Static site generation.
*   **React (or Vue/Svelte):** Client-side UI components and state management within Astro islands.
*   **Dexie.js:** Wrapper for IndexedDB for easier database operations.
*   **Web Workers:** Offload decompression and search indexing from the main thread.
*   **pako:** Performant decompression in the browser (via Worker).
*   **FlexSearch:** Performant client-side full-text search library (via Worker).
*   **Fetch API:** Retrieve data from the external GitHub repository.

## 5. User Interface & Functionality

*   **Initial State:** Landing page with controls but no paper data displayed. A "Load Papers" button initiates the data pipeline.
*   **Loading State:** Visual indicators (e.g., progress bar, spinner) while data is fetched, decompressed, and stored/indexed.
*   **Default View:** Once loaded, displays the first 10 papers sorted by `date_added` (newest first).
*   **Pagination:** "Next" / "Previous" or page number controls to navigate through paper lists (10 papers per page).
*   **Views:** Buttons/tabs to switch between:
    *   All Papers (sorted by `date_added`)
    *   By Topic (user selects topic, list updates, sorted by `date_added`)
    *   By Journal (user selects journal, list updates, sorted by `date_added`)
    *   By Year (user selects year, list updates, sorted by `date_added`)
*   **Filtering:** Dropdowns/multi-selects for Topic, Journal, Year. These filters apply to the *current view* (including search results). Selecting a filter re-queries IndexedDB and updates the list + pagination.
*   **Search:**
    *   Input field for full-text search (titles, abstracts).
    *   Uses **debouncing** to avoid excessive searching on keypress.
    *   Search queries the FlexSearch index (in Worker) to get matching `id`s.
    *   Main thread uses these IDs to query IndexedDB, *applies active filters*, sorts by `date_added`, and displays results with pagination.

## 6. IndexedDB Schema (`papers` store via Dexie.js)

*   **Primary Key:** `id` (Assuming it's unique and provided).
*   **Indexed Fields:**
    *   `date_added`: For default sorting and date-based views.
    *   `year`: For year-wise view and filtering.
    *   `journal`: For journal-wise view and filtering (assuming a single `journal` field exists).
    *   `topic`: For topic-wise view and filtering. Use **multi-entry index** (`*topic`) if a paper can have multiple topics stored as an array.
*   **Other Fields:** `title`, `authors` (array of objects or strings), `abstract`, `citation`, etc. (Store all relevant metadata).

## 7. Performance Considerations

*   **Deferred Loading:** Data loading triggered by user action.
*   **Chunking:** Data is already chunked by year, reducing initial fetch size per file. Fetching happens concurrently.
*   **Web Workers:** Prevent UI blocking during decompression and indexing.
*   **Efficient DB Writes:** Use `Dexie.js` `bulkAdd()`.
*   **Indexed Queries:** Leverage IndexedDB indexes for fast filtering and sorting.
*   **Pagination:** Limit DOM nodes by only rendering 10 papers at a time.
*   **Search Debouncing:** Reduce load during search input.
*   **Optimized Search Index:** FlexSearch is designed for performance; indexing only necessary fields (`title`, `abstract`).

## 8. Potential Challenges

*   **CORS:** Fetching from `raw.githubusercontent.com` (separate repo) requires permissive CORS headers on the *data* repo's hosting. GitHub Pages usually provides `Access-Control-Allow-Origin: *` for public repos, but this needs testing, especially with custom domains.
*   **Browser Storage Limits:** IndexedDB has limits, though generally large (can vary by browser). 10-20k papers might push limits over time, but should be feasible.
*   **Memory Usage:** Building the search index and holding data in memory (even temporarily) can consume significant RAM. Workers help, but efficient data handling is key.
*   **Initial Indexing Time:** Building the FlexSearch index for 20k papers might take noticeable time on slower devices, even in a worker. Provide clear progress indication.

## Other info:
master github url:  https://github.com/saswatanandi/paper-explorer-data
file :: index.json sample file >>
{
  "files": [
    "papers/2024.json.gz",
    ...
  ],
  "totalCount": 1,
  "lastUpdated": "2025-04-10"
}

file :: papers/2024.json.bz sample >>
{
  "papers": [
    {
      "id": "ddfe7eef5e5bec910a817289365f2925",
      "year": 2021,
      "authors": [
        {
          "first_name": "M",
          "last_name": "Peichl"
        },
        {
          "first_name": "S",
          "last_name": "Thober"
        },
        {
          "first_name": "L",
          "last_name": "Samaniego"
        },
        {
          "first_name": "B",
          "last_name": "Hansj\u00fcrgens"
        },
        {
          "first_name": "A",
          "last_name": "Marx"
        }
      ],
      "title": "Machine-learning methods to assess the effects of a non-linear damage spectrum taking into account soil moisture on winter wheat yields in Germany",
      "journal": "Hydrology and Earth System Sciences",
      "citations": 24,
      "abstract": "Agricultural production is ...",
      "url": "https://hess.copernicus.org/articles/25/6523/2021/hess-25-6523-2021.html",
      "date_added": "2025-04-10",
      "topic": [
        "agriculture"
      ]
    },
    {
    ...
    },
    .
    .
    .
    ]
 }

 * though not strictly required by this specific ticket, if something is important and can help overall improving the project, consider that.