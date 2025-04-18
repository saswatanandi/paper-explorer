import React from 'react';
import PaperItem from './PaperItem'; // Import the new component
import './PaperList.css'; 

/**
 * Renders the list of papers and pagination controls.
 * 
 * Props:
 *  - papers: Array of paper objects to display for the current page.
 *  - currentPage: The current page number.
 *  - totalPaperCount: The total number of papers matching the current filters/search.
 *  - itemsPerPage: Number of items to display per page (default 10).
 *  - onPageChange: Function to call when pagination controls are clicked (Ticket 21).
 */
const PaperList = ({ 
  papers = [], 
  currentPage = 1, 
  totalPaperCount = 0, 
  itemsPerPage = 10, 
  onPageChange // To be implemented in Ticket 21
}) => {

  const totalPages = Math.ceil(totalPaperCount / itemsPerPage);

  // Pagination handlers - call the callback prop from PaperApp
  const handlePreviousPage = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="paper-list-container">
      <div className="list-summary">
        {totalPaperCount > 0 ? (
          `Showing ${papers.length} papers (Page ${currentPage} of ${totalPages}, Total: ${totalPaperCount})`
        ) : (
          'No papers found matching your criteria.'
        )}
      </div>

      {papers.length > 0 && (
        <div className="paper-list">
          {papers.map(paper => (
            <PaperItem key={paper.id} paper={paper} />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
             onClick={handlePreviousPage} 
             disabled={currentPage <= 1}
             aria-label="Go to previous page"
          >
            Previous
          </button>
          <span style={{ margin: '0 10px' }}>
            Page {currentPage} / {totalPages}
          </span>
          <button 
            onClick={handleNextPage} 
            disabled={currentPage >= totalPages}
            aria-label="Go to next page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PaperList;
