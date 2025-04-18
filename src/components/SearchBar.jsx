import React, { useState, useEffect, useRef } from 'react';
import './SearchBar.css';

/**
 * Renders a search input field with debounced change handling.
 * 
 * Props:
 *  - onSearchChange: Function to call with the debounced search query.
 *  - initialQuery: The initial value for the search input (optional).
 *  - debounceDelay: Delay in milliseconds for debouncing (default 300ms).
 *  - placeholder: Placeholder text for the input field (optional).
 *  - disabled: Boolean to disable the search bar (e.g., while index is not ready).
 */
const SearchBar = ({ 
  onSearchChange, 
  initialQuery = '', 
  debounceDelay = 300,
  placeholder = "Search titles and abstracts...",
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(initialQuery);
  const debounceTimeoutRef = useRef(null);

  // Update internal state when initialQuery prop changes (e.g., if cleared externally)
  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  // Handle input changes and trigger debounced callback
  const handleChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout to call onSearchChange after delay
    debounceTimeoutRef.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(newValue);
      }
    }, debounceDelay);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="search-bar-container">
      <input
        type="search" // Use type="search" for potential browser features (like clear button)
        className="search-input"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Search papers"
      />
      {/* Optional: Add a search icon or button here */}
    </div>
  );
};

export default SearchBar;
