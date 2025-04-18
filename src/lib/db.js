import Dexie from 'dexie';

/**
 * Initializes the Dexie database instance for storing research papers.
 * Defines the database schema including the 'papers' object store and its indexes.
 */
export const db = new Dexie('ResearchPapersDB');

db.version(1).stores({
  /**
   * papers: Defines the object store for research papers.
   * Schema Definition:
   *  - &id: Primary key, must be unique (based on sample data field name).
   *  - date_added: Indexed for sorting by date added.
   *  - year: Indexed for filtering and grouping by year.
   *  - journal: Indexed for filtering and grouping by journal.
   *  - *topic: Multi-entry index for the 'topic' array, allowing filtering by individual topics.
   */
  papers: '&id, date_added, year, journal, *topic' 
});

// Optional: Add hooks or further configuration if needed later
// db.open().catch(err => {
//   console.error(`Failed to open Dexie DB: ${err.stack || err}`);
// });

console.log("Dexie DB schema defined.");

export default db; // Export the db instance for use elsewhere
