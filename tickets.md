# Project Implementation Tickets

This list breaks down the development into actionable steps. Execute them sequentially or in parallel where appropriate.

## Phase 1: Project Setup & Basic Structure

1.  **[Ticket 1]** Setup Astro Project: Initialize a new Astro project.
2.  **[Ticket 2]** Add React Integration: Use `astro add react` (or Vue/Svelte if preferred).
3.  **[Ticket 3]** Basic Page Layout: Create the main Astro page (`src/pages/index.astro`) with header, footer, and a placeholder content area.
4.  **[Ticket 4]** Create Main React Component: Stub out `src/components/PaperApp.jsx` and include it in `index.astro` using `<PaperApp client:load />`.
5.  **[Ticket 5]** Add Basic State Management: Initialize basic state variables (e.g., `isLoading`, `isDataReady`) in `PaperApp.jsx`.
6.  **[Ticket 6]** Add "Load Papers" Button: Implement the initial trigger button (e.g., in `PaperLoader.jsx` rendered by `PaperApp.jsx`).

## Phase 2: Data Fetching & Decompression

7.  **[Ticket 7]** Implement Index File Fetching: Add logic in `PaperApp.jsx` to fetch the `index.json` from the raw GitHub URL when the button is clicked.
8.  **[Ticket 8]** Implement Data File Fetching: Add logic to parse the index file response and concurrently fetch all `YYYY.json.gz` files as `ArrayBuffer`s. Handle potential fetch errors.
9.  **[Ticket 9]** Create Decompression Worker: Set up `src/workers/decompress.worker.js`.
10. **[Ticket 10]** Add pako: Install `pako` (or alternative) and import/use it within the decompression worker.
11. **[Ticket 11]** Implement Worker Communication (Decompression):
    *   In `PaperApp.jsx`: Instantiate the worker, send `ArrayBuffer` data to it via `postMessage`.
    *   In `PaperApp.jsx`: Listen for `message` events from the worker (decompressed data or errors).
    *   In `decompress.worker.js`: Listen for messages, perform decompression, `postMessage` results/errors back.
12. **[Ticket 12]** Implement Loading Indicator (if not already there): Show visual feedback in the UI based on the `isLoading`/`loadingProgress` state managed in `PaperApp.jsx`.

## Phase 3: Database Integration (Dexie.js)

13. **[Ticket 13]** Install Dexie.js: Add `dexie` package to the project.
14. **[Ticket 14]** Define Dexie Schema: Create `src/db.js`, define the `ResearchPapersDB` database, the `papers` object store, and necessary indexes (`id`, `date_added`, `year`, `journal`, `*topic`).
15. **[Ticket 15]** Implement Data Insertion: In `PaperApp.jsx`, when decompressed data is received from the worker, use `db.papers.bulkAdd()` to add papers to IndexedDB. Handle potential bulk add errors.
16. **[Ticket 16]** Update UI State on Data Ready: Set `isDataReady` to true in `PaperApp.jsx` once initial data population is complete (or enough data is present).

## Phase 4: Basic Paper Display & Pagination

17. **[Ticket 17]** Implement Default Data Query: Create a function in `PaperApp.jsx` (`getPapersFromDb`) to query Dexie.js for the first 10 papers sorted by `date_added` descending (`db.papers.orderBy('date_added').reverse().limit(10).toArray()`).
18. **[Ticket 18]** Create Paper List Component: Implement `src/components/PaperList.jsx`.
19. **[Ticket 19]** Create Paper Item Component: Implement `src/components/PaperItem.jsx` to display individual paper details.
20. **[Ticket 20]** Render Initial Paper List: In `PaperApp.jsx`, call `getPapersFromDb` when `isDataReady` is true, store results in state, and pass them to `PaperList.jsx`.
21. **[Ticket 21]** Implement Pagination Logic:
    *   Add `currentPage` state to `PaperApp.jsx`.
    *   Modify `getPapersFromDb` to use `offset((currentPage - 1) * 10).limit(10)`.
    *   Calculate `totalPaperCount` (initially `db.papers.count()`).
    *   Add pagination controls to `PaperList.jsx`.
    *   Implement handlers in `PaperApp.jsx` to update `currentPage` and re-fetch data when pagination controls are clicked.

## Phase 5: Filtering

22. **[Ticket 22]** Fetch Unique Filter Values: In `PaperApp.jsx`, once data is ready, query Dexie.js using `db.papers.orderBy('topic').uniqueKeys().toArray()` (and similar for journal, year) to populate `availableTopics`, etc., state.
23. **[Ticket 23]** Create Filter Controls Component: Implement `src/components/FilterControls.jsx` to display dropdowns populated by `available*` state.
24. **[Ticket 24]** Manage Filter State: Add `activeFilters` state to `PaperApp.jsx`. Update this state when filter controls change via handlers passed to `FilterControls.jsx`.
25. **[Ticket 25]** Apply Filters to Query: Modify `getPapersFromDb` to:
    *   Start with `db.papers`.
    *   Conditionally add `.where('topic').equals(activeFilters.topic)` if a topic filter is active (similarly for journal, year). Use `.where('year').equals(parseInt(activeFilters.year))` for year if stored as number.
    *   Apply sorting (`orderBy('date_added').reverse()`).
    *   Calculate the total count *after* applying filters for accurate pagination (`collection.count()`).
    *   Apply pagination (`offset/limit`).
    *   Fetch (`toArray()`).
26. **[Ticket 26]** Reset Pagination on Filter Change: When filters change, reset `currentPage` to 1 before querying.

## Phase 6: Full-Text Search

27. **[Ticket 27]** Install FlexSearch: Add `flexsearch` package.
28. **[Ticket 28]** Create Search Indexing Worker: Set up `src/workers/search.worker.js`.
29. **[Ticket 29]** Implement FlexSearch Indexing:
    *   In the worker: Initialize `FlexSearch.Document`, listen for 'add' messages with paper data (`{ id, title, abstract }`), add data to the index.
    *   In `PaperApp.jsx`: After data is added to Dexie, query Dexie for `id`, `title`, `abstract` and send batches to the search worker. Set `isSearchIndexReady` state when done.
30. **[Ticket 30]** Create Search Bar Component: Implement `src/components/SearchBar.jsx` with debounced input.
31. **[Ticket 31]** Manage Search Query State: Add `searchQuery` state to `PaperApp.jsx`, updated by the debounced handler from `SearchBar.jsx`.
32. **[Ticket 32]** Implement Search Querying (Worker):
    *   In the worker: Listen for 'search' messages, execute `index.search(query)`, send back results (array of matching documents or just `id`s).
    *   In `PaperApp.jsx`: When `searchQuery` changes:
        *   If query is empty, revert to standard filter logic.
        *   If query exists, send it to the search worker.
        *   Listen for results (matching IDs) from the worker.
33. **[Ticket 33]** Integrate Search Results with Filtering & Display: Modify `getPapersFromDb`:
    *   If `searchQuery` is active and results (IDs) received:
        *   Start query with `db.papers.where('id').anyOf(matchingIds)`.
        *   Apply *active filters* (`.and(filterFunction)`) to this collection.
        *   Apply sorting (`orderBy('date_added').reverse()`).
        *   Calculate total count, apply pagination, fetch.
    *   Else (no search query): Use existing filter/sort/pagination logic.
34. **[Ticket 34]** Reset Pagination on Search: When `searchQuery` changes, reset `currentPage` to 1.

## Phase 7: Finalization & Testing

35. **[Ticket 35]** Implement View Switching: Add UI (tabs/buttons) to change `currentView` state in `PaperApp.jsx`. Modify `getPapersFromDb` or create separate query functions based on the view (e.g., grouping/sorting differently if needed, though default sort is always `date_added`). Ensure filters/search still work.
36. **[Ticket 36]** Styling: Apply CSS styling for a clean user interface.
41. **[Ticket 37]** Build & Deploy: Configure Astro build for GitHub Pages deployment.