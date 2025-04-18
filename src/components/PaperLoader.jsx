import React from 'react';
import './PaperLoader.css';

/**
 * Component responsible for handling the paper loading process
 * Displays the load button and loading progress
 */
import { FiDatabase, FiLoader, FiCheckCircle } from 'react-icons/fi'; // Example using react-icons

const PaperLoader = ({
  isLoading,
  loadingProgress,
  onLoadPapers
}) => {

  const getLoadingMessage = () => {
    if (loadingProgress < 10) return "Initializing...";
    if (loadingProgress < 20) return "Fetching paper index...";
    if (loadingProgress < 55) return "Downloading data files...";
    if (loadingProgress < 85) return "Decompressing data...";
    if (loadingProgress < 99) return "Building search index...";
    return "Finalizing...";
  };

  return (
    <div className="paper-loader card"> {/* Added card class */}
      <div className="loader-icon">
        {isLoading ? <FiLoader className="spin-icon" /> : <FiDatabase />}
      </div>
      <h2>Research Paper Explorer</h2>
      <p className="loader-description">
        {isLoading
          ? 'Preparing the paper database for exploration...'
          : 'Access thousands of research papers instantly. Click below to load the database into your browser.'}
      </p>

      <button
        onClick={onLoadPapers}
        disabled={isLoading}
        className="load-button"
      >
        {isLoading ? 'Loading...' : 'Load Papers'}
      </button>
      
      {isLoading && (
        <div className="loading-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${loadingProgress}%` }}
              role="progressbar"
              aria-valuenow={loadingProgress}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
          {/* <p>Loading: {loadingProgress}%</p> */}
          <p className="loading-message">
            {getLoadingMessage()} ({loadingProgress}%)
          </p>
        </div>
      )}
      {!isLoading && (
         <p className="loader-note">
           Note: Initial load may take a moment depending on your connection speed as data is fetched and processed locally.
         </p>
      )}
    </div>
  );
};

export default PaperLoader;
