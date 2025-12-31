/**
 * DOM utilities for options page
 */

/**
 * Short form for getting elements by id
 * @param {string} id The element id
 * @returns {HTMLElement} The element
 */
export const $ = (id) => document.getElementById(id);

/**
 * Debounce utility function
 * @param {Function} func The function to debounce
 * @param {number} delay The delay in milliseconds
 * @returns {Function} The debounced function
 */
export const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

/**
 * Flash a save message near an element using CSS Anchor Positioning
 * @param {HTMLElement} element The element to flash near
 * @returns {Function} Function to stop the flash
 */
export const flashMessage = (() => {
  let currentAnchor = null;
  let hideTimeout = null;
  let cleanupTimeout = null;

  return (element) => {
    const info = $('info-message');

    if (hideTimeout) clearTimeout(hideTimeout);
    if (cleanupTimeout) clearTimeout(cleanupTimeout);

    if (currentAnchor && currentAnchor !== element) {
      currentAnchor.style.removeProperty('anchor-name');
    }

    element.style.setProperty('anchor-name', '--save-anchor');
    currentAnchor = element;

    info.dataset.visible = 'true';

    return () => {
      hideTimeout = setTimeout(() => {
        info.dataset.visible = 'false';

        cleanupTimeout = setTimeout(() => {
          if (currentAnchor === element) {
            element.style.removeProperty('anchor-name');
            currentAnchor = null;
          }
        }, 300);
      }, 1000);
    };
  };
})();
