import React, { useState, useEffect, useRef } from 'react';
import './PaperApp.css';
import PaperLoader from './PaperLoader';
import PaperList from './PaperList'; 
import FilterControls from './FilterControls'; 
import SearchBar from './SearchBar'; // Import the new component
import { db } from '../lib/db'; // Import the Dexie db instance

/**
 * Main component for the Paper Explorer application
 * Manages overall application state and orchestrates child components
 */
const PaperApp = () => {
  // Loading and data readiness states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isSearchIndexReady, setIsSearchIndexReady] = useState(false);
  
  // Data states
  const [papers, setPapers] = useState([]);
  const [totalPaperCount, setTotalPaperCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; // Define items per page constant
  const SEARCH_DEBOUNCE_DELAY = 500; // Adjustable debounce delay in milliseconds
  
  // Filter and view states
  const [activeFilters, setActiveFilters] = useState({
    topic: '',
    journal: '',
    year: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState('date_added'); // Possible values: 'date_added', 'topic', 'journal', 'year'
  
  // Available filter options (populated after data is loaded)
  const [availableTopics, setAvailableTopics] = useState([]);
  const [availableJournals, setAvailableJournals] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  // Search results state
  const [searchResultIds, setSearchResultIds] = useState(null); // null: no active search, []: search active but no results/pending
  const [pendingSearchQuery, setPendingSearchQuery] = useState(null); // Track the query sent to the worker

  // Handle search query changes
  const handleSearchQueryChange = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      // Reset search results when query is empty
      setSearchResultIds(null);
      setPendingSearchQuery(null);
      return;
    }
    // Only send non-empty queries to the search worker
    if (searchWorker.current && isSearchIndexReady) {
      setPendingSearchQuery(query);
      searchWorker.current.postMessage({ type: 'search', query });
    }
  };

  // Worker related refs and state
  const decompressWorker = useRef(null);
  const searchWorker = useRef(null); // Ref for the search worker
  const [decompressionTasks, setDecompressionTasks] = useState({}); // Track status of each file { id: { status: 'pending' | 'done' | 'error', filePath } }
  const allDecompressedPapers = useRef([]); // Accumulate results here before DB insertion

  // Base URL for the raw data repository content
  const DATA_REPO_URL = 'https://raw.githubusercontent.com/saswatanandi/paper-explorer-data/main/';

  // Handle the load papers button click
  const handleLoadPapers = async () => {
    setIsLoading(true);
    setLoadingProgress(0); // Reset progress
    setIsDataReady(false); // Reset data ready state
    setPapers([]); // Clear any previously displayed papers
    setTotalPaperCount(0); // Reset count
    setCurrentPage(1); // Reset pagination
    setDecompressionTasks({}); // Clear previous task statuses
    allDecompressedPapers.current = []; // Clear accumulator
    
    console.log('Clearing existing paper data from IndexedDB...');
    try {
      await db.papers.clear(); // Clear the object store before starting
      console.log('Existing paper data cleared.');
    } catch (clearError) {
      console.error("Failed to clear existing paper data:", clearError);
      // Decide if you want to proceed or stop if clearing fails
      // For now, we'll log the error and continue, but this might cause issues later.
    }

    console.log('Fetching index file...');
    try {
      const indexUrl = `${DATA_REPO_URL}index.json`;
      const response = await fetch(indexUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dataFiles = await response.json();
      const filePaths = dataFiles.files;
      console.log(`Found ${filePaths.length} data files to fetch.`);
      setLoadingProgress(10); // Index fetched

      // Create fetch promises for all data files
      const fetchPromises = filePaths.map(filePath => {
        const fileUrl = `${DATA_REPO_URL}${filePath}`;
        console.log(`Preparing to fetch: ${fileUrl}`);
        return fetch(fileUrl)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
            }
            // Fetch as ArrayBuffer for decompression later
            return response.arrayBuffer(); 
          })
          .then(arrayBuffer => ({ status: 'fulfilled', value: { filePath, arrayBuffer } }))
          .catch(error => {
            // Attach filePath to the error object for easier retrieval later
            error.filePath = filePath; 
            // Return a consistent structure indicating inner rejection
            return { status: 'rejected', reason: error, filePath }; 
          });
      });

      console.log('Starting concurrent fetch of all data files...');
      setLoadingProgress(20); // Indicate fetching started

      // Wait for all fetches to settle (complete or fail)
      const results = await Promise.allSettled(fetchPromises);
      
      console.log('All data file fetches settled.');
      setLoadingProgress(50); // Indicate fetching completed (decompression next)

      const successfulFetches = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          // Inner promise settled (either fulfilled or rejected)
          if (result.value.status === 'fulfilled') {
            // Inner promise fulfilled (fetch successful)
            // Access the data correctly: result.value.value
            const { filePath, arrayBuffer } = result.value.value;
            console.log(`Successfully fetched ${filePath} (${arrayBuffer.byteLength} bytes)`);
            // Store the essential data
            successfulFetches.push({ filePath, arrayBuffer }); 
          } else {
            // Inner promise rejected (fetch failed after starting)
            const { reason: error, filePath } = result.value;
            console.error(`Failed to fetch ${filePath} (inner rejection):`, error);
            // TODO: Add more robust error handling / UI feedback
          }
        } else {
          // Outer promise rejected (fetch failed to even start properly, or other error in chain)
          const error = result.reason;
          // Retrieve filePath attached in the catch block
          const filePath = error?.filePath || 'unknown file'; 
          console.error(`Failed to fetch ${filePath} (outer rejection):`, error);
          // TODO: Add more robust error handling / UI feedback
        }
      });

      console.log(`Successfully fetched ${successfulFetches.length} out of ${filePaths.length} files.`);

      if (successfulFetches.length > 0 && decompressWorker.current) {
        console.log('Sending fetched data to decompression worker...');
        setLoadingProgress(55); // Indicate start of decompression phase

        const tasks = {};
        successfulFetches.forEach((fetchResult, index) => {
          const taskId = `decomp-${index}-${Date.now()}`; // Simple unique ID
          tasks[taskId] = { status: 'pending', filePath: fetchResult.filePath };
          // Transfer ArrayBuffer ownership to worker for performance
          decompressWorker.current.postMessage(
            { id: taskId, arrayBuffer: fetchResult.arrayBuffer, filePath: fetchResult.filePath },
            [fetchResult.arrayBuffer] // Transferable object
          );
        });
        setDecompressionTasks(tasks); // Store tasks to track progress
        allDecompressedPapers.current = []; // Reset accumulator

      } else if (successfulFetches.length === 0) {
        console.log("No files successfully fetched. Stopping.");
        setIsLoading(false); // Stop loading if nothing to decompress
      } else {
         console.error("Decompression worker not available.");
         setIsLoading(false); // Stop loading if worker failed to initialize
      }

      // Loading continues until worker finishes and data is in DB
      // setIsLoading(false); 
      // setIsDataReady(true); 
      // setIsLoading(false); 
      // setIsDataReady(true); 

    } catch (error) {
      console.error("Failed to fetch index or data files:", error);
      // TODO: Display user-friendly error message in the UI
      setIsLoading(false); // Stop loading on error
    }
  };

  // Effect to initialize and terminate the decompression worker
  useEffect(() => {
    // Create worker instance. Note: Vite/Astro might require specific worker syntax
    // Adjust the path if necessary based on your build setup.
    // The { type: 'module' } might be needed depending on worker content/imports.
    try {
        decompressWorker.current = new Worker(new URL('../workers/decompress.worker.js', import.meta.url), { type: 'module' });
        console.log("Decompression worker initialized.");

        // Handle messages from the worker - make the handler async to use await for DB ops
        decompressWorker.current.onmessage = async (event) => {
          const { id, papersData, error, filePath } = event.data;
          
          // Use a functional update to ensure we have the latest state
          // and handle the async nature properly within the state update logic
          setDecompressionTasks(prevTasks => { 
            const updatedTasks = { ...prevTasks };
            if (!updatedTasks[id]) return prevTasks; // Ignore if task ID is unknown

            if (error) {
              console.error(`Decompression Worker Error for ${filePath} (ID: ${id}):`, error);
              updatedTasks[id].status = 'error';
              // TODO: Handle error more robustly (e.g., update UI)
            } else {
              console.log(`Decompression successful for ${filePath} (ID: ${id}). Received ${papersData?.papers?.length || 0} papers.`);
              updatedTasks[id].status = 'done';
              // Accumulate results
              if (papersData && papersData.papers) {
                  allDecompressedPapers.current.push(...papersData.papers);
              }
            }

            // Check if all tasks are done or errored
            const completedCount = Object.values(updatedTasks).filter(task => task.status === 'done' || task.status === 'error').length;
            const totalTasks = Object.keys(updatedTasks).length;
            
            // Update progress (e.g., 55% to 85% range for decompression)
            const decompressionProgress = totalTasks > 0 ? (completedCount / totalTasks) * 30 : 0; // 30% of total progress allocated
            setLoadingProgress(55 + decompressionProgress);

            // Check if all tasks are done or errored *outside* the state setter 
            // after this update cycle completes, to avoid async issues within setter
            // We'll trigger the DB add from an effect or a separate function later
            // For now, let's just update the state and log
            
            // --- This logic needs to move outside the state setter ---
            // if (completedCount === totalTasks) { ... } 
            // --- Let's adjust the approach ---

            return updatedTasks; // Return the updated state first
          });

          // --- Check completion status *after* state update ---
          // We need to access the *next* state, which isn't directly available here.
          // A better approach is to check completion inside the state setter, 
          // but trigger the async DB operation *outside* of it.
          
          // Let's refine the state update logic to handle this:
          setDecompressionTasks(prevTasks => {
            const updatedTasks = { ...prevTasks };
            if (!updatedTasks[id]) return prevTasks; // Task already processed or unknown

            if (error) {
              console.error(`Decompression Worker Error for ${filePath} (ID: ${id}):`, error);
              updatedTasks[id].status = 'error';
            } else {
              console.log(`Decompression successful for ${filePath} (ID: ${id}). Received ${papersData?.papers?.length || 0} papers.`);
              updatedTasks[id].status = 'done';
              if (papersData && papersData.papers) {
                  allDecompressedPapers.current.push(...papersData.papers);
              }
            }

            const completedCount = Object.values(updatedTasks).filter(task => task.status === 'done' || task.status === 'error').length;
            const totalTasks = Object.keys(updatedTasks).length;
            const decompressionProgress = totalTasks > 0 ? (completedCount / totalTasks) * 30 : 0;
            setLoadingProgress(55 + decompressionProgress);

            // --- Trigger DB Add when complete ---
            if (completedCount === totalTasks && totalTasks > 0) {
              // Use a separate async function to handle DB insertion
              handleAllDecompressionComplete(updatedTasks); 
            }
            
            return updatedTasks;
          });
        };

        // Handle errors from the worker itself
        decompressWorker.current.onerror = (event) => {
          console.error("Error in Decompression Worker:", event.message, event);
          // Potentially stop the loading process or show an error message
          setIsLoading(false); 
          // TODO: Update UI to show critical error
        };

    } catch (error) {
        console.error("Failed to initialize decompression worker:", error);
        // Handle worker initialization failure (e.g., show error message)
    }


    // Cleanup function to terminate the worker when the component unmounts
    return () => {
      if (decompressWorker.current) {
        console.log("Terminating decompression worker.");
        decompressWorker.current.terminate();
        decompressWorker.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  // Function to handle database insertion after all decompression is done
  const handleAllDecompressionComplete = async (finalTasks) => {
      const totalTasks = Object.keys(finalTasks).length;
      const errorCount = Object.values(finalTasks).filter(task => task.status === 'error').length;
      
      console.log(`All ${totalTasks} decompression tasks finished. ${errorCount} errors. Total papers accumulated: ${allDecompressedPapers.current.length}`);
      setLoadingProgress(85); // Indicate decompression finished, DB insertion next

      if (allDecompressedPapers.current.length > 0) {
          console.log(`Accumulated ${allDecompressedPapers.current.length} papers. Checking for duplicates before insertion...`);
          
          // De-duplicate papers based on 'id'
          const uniquePapersMap = new Map();
          allDecompressedPapers.current.forEach(paper => {
              if (paper && paper.id && !uniquePapersMap.has(paper.id)) {
                  uniquePapersMap.set(paper.id, paper);
              }
          });
          const uniquePapersArray = Array.from(uniquePapersMap.values());
          const duplicateCount = allDecompressedPapers.current.length - uniquePapersArray.length;
          
          if (duplicateCount > 0) {
              console.warn(`Removed ${duplicateCount} duplicate paper entries based on ID.`);
          }
          
          if (uniquePapersArray.length === 0) {
              console.log("No unique papers left after de-duplication. Skipping database insertion.");
              setIsLoading(false);
              setLoadingProgress(100);
              setIsDataReady(false); // No data was actually added
              allDecompressedPapers.current = [];
              return; // Exit the function early
          }

          console.log(`Attempting to bulk add ${uniquePapersArray.length} unique papers to IndexedDB...`);
          try {
              // Perform the bulk add operation with the de-duplicated array
              await db.papers.bulkAdd(uniquePapersArray);
              console.log(`Successfully added ${uniquePapersArray.length} papers to Dexie DB.`);
              
              // Update state on successful insertion
              // Don't set loadingProgress to 100 yet, indexing is next
              // setLoadingProgress(100); 
              setIsDataReady(true); // Data is ready for display/querying via Dexie
              
              // Start the search indexing process
              startIndexing(); 
              
          } catch (error) {
              console.error("Failed to bulk add papers to Dexie DB:", error);
              // Handle Dexie bulkAdd errors (e.g., constraint errors)
              // TODO: Provide user feedback about the DB error
              setLoadingProgress(100); // Still finish progress, but show error state?
              // Maybe set a specific error state variable?
          } finally {
              // Ensure loading stops regardless of DB success/failure
              setIsLoading(false); 
              // Clear the accumulated papers buffer
              allDecompressedPapers.current = []; 
          }
      } else {
          console.log("No papers accumulated, skipping database insertion.");
          setIsLoading(false); // Stop loading as there's nothing to add
          setLoadingProgress(100); 
          // Consider if isDataReady should be true or false here? 
          // Probably false if no data was loaded.
          setIsDataReady(false); 
      }
  };

  // Function to fetch papers from Dexie based on current state (pagination, filters, etc.)
  // Accepts the target page number to fetch
  const getPapersFromDb = async (page = currentPage) => {
    // Use the passed 'page' or default to the current state's currentPage
    const requestedPage = page; 
    console.log(`Fetching papers for page ${requestedPage}. Search active: ${searchResultIds !== null}. Filters:`, activeFilters);
    
    try {
      let collection;

      let papersToProcess = [];
      let count = 0;

      // --- Fetch initial set based on Search State ---
      if (searchResultIds !== null) {
        // Search is active
        if (searchResultIds.length === 0) {
          console.log("Search returned no results.");
          setPapers([]);
          setTotalPaperCount(0);
          return; // Stop processing
        }
        
        // Fetch papers individually by ID using db.papers.get()
        console.log(`Fetching ${searchResultIds.length} papers individually by ID...`);
        const paperPromises = searchResultIds.map(id => db.papers.get(id));
        const initialPapers = (await Promise.all(paperPromises)).filter(p => p !== undefined); // Filter out not found
        console.log(`Successfully fetched ${initialPapers.length} papers by ID.`);
        papersToProcess = initialPapers;

      } else {
        // No active search, fetch all papers and apply filters later
        // We need to fetch all first because .filter() comes after
        console.log("No search active, fetching all papers for potential filtering...");
        papersToProcess = await db.papers.toArray();
        console.log(`Fetched ${papersToProcess.length} total papers.`);
      }

      // --- Apply Active Filters (to the fetched array) ---
      const filtersToApply = Object.entries(activeFilters).filter(([key, value]) => value !== '');
      let filteredPapers = papersToProcess; // Start with the fetched papers

      if (filtersToApply.length > 0) {
        console.log("Applying active filters to fetched papers...");
        filteredPapers = papersToProcess.filter(paper => {
          return filtersToApply.every(([key, value]) => {
            if (!paper) return false;
            switch (key) {
              case 'topic':
                return Array.isArray(paper.topic) && paper.topic.includes(value);
              case 'journal':
                return paper.journal === value;
              case 'year':
                return paper.year === parseInt(value, 10); 
              default:
                return true;
            }
          });
        });
        console.log(`Finished applying filters. ${filteredPapers.length} papers remaining.`);
      } else {
        console.log("No active filters to apply.");
      }
      
      // --- Set Count, Sort, and Paginate the Final Array ---
      count = filteredPapers.length;
      setTotalPaperCount(count);
      console.log(`Total papers matching criteria (search + filters): ${count}`);

      if (count > 0) {
        // Calculate offset based on the requested page
        const offset = (requestedPage - 1) * ITEMS_PER_PAGE;

        // Sort the final filtered array in memory based on currentView
        console.log(`Sorting final ${filteredPapers.length} papers by: ${currentView}`);
        const sortedPapers = filteredPapers.sort((a, b) => {
          // Ensure papers a and b exist for comparison
          if (!a || !b) return 0; 

          // Define secondary sort (always date_added descending)
          const compareDateAdded = () => {
            const dateA = a.date_added || '';
            const dateB = b.date_added || '';
            if (dateA < dateB) return 1;
            if (dateA > dateB) return -1;
            return 0;
          };

          // Primary sort based on currentView
          switch (currentView) {
            case 'topic':
              // Sort by first topic alphabetically, then date added
              const topicA = Array.isArray(a.topic) && a.topic.length > 0 ? a.topic[0].toLowerCase() : '';
              const topicB = Array.isArray(b.topic) && b.topic.length > 0 ? b.topic[0].toLowerCase() : '';
              if (topicA < topicB) return -1;
              if (topicA > topicB) return 1;
              return compareDateAdded(); // Secondary sort

            case 'journal':
              // Sort by journal alphabetically, then date added
              const journalA = (a.journal || '').toLowerCase();
              const journalB = (b.journal || '').toLowerCase();
              if (journalA < journalB) return -1;
              if (journalA > journalB) return 1;
              return compareDateAdded(); // Secondary sort

            case 'year':
              // Sort by year descending, then date added
              const yearA = a.year || 0;
              const yearB = b.year || 0;
              if (yearA > yearB) return -1; // Descending year
              if (yearA < yearB) return 1;
              return compareDateAdded(); // Secondary sort

            case 'date_added':
            default:
              // Default sort by date_added descending
              return compareDateAdded();
          }
        });

        // Apply pagination using slice
        const papersData = sortedPapers.slice(offset, offset + ITEMS_PER_PAGE);
        console.log(`Sliced papersData length: ${papersData.length}. Offset: ${offset}, Limit: ${ITEMS_PER_PAGE}`);
        
        setPapers(papersData);
        // Log the final length again to be sure
        console.log(`State update with ${papersData.length} papers for page ${requestedPage}.`);
      } else {
        // Handle case where DB is empty or no papers match criteria
        setPapers([]);
        console.log("No papers found matching criteria.");
      }

    } catch (error) {
      // This is the correct catch block for the main try block starting at line 373
      console.error(`Failed to fetch papers from Dexie DB for page ${requestedPage} (Search: ${searchResultIds !== null}, Filters: ${JSON.stringify(activeFilters)}):`, error);
      setPapers([]); // Clear papers on error
      setTotalPaperCount(0);
      // TODO: Display error to user
    }
  };

  // Function to fetch unique values for filter dropdowns
  const fetchFilterOptions = async () => {
    console.log("Fetching unique filter options from Dexie DB...");
    try {
      // Fetch unique topics (multi-entry index)
      console.log("Fetching unique topics...");
      // Directly await the promise returned by uniqueKeys()
      const topics = await db.papers.orderBy('topic').uniqueKeys(); 
      setAvailableTopics(topics.sort()); // Sort alphabetically
      console.log(`Found ${topics.length} unique topics.`);

      // Fetch unique journals
      console.log("Fetching unique journals...");
      // Directly await the promise returned by uniqueKeys()
      const journals = await db.papers.orderBy('journal').uniqueKeys();
      const validJournals = journals.filter(j => j); 
      setAvailableJournals(validJournals.sort()); // Sort alphabetically
      console.log(`Found ${validJournals.length} unique journals.`);

      // Fetch unique years
      console.log("Fetching unique years...");
      // Directly await the promise returned by uniqueKeys()
      const years = await db.papers.orderBy('year').uniqueKeys();
      setAvailableYears(years.sort((a, b) => b - a)); 
      console.log(`Found ${years.length} unique years.`);

    } catch (error) {
      console.error("Failed to fetch filter options from Dexie DB:", error);
      // Keep extended logging for now in case other issues arise
      console.error("Error Name:", error.name);
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
      // Reset filter options on error
      setAvailableTopics([]);
      setAvailableJournals([]);
      setAvailableYears([]);
      // TODO: Display error to user?
    }
  };

  // Effect to fetch initial data and filter options when DB is ready
  useEffect(() => {
    if (isDataReady) {
      // Fetch the first page (page 1) - This will now use default empty filters
      getPapersFromDb(1); 
      // Fetch unique filter values
      fetchFilterOptions();
    }
    // Reset page and filters if data becomes not ready (e.g., during a reload)
    if (!isDataReady) {
        setCurrentPage(1);
        setActiveFilters({ topic: '', journal: '', year: '' }); // Also reset filters
    }
  }, [isDataReady]); // Dependency array ensures this runs when isDataReady changes

  // Handler for pagination changes
  const handlePageChange = (newPage) => {
    console.log(`Page change requested to: ${newPage}`);
    setCurrentPage(newPage); // Update the current page state
    getPapersFromDb(newPage); // Fetch data for the new page
  };

  // Handler for filter changes
  const handleFilterChange = (filterType, value) => {
    console.log(`Filter change requested: ${filterType} = ${value}`);
    
    // Update the activeFilters state
    setActiveFilters(prevFilters => ({
      ...prevFilters,
      ...prevFilters,
      [filterType]: value // Update the specific filter type with the new value
    }));

    // Trigger data refetch for page 1 with the new filters
    // We need to ensure the state update completes before fetching,
    // so using useEffect based on activeFilters might be safer,
    // or pass the new filters directly if getPapersFromDb is adapted.
    // For simplicity now, let's call it directly, assuming state updates reasonably fast.
    // Also reset pagination to 1 (Ticket 26)
    setCurrentPage(1); 
    // We need to pass the *new* filters, not the potentially stale activeFilters state
    const newFilters = { ...activeFilters, [filterType]: value };
    // Modify getPapersFromDb to accept filters? Or rely on state update + useEffect?
    // Let's modify getPapersFromDb slightly to accept filters for immediate use
    // getPapersFromDb(1, newFilters); // Requires modifying getPapersFromDb signature
    
    // --- Simpler approach: Rely on state update and useEffect ---
    // We'll add a useEffect hook that watches activeFilters
  };

  // Handler for search query changes (debounced)
  const handleSearchChange = (query) => {
    // This log should only appear *after* the debounce delay
    console.log(`handleSearchChange called with debounced query: "${query}"`); 
    setSearchQuery(query); // Update the search query state
    
    // Triggering search worker query happens in the useEffect watching searchQuery
    // TODO (Ticket 34): Reset pagination (will also likely happen in the useEffect)
  };

  // Effect to refetch data when filters change
  useEffect(() => {
    // Avoid running on initial mount before data is ready
    if (isDataReady) { 
      console.log("Filters changed, refetching data for page 1.");
      setCurrentPage(1); // Reset to page 1 (Ticket 26)
      getPapersFromDb(1); // Refetch with current activeFilters state
    }
  }, [activeFilters]); // Dependency array: run when activeFilters changes

  // Effect to trigger search worker when searchQuery changes
  useEffect(() => {
    // Don't run if index isn't ready or worker isn't available
    if (!isSearchIndexReady || !searchWorker.current) {
      // Ensure results are cleared if index becomes not ready
      if (searchResultIds !== null) setSearchResultIds(null); 
      return; 
    }

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery !== '') {
      console.log(`Sending search query "${trimmedQuery}" to worker.`);
      // Set results to null to indicate search is pending/active
      // This prevents showing stale results while waiting
      setSearchResultIds(null); 
      // Set the pending query state
      setPendingSearchQuery(trimmedQuery); 
      // Reset pagination when a new search starts (Ticket 34)
      setCurrentPage(1); 
      
      searchWorker.current.postMessage({ 
        type: 'search', 
        payload: { 
          query: trimmedQuery, 
          limit: 500 // Limit results from FlexSearch if needed (adjust as necessary)
        } 
      });
    } else {
      // Search query is empty
      // If search results were active, clear them.
      // The useEffect watching searchResultIds will handle fetching the default list.
      if (searchResultIds !== null) {
        console.log("Search query cleared by user. Resetting results state.");
        setSearchResultIds(null); // Clear displayed search results state
        setCurrentPage(1); // Reset pagination (Ticket 34)
        // DO NOT call getPapersFromDb(1) here. Let the other useEffect handle it.
      }
      // If pendingSearchQuery is not null here, it means results are still outstanding
      // but the user cleared the input. The results will arrive later and be ignored
      // by the message handler because pendingSearchQuery won't match.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isSearchIndexReady]); // Rerun when query or index readiness changes
  // Note: getPapersFromDb is stable due to useRef/useCallback pattern not being used here,
  // but ideally it should be wrapped in useCallback if dependencies grow. Added eslint disable for now.

  // Handler for view changes
  const handleViewChange = (view) => {
    console.log(`View change requested to: ${view}`);
    setCurrentView(view);
    // Data refetching will be handled by the useEffect hook watching currentView
  };

  // Effect to fetch data when search results state changes (arrives or is cleared)
  useEffect(() => {
    // Avoid running on initial mount before data is ready
    if (isDataReady) {
      // Check if searchResultIds has changed (either became an array or became null)
      // We don't need to explicitly check the value, just react to the change.
      console.log("Search results state changed (updated or cleared), fetching papers from DB for page 1.");
      // Reset to page 1 whenever the search status changes
      setCurrentPage(1);
      getPapersFromDb(1); // Fetch based on the *current* searchResultIds and filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResultIds, isDataReady]); // Rerun when search results state or data readiness change
  // Added eslint disable as getPapersFromDb is not memoized

  // Effect to refetch data when the view changes
  useEffect(() => {
    // Avoid running on initial mount before data is ready
    if (isDataReady) {
      console.log(`View changed to ${currentView}, refetching data for page 1.`);
      setCurrentPage(1); // Reset to page 1
      getPapersFromDb(1); // Refetch with current view, activeFilters, and searchResultIds state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]); // Dependency array: run when currentView changes
  // Added eslint disable as getPapersFromDb is not memoized


  // Function to start the FlexSearch indexing process in the worker
  const startIndexing = async () => {
    if (!searchWorker.current) {
      console.error("Search worker is not available to start indexing.");
      // Maybe set loading to false here if indexing can't start?
      // setIsLoading(false); 
      return;
    }
    
    console.log("Starting search index build process...");
    setIsSearchIndexReady(false); // Mark index as not ready
    setLoadingProgress(86); // Indicate start of indexing phase (e.g., 86-99%)

    try {
      // Fetch all necessary fields from Dexie for indexing
      console.log("Querying Dexie for data to index (id, title, abstract)...");
      // Use .toArray() with specific fields for efficiency if possible, 
      // or map after fetching if needed. Dexie might not directly support selecting fields in .toArray() easily.
      // Let's fetch all and map. Adjust if performance becomes an issue.
      const allPapersForIndex = await db.papers.toArray(); 
      
      if (!allPapersForIndex || allPapersForIndex.length === 0) {
          console.warn("No papers found in Dexie to index.");
          setIsSearchIndexReady(true); // Consider index ready even if empty? Or false?
          setLoadingProgress(100); // Indexing done (empty)
          setIsLoading(false); // Loading finished
          return;
      }

      console.log(`Preparing to send ${allPapersForIndex.length} documents to search worker in batches...`);
      
      // Prepare data and send in batches
      const batchSize = 500; // Adjust batch size as needed
      let documentsSent = 0;

      for (let i = 0; i < allPapersForIndex.length; i += batchSize) {
        const batch = allPapersForIndex.slice(i, i + batchSize).map(paper => ({
          id: paper.id,
          title: paper.title || '', // Ensure fields exist
          abstract: paper.abstract || ''
        }));
        
        // Check if worker still exists before posting message (component might have unmounted)
        if (!searchWorker.current) {
            console.warn("Search worker became unavailable during indexing batch sending. Stopping.");
            break; // Exit the loop
        }
        
        console.log(`Sending batch ${Math.floor(i / batchSize) + 1} (${batch.length} documents) to search worker...`);
        searchWorker.current.postMessage({ type: 'add', payload: batch });
        documentsSent += batch.length;

        // Update progress based on documents sent
        const indexingProgress = (documentsSent / allPapersForIndex.length) * 13; // Allocate 13% for sending (86-99)
        setLoadingProgress(86 + indexingProgress);

        // Optional: Add a small delay between batches if needed to avoid overwhelming the worker?
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      }

      console.log(`Finished sending all ${documentsSent} documents to search worker.`);
      // Signal the worker that all documents have been sent, only if worker still exists
      if (searchWorker.current) {
          searchWorker.current.postMessage({ type: 'signalReady' });
      } else {
          console.warn("Search worker became unavailable before sending signalReady.");
          // Handle case where component unmounted before indexing finished
          setIsLoading(false); // Ensure loading stops
          setLoadingProgress(100); 
      }
      
      // Note: isSearchIndexReady will be set to true by the worker's 'indexStatus' message
      // Loading will be set to false when the worker confirms readiness.

    } catch (error) {
      console.error("Error during search index preparation or sending:", error);
      setIsLoading(false); // Stop loading on error
      setLoadingProgress(100); // Mark progress as done (with error)
      // TODO: Display error to user
    }
  };

  // Effect to initialize and terminate the search worker
  useEffect(() => {
    try {
      searchWorker.current = new Worker(new URL('../workers/search.worker.js', import.meta.url), { type: 'module' });
      console.log("Search worker initialized.");

      // Handle messages from the search worker
      searchWorker.current.onmessage = (event) => {
        const { type, status, message, detail } = event.data;
        switch (type) {
          case 'indexStatus':
            if (status === 'ready') {
              console.log("Search worker reported index is ready.");
              setIsSearchIndexReady(true);
              setLoadingProgress(100); // Final progress update
              setIsLoading(false); // All loading finished
            } else {
              console.log(`Search worker status update: ${status}`);
            }
            break;
          case 'error':
            console.error(`Search Worker Error: ${message}`, detail || '');
            // Handle worker errors appropriately - maybe stop loading?
            setIsLoading(false); 
            setLoadingProgress(100); // Mark progress done (with error)
            setIsSearchIndexReady(false); // Index is not ready
            // TODO: Display error to user
            break;
        case 'searchResults':
          // Received search results (array of IDs) from the worker
          const { query, results, error: searchError } = event.data;
          console.log(`Received ${results?.length ?? 0} search result IDs for query "${query}"`);
          if (searchError) {
              console.error("Search worker reported an error:", searchError);
              setSearchResultIds([]); // Indicate search failed or returned no results due to error
              // TODO: Maybe set a specific UI error state?
          } else {
              // Store the IDs. An empty array means search returned no results.
              // Use functional update for setting state based on previous state
              // This helps guarantee we read the latest pending query value during the update
              setPendingSearchQuery(currentPendingQuery => {
                  // Read the *current* pending query inside the setter
                  if (query === currentPendingQuery) {
                      console.log(`Accepting results for pending query "${query}".`);
                      // Update searchResultIds state separately
                      setSearchResultIds(results || []); 
                      return null; // Return the new state for pendingSearchQuery (null)
                  } else {
                      // Pending query doesn't match, ignore results
                      if (currentPendingQuery !== null) {
                          console.warn(`Ignoring stale search results for query "${query}" (expected: "${currentPendingQuery}", current input: "${searchQuery}")`);
                      } else {
                          console.log(`Ignoring results for query "${query}" as no search is pending.`);
                      }
                      // Return the unchanged state for pendingSearchQuery if results are ignored
                      return currentPendingQuery; 
                  }
              });
          }
          // Data fetching (Ticket 33) will be triggered by a useEffect watching searchResultIds
          break;
        // Handle other message types if needed (e.g., 'addComplete')
        default:
          console.log("Received message from search worker:", event.data);
      }
    };

      // Handle errors from the worker itself
      searchWorker.current.onerror = (event) => {
        console.error("Error in Search Worker:", event.message, event);
        setIsLoading(false);
        setLoadingProgress(100);
        setIsSearchIndexReady(false);
        // TODO: Update UI to show critical error
      };

    } catch (error) {
      console.error("Failed to initialize search worker:", error);
      // Handle worker initialization failure
    }

    // Cleanup function to terminate the worker
    return () => {
      if (searchWorker.current) {
        console.log("Terminating search worker.");
        searchWorker.current.terminate();
        searchWorker.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once


  return (
    <div className="paper-app">
      <h1>Research Paper Explorer</h1>
      
      {!isDataReady && (
        <PaperLoader 
          isLoading={isLoading}
          loadingProgress={loadingProgress}
          onLoadPapers={handleLoadPapers}
        />
      )}
      
      {isDataReady && (
        <div className="papers-container">
          <div className="view-controls">
            <span>View by:</span>
            <button onClick={() => handleViewChange('date_added')} disabled={currentView === 'date_added'}>Date Added</button>
            <button onClick={() => handleViewChange('topic')} disabled={currentView === 'topic'}>Topic</button>
            <button onClick={() => handleViewChange('journal')} disabled={currentView === 'journal'}>Journal</button>
            <button onClick={() => handleViewChange('year')} disabled={currentView === 'year'}>Year</button>
          </div>

          <FilterControls
            availableTopics={availableTopics}
            availableJournals={availableJournals}
            availableYears={availableYears}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange} // Pass the handler
          />
          
          <SearchBar 
            onSearchChange={handleSearchChange}
            initialQuery={searchQuery}
            debounceDelay={SEARCH_DEBOUNCE_DELAY} // Pass the adjustable delay
            disabled={!isSearchIndexReady} // Disable until index is ready
            placeholder={isSearchIndexReady ? "Search titles and abstracts..." : "Building search index..."}
          />
          
          <PaperList
            papers={papers}
            currentPage={currentPage}
            totalPaperCount={totalPaperCount}
            itemsPerPage={ITEMS_PER_PAGE} // Use the constant
            onPageChange={handlePageChange} // Pass the handler function
          />
          
        </div>
      )}
    </div>
  );
};

export default PaperApp;
