# Project Update

## Completed
- [x] **Ticket 1: Setup Astro Project**
  - Initialized a new Astro project with the basic directory structure
  - Created src/components, src/workers, and src/lib directories
  - Configured astro.config.mjs for GitHub Pages deployment
  - Set up basic project README.md
  - Verified development server works correctly

- [x] **Ticket 2: Add React Integration**
  - Added React integration to the Astro project using `npx astro add react`
  - Updated Astro configuration to support React components

- [x] **Ticket 3: Basic Page Layout**
  - Created src/layouts/Layout.astro for the base HTML structure
  - Implemented src/pages/index.astro with header, footer, and content area
  - Added basic styling for the page layout
  - Created a placeholder for the PaperApp React component
  - Added favicon.svg in the public directory

- [x] **Ticket 4: Create Main React Component**
  - Created src/components/PaperApp.jsx as the main React component
  - Implemented basic state management with useState hooks
  - Added initial UI for the "Load Papers" button
  - Created loading indicator with progress bar
  - Added placeholder for papers display
  - Integrated PaperApp component into index.astro with client:load directive

- [x] **Ticket 5: Add Basic State Management**
  - Enhanced src/components/PaperApp.jsx with comprehensive state variables:
    - Loading states (isLoading, loadingProgress, isDataReady, isSearchIndexReady)
    - Data states (papers, totalPaperCount, currentPage)
    - Filter and view states (activeFilters, searchQuery, currentView)
    - Available filter options (availableTopics, availableJournals, availableYears)
  - Added a temporary loading simulation for UI testing
  - Created PaperApp.css for styling the component
  - Implemented conditional rendering based on data readiness

- [x] **Ticket 6: Add "Load Papers" Button**
  - Created dedicated PaperLoader component for handling the loading process
  - Implemented src/components/PaperLoader.jsx with improved UI for the loading experience
  - Added detailed loading progress messages based on completion percentage
  - Created PaperLoader.css for component styling
  - Refactored PaperApp.jsx to use the new PaperLoader component

- [x] **Ticket 7: Implement Index File Fetching**
  - Added logic in `PaperApp.jsx` to fetch the `index.json` from the raw GitHub URL when the button is clicked.
  - Stored the base URL for the data repository.

- [x] **Ticket 8: Implement Data File Fetching**
  - Updated `PaperApp.jsx`'s `handleLoadPapers` function.
  - Parsed the `index.json` response to get the list of data file paths.
  - Constructed full URLs for each data file.
  - Implemented concurrent fetching of all data files (`YYYY.json.gz`) as `ArrayBuffer`s using `fetch` and `Promise.allSettled`.
  - Added basic logging for successful fetches and errors.
  - Updated loading progress state during the fetch process.
  - Corrected error handling for nested promises in fetch results.

- [x] **Ticket 9: Create Decompression Worker**
  - Created the worker file `src/workers/decompress.worker.js`.
  - Added basic `onmessage` handler structure to receive `ArrayBuffer` data.
  - Included placeholder logic for decompression and `postMessage` for sending results/errors back.
  - Added basic worker-level error handlers (`onerror`, `onunhandledrejection`).

- [x] **Ticket 10: Add pako**
  - Installed `pako` dependency using npm.
  - Updated `src/workers/decompress.worker.js` to import `pako`.
  - Replaced placeholder decompression logic with `pako.inflate`.
  - Added JSON parsing for the decompressed string.
  - Included basic validation for the parsed data structure.
  - Improved error handling within the worker's `try...catch` block.

- [x] **Ticket 11: Implement Worker Communication (Decompression)**
  - Added `useEffect` and `useRef` in `PaperApp.jsx` to manage the worker lifecycle.
  - Initialized `decompress.worker.js` on component mount and added termination on unmount.
  - Implemented logic in `handleLoadPapers` to send fetched `ArrayBuffer`s (using transferable objects) and unique IDs to the worker via `postMessage`.
  - Added state (`decompressionTasks`) to track the status of each file being processed by the worker.
  - Implemented the `onmessage` handler in `PaperApp.jsx` to receive results (decompressed `papersData` or errors) from the worker.
  - Aggregated successfully decompressed paper arrays into a `useRef` (`allDecompressedPapers`).
  - Updated `loadingProgress` based on the number of completed decompression tasks.
  - Added basic handling for worker errors (`onerror`).
  - Added placeholder logic for triggering the next step (DB insertion) once all worker tasks are complete.

- [x] **Ticket 12: Implement Loading Indicator (Refinement)**
  - Reviewed the existing implementation in `PaperApp.jsx`.
  - Confirmed that `isLoading` state is managed correctly (set to `true` on start, `false` on completion/error).
  - Confirmed that `loadingProgress` state is updated incrementally throughout the fetching and decompression phases.
  - Verified that these states are passed as props to the `PaperLoader` component, which handles the visual display. No further changes needed in `PaperApp.jsx` for this ticket.

- [x] **Ticket 13: Install Dexie.js**
  - Installed `dexie` and `dexie-react-hooks` dependencies using npm.

- [x] **Ticket 14: Define Dexie Schema**
  - Created `src/lib/db.js`.
  - Imported `Dexie`.
  - Initialized a new Dexie database instance named `ResearchPapersDB`.
  - Defined version 1 of the schema with the `papers` object store.
  - Set `&id` as the primary key (based on sample data).
  - Added indexes for `date_added`, `year`, `journal`, and a multi-entry index `*topic`.
  - Exported the `db` instance.

- [x] **Ticket 15: Implement Data Insertion**
  - Imported the `db` instance from `src/lib/db.js` into `PaperApp.jsx`.
  - Created a new async function `handleAllDecompressionComplete` triggered when all worker tasks finish.
  - Implemented the call to `db.papers.bulkAdd(allDecompressedPapers.current)` within this function.
  - Added `try...catch` block for handling potential `bulkAdd` errors (e.g., constraint errors).
  - Updated `loadingProgress`, `isLoading`, and `isDataReady` states upon successful or failed database insertion.
  - Cleared the `allDecompressedPapers` buffer after the operation.
  - Refactored the worker `onmessage` handler to correctly trigger the async DB insertion logic after state updates.
  - Added de-duplication logic before `bulkAdd` to handle potential duplicate paper IDs across files.
  - Added `db.papers.clear()` at the start of `handleLoadPapers` to ensure a clean state for each load attempt.

- [x] **Ticket 16: Update UI State on Data Ready**
  - Reviewed the implementation in `PaperApp.jsx`.
  - Confirmed that `setIsDataReady(true)` is correctly set within `handleAllDecompressionComplete` upon successful database insertion.
  - Confirmed that `isDataReady` remains `false` or is reset to `false` in error scenarios or when no data is loaded.
  - Verified that the component's render logic correctly uses `isDataReady` to switch between the loading view (`PaperLoader`) and the main content area. No code changes were necessary for this ticket.

- [x] **Ticket 17: Implement Default Data Query**
  - Created an async function `getPapersFromDb` in `PaperApp.jsx`.
  - Implemented Dexie query within `getPapersFromDb` to fetch the total paper count (`db.papers.count()`) and update `totalPaperCount` state.
  - Implemented Dexie query to fetch the first 10 papers sorted by `date_added` descending (`orderBy('date_added').reverse().limit(10)`) and update the `papers` state.
  - Added basic error handling for the Dexie queries.
  - Added a `useEffect` hook that triggers `getPapersFromDb` when `isDataReady` becomes `true`.
  - Added temporary display logic in the main component render to show the fetched paper count and the titles of the first page of papers.

- [x] **Ticket 18: Create Paper List Component**
  - Created `src/components/PaperList.jsx`.
  - Defined the `PaperList` functional component accepting props: `papers`, `currentPage`, `totalPaperCount`, `itemsPerPage`, `onPageChange`.
  - Added basic rendering structure within `PaperList` to display the list summary (paper count, page info).
  - Included a map function to render paper details (using temporary inline rendering, placeholder for `PaperItem`).
  - Added placeholder pagination controls structure and display logic.
  - Created optional `src/components/PaperList.css` for basic styling.
  - Imported `PaperList` into `src/components/PaperApp.jsx`.
  - Replaced the temporary paper list rendering in `PaperApp.jsx` with the `<PaperList />` component, passing necessary props (`papers`, `currentPage`, `totalPaperCount`).

- [x] **Ticket 19: Create Paper Item Component**
  - Created `src/components/PaperItem.jsx`.
  - Implemented the `PaperItem` functional component to receive a `paper` object prop.
  - Added rendering logic to display paper details: title (with optional link), formatted authors, year, journal, date added, topics, and a truncated abstract.
  - Included a helper function `formatAuthors` for better author display.
  - Created optional `src/components/PaperItem.css` for styling individual paper items.
  - Updated `src/components/PaperList.jsx` to import `PaperItem`.
  - Replaced the temporary inline rendering within `PaperList.jsx`'s map function with `<PaperItem key={paper.id} paper={paper} />`.

## Next Steps
- [x] **Ticket 20: Render Initial Paper List** 
  - Confirmed that the functionality (calling `getPapersFromDb` on data ready, storing results, passing to `PaperList`) was implemented as part of Tickets 17, 18, and 19. No separate changes needed.

- [x] **Ticket 21: Implement Pagination Logic**
  - Defined `ITEMS_PER_PAGE` constant in `PaperApp.jsx`.
  - Modified `getPapersFromDb` in `PaperApp.jsx` to accept a `page` argument and calculate the Dexie query offset using `(page - 1) * ITEMS_PER_PAGE`.
  - Updated the `useEffect` hook watching `isDataReady` to call `getPapersFromDb(1)` for the initial load.
  - Created `handlePageChange(newPage)` function in `PaperApp.jsx` to update `currentPage` state and call `getPapersFromDb(newPage)`.
  - Passed `handlePageChange` as the `onPageChange` prop to `PaperList`.
  - Updated `handlePreviousPage` and `handleNextPage` in `PaperList.jsx` to call the received `onPageChange` prop with the correct new page number.
  - Removed placeholder comments and logs from pagination handlers in `PaperList.jsx`.
  - Added `aria-label` attributes to pagination buttons for accessibility.

- [x] **Ticket 22: Fetch Unique Filter Values**
  - Created an async function `fetchFilterOptions` in `PaperApp.jsx`.
  - Implemented Dexie queries within `fetchFilterOptions` using `orderBy().uniqueKeys().toArray()` to retrieve distinct values for `topic`, `journal`, and `year` indexes.
  - Added logic to sort the fetched unique values (alphabetically for topics/journals, numerically descending for years).
  - Updated the `availableTopics`, `availableJournals`, and `availableYears` state variables with the sorted results.
  - Added error handling for the filter option queries.
  - Modified the `useEffect` hook watching `isDataReady` to call `fetchFilterOptions` alongside `getPapersFromDb(1)`.
  - Corrected Dexie query for unique keys by removing `.toArray()` and directly awaiting `uniqueKeys()`.

- [x] **Ticket 23: Create Filter Controls Component**
  - Created `src/components/FilterControls.jsx`.
  - Implemented the component to receive `available*`, `activeFilters`, and `onFilterChange` props.
  - Added `<select>` dropdowns for Topic, Journal, and Year, populated by the `available*` props.
  - Set the `value` of each select based on the `activeFilters` prop.
  - Implemented an `onChange` handler (`handleSelectChange`) that calls the `onFilterChange` prop with the filter type (name) and selected value.
  - Added default "All" options to each dropdown.
  - Created `src/components/FilterControls.css` for basic styling of the filter area.
  - Imported `FilterControls` into `src/components/PaperApp.jsx`.
  - Added a placeholder `handleFilterChange` function in `PaperApp.jsx`.
  - Rendered the `<FilterControls />` component within `PaperApp.jsx`, passing the required state variables and the placeholder handler.

- [x] **Ticket 24: Manage Filter State**
  - Updated the `handleFilterChange(filterType, value)` function in `PaperApp.jsx`.
  - Implemented the logic to update the `activeFilters` state using `setActiveFilters`, correctly setting the value for the changed `filterType` (topic, journal, or year).
  - Left placeholder comments for triggering data refetch (Ticket 25) and resetting pagination (Ticket 26) which will happen after this state update.

- [x] **Ticket 25: Apply Filters to Query**
  - Modified `getPapersFromDb` in `PaperApp.jsx` to apply filters.
  - Started with the base `db.papers` collection.
  - Used Dexie's `.filter()` method to dynamically apply active filters for `topic`, `journal`, and `year` (parsing year to integer).
  - Calculated the total paper count using `.count()` on the filtered collection.
  - Applied sorting using `.sortBy('date_added')` followed by manual reversing and pagination using `.slice()` on the filtered results (due to limitations after `.filter()`).
  - Updated `handleFilterChange` to remove direct call to `getPapersFromDb`.
  - Added a new `useEffect` hook that runs when `activeFilters` changes.
  - This effect calls `setCurrentPage(1)` and `getPapersFromDb(1)` to refetch data based on the updated filters.

- [x] **Ticket 26: Reset Pagination on Filter Change**
  - Implemented as part of Ticket 25. The `useEffect` hook triggered by `activeFilters` changes now calls `setCurrentPage(1)` before refetching data.
  - Corrected filter application logic in `getPapersFromDb` to use `collection.toArray()` followed by in-memory sorting and slicing, resolving the `sortBy` error.

- [x] **Ticket 27: Install FlexSearch**
  - Installed `flexsearch` dependency using npm.

- [x] **Ticket 28: Create Search Indexing Worker**
  - Created the worker file `src/workers/search.worker.js`.
  - Imported `FlexSearch`.
  - Initialized a `FlexSearch.Document` instance, configured to index `id`, `title`, and `abstract`.
  - Added basic `onmessage` handler structure to receive commands (`add`, `search`, `signalReady`).
  - Implemented placeholder logic within the message handler for adding documents and performing searches.
  - Included logic to `postMessage` results (`searchResults`, `indexStatus`) or errors back to the main thread.
  - Added basic worker-level error handlers (`onerror`, `onunhandledrejection`).
  - Included basic buffering logic in case documents are sent before the index is fully initialized.

- [x] **Ticket 29: Implement FlexSearch Indexing**
  - Added `searchWorker` ref to `PaperApp.jsx`.
  - Added `useEffect` hook in `PaperApp.jsx` to initialize the `search.worker.js`, handle its messages (`indexStatus`, `error`), and terminate it on unmount.
  - Created an async function `startIndexing` in `PaperApp.jsx`.
  - Modified `handleAllDecompressionComplete` to call `startIndexing` after successful Dexie `bulkAdd`.
  - Implemented logic within `startIndexing` to query Dexie for all papers (`id`, `title`, `abstract`).
  - Added logic to send the fetched data in batches (size 500) to the `searchWorker` using `postMessage` with `type: 'add'`.
  - Implemented sending a `signalReady` message to the worker after all batches are sent.
  - Updated the search worker's `onmessage` handler in `PaperApp.jsx` to set `isSearchIndexReady` state to `true` and finalize loading state when the worker posts `indexStatus: 'ready'`.
  - Adjusted `loadingProgress` updates to include the indexing phase.

- [x] **Ticket 30: Create Search Bar Component**
  - Created `src/components/SearchBar.jsx`.
  - Implemented the component with a controlled text input (`type="search"`).
  - Added `useState` for internal input value management.
  - Implemented debouncing using `useRef` and `useEffect` with `setTimeout`/`clearTimeout` to delay calling the `onSearchChange` prop.
  - Added props for `initialQuery`, `debounceDelay`, `placeholder`, and `disabled`.
  - Created `src/components/SearchBar.css` for basic styling.
  - Imported `SearchBar` into `src/components/PaperApp.jsx`.
  - Added a placeholder `handleSearchChange` function in `PaperApp.jsx`.
  - Rendered the `<SearchBar />` component within `PaperApp.jsx`, passing the placeholder handler and disabling it based on `isSearchIndexReady`.

- [x] **Ticket 31: Manage Search Query State**
  - Updated the `handleSearchChange(query)` function in `PaperApp.jsx`.
  - Implemented the call to `setSearchQuery(query)` to update the component's state with the debounced search term received from `SearchBar`.
  - Left placeholder comments for triggering the search worker query (Ticket 32) and resetting pagination (Ticket 34), which will likely be handled by a `useEffect` hook watching `searchQuery`.

- [x] **Ticket 32: Implement Search Querying (Worker)**
  - Added `searchResultIds` state (initially `null`) to `PaperApp.jsx` to store IDs from search results.
  - Updated the search worker's `onmessage` handler in `PaperApp.jsx` to process `searchResults` messages, updating `searchResultIds` state and handling potential errors. Added check for stale results.
  - Created a `useEffect` hook in `PaperApp.jsx` that watches `searchQuery` and `isSearchIndexReady`.
  - When `searchQuery` changes to a non-empty value (and index is ready), the effect sends a `search` message to the worker and sets `searchResultIds` to `null`.
  - When `searchQuery` becomes empty, the effect sets `searchResultIds` to `null` and triggers `getPapersFromDb(1)` to show the default filtered list (if results were previously active).
  - Reset pagination (`setCurrentPage(1)`) within this effect when a new search is initiated or cleared (partially addressing Ticket 34).
  - Added missing state declarations for `availableTopics`, `availableJournals`.
  - Added checks in `startIndexing` loop to prevent errors if component unmounts during batch sending.

- [x] **Ticket 33: Integrate Search Results with Filtering & Display**
  - Modified `getPapersFromDb` in `PaperApp.jsx` to handle search results.
  - If `searchResultIds` state is an array (search is active):
    - If empty, set count/papers to zero and return.
    - If non-empty, start the Dexie query using `db.papers.where('id').anyOf(searchResultIds)`.
  - If `searchResultIds` is `null` (no search), start with `db.papers`.
  - Applied active filters using `.filter()` to the collection (whether started from all papers or search results).
  - Calculated count, fetched, sorted (in-memory), and paginated the combined search+filtered results.
  - Added a new `useEffect` hook watching `searchResultIds` and `isDataReady`. When `searchResultIds` becomes an array, this effect triggers `getPapersFromDb(1)` to display the results for the first page.
  - Refactored `getPapersFromDb` to handle search results by fetching individual papers via `db.papers.get()` when search is active, resolving issues with `.toArray()` after `.anyOf()`.

- [x] **Ticket 34: Reset Pagination on Search**
  - Reviewed the `useEffect` hooks watching `searchQuery` and `searchResultIds` in `PaperApp.jsx`.
  - Confirmed that `setCurrentPage(1)` is called appropriately within these effects when a new search is initiated, cleared, or when results arrive.
  - No additional code changes were necessary for this ticket.

- [x] **Ticket 35: Implement View Switching**
  - Added view selection buttons (Date Added, Topic, Journal, Year) to `PaperApp.jsx`.
  - Implemented `handleViewChange` function to update the `currentView` state.
  - Modified `getPapersFromDb` in `PaperApp.jsx` to apply primary sorting based on `currentView` state (topic/journal alphabetically, year/date descending) after filtering/search, with `date_added` as a secondary sort key.
  - Added a `useEffect` hook watching `currentView` to reset pagination to page 1 and refetch data when the view changes.
  - Added basic styling for view controls in `PaperApp.css`.

- [x] **Ticket 36: Styling**
  - Created `src/styles/global.css` with CSS variables, base styles (typography, buttons, inputs), and utility classes.
  - Updated `src/layouts/Layout.astro` to import `global.css` and removed inline global styles.
  - Refactored `PaperApp.css`: Applied container styles, refined heading/control area layout and view button styles.
  - Refactored `PaperLoader.css`: Applied card styling, updated button and progress bar styles to match the theme.
  - Refactored `FilterControls.css`: Used grid layout, updated label/select styles inheriting from global styles.
  - Refactored `SearchBar.css`: Updated input styles inheriting from global styles.
  - Refactored `PaperList.css`: Updated list summary and pagination control styles.
  - Refactored `PaperItem.css`: Applied card styling, improved typography, spacing, and added subtle borders/backgrounds for better visual structure.

## Next Steps
- Ticket 37: Build & Deploy: Configure Astro build for GitHub Pages deployment.
