/**
 * URL validation utility function
 * @param {string} url - The URL to validate
 * @param {string} fieldName - The name of the field being validated (for error messages)
 * @returns {string|null} - Error message if invalid, null if valid or empty
 */
const urlValidation = (url, fieldName) => {
  if (url) {
    try {
      new URL(url);
    } catch (error) {
      return `${fieldName} must be a valid URL`;
    }
  }
  return null;
};

module.exports = {
  urlValidation
};
