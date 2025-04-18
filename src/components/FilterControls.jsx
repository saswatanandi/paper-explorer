import React from 'react';
import './FilterControls.css';

/**
 * Renders dropdown controls for filtering papers by topic, journal, and year.
 * 
 * Props:
 *  - availableTopics: Array of unique topic strings.
 *  - availableJournals: Array of unique journal strings.
 *  - availableYears: Array of unique year numbers/strings.
 *  - activeFilters: Object containing the currently selected filters { topic: '', journal: '', year: '' }.
 *  - onFilterChange: Function to call when a filter value changes. Expects (filterType, value).
 */
const FilterControls = ({
  availableTopics = [],
  availableJournals = [],
  availableYears = [],
  activeFilters = { topic: '', journal: '', year: '' },
  onFilterChange 
}) => {

  const handleSelectChange = (event) => {
    const { name, value } = event.target;
    if (onFilterChange) {
      onFilterChange(name, value); // Pass filter type (name) and selected value
    }
  };

  return (
    <div className="filter-controls">
      <div className="filter-group">
        <label htmlFor="topic-filter">Topic:</label>
        <select 
          id="topic-filter" 
          name="topic" 
          value={activeFilters.topic || ''} 
          onChange={handleSelectChange}
        >
          <option value="">All Topics</option>
          {availableTopics.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="journal-filter">Journal:</label>
        <select 
          id="journal-filter" 
          name="journal" 
          value={activeFilters.journal || ''} 
          onChange={handleSelectChange}
        >
          <option value="">All Journals</option>
          {availableJournals.map(journal => (
            <option key={journal} value={journal}>{journal}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="year-filter">Year:</label>
        <select 
          id="year-filter" 
          name="year" 
          value={activeFilters.year || ''} 
          onChange={handleSelectChange}
        >
          <option value="">All Years</option>
          {/* Assuming years are sorted descending */}
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default FilterControls;
