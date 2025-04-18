import React, { useState } from 'react';
import './PaperItem.css';

/**
 * Formats author names from the authors array.
 * Handles cases where first_name or last_name might be missing.
 * @param {Array<{first_name?: string, last_name?: string}>} authors - Array of author objects.
 * @returns {string} Formatted author string.
 */
const formatAuthors = (authors) => {
  if (!Array.isArray(authors) || authors.length === 0) {
    return 'N/A';
  }
  return authors.map(author => {
    const first = author.first_name || '';
    const last = author.last_name || '';
    if (first && last) {
      return `${first} ${last}`;
    }
    return first || last; // Return whichever name exists if one is missing
  }).join(', ');
};

/**
 * Renders the details for a single research paper.
 * 
 * Props:
 * Props:
 *  - paper: The paper object containing details like id, title, authors, year, etc.
 */
const PaperItem = ({ paper }) => {
  const [isExpanded, setIsExpanded] = useState(false); // State for abstract expansion

  if (!paper) {
    return null; // Don't render if no paper data is provided
  }

  // Basic check for essential fields
  const { 
    id, 
    title = 'No Title Provided', 
    authors = [], 
    year = 'N/A', 
    journal = 'N/A', 
    topic = [], 
    date_added = 'N/A',
    abstract = '',
    url // Optional URL link
  } = paper;

  // Truncate abstract for display (e.g., first 250 characters)
  const abstractSnippet = abstract ? `${abstract.substring(0, 250)}...` : 'No abstract available.';
  const canExpand = abstract && abstract.length > 250;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="paper-item card" data-paper-id={id}> {/* Added card class */}
      <h3 className="paper-title">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">{title}</a>
        ) : (
          title
        )}
      </h3>
      <p className="paper-authors"><strong>Authors:</strong> {formatAuthors(authors)}</p>
      <div className="paper-meta">
        <span><strong>Year:</strong> {year}</span> | 
        <span><strong>Journal:</strong> {journal}</span> | 
        <span><strong>Date Added:</strong> {date_added}</span>
      </div>
      <div className="paper-topics">
        <strong>Topics:</strong> {Array.isArray(topic) && topic.length > 0
          ? topic.map(t => <span key={t} className="topic-tag">{t}</span>)
          : 'N/A'}
      </div>
      <div className="paper-abstract">
        <p>{isExpanded ? abstract : abstractSnippet}</p>
        {canExpand && (
          <button onClick={toggleExpand} className="abstract-toggle-button">
            {isExpanded ? 'View Less' : 'View More'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PaperItem;
