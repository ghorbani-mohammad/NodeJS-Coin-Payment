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

/**
 * Price amount validation utility function
 * @param {number|string} priceAmount - The price amount to validate
 * @param {string} fieldName - The name of the field being validated (for error messages)
 * @returns {string|null} - Error message if invalid, null if valid
 */
const priceAmountValidation = (priceAmount, fieldName = 'priceAmount') => {
  // Check if priceAmount is provided
  if (!priceAmount) {
    return `${fieldName} is required`;
  }

  // Convert to number if it's a string
  const numericAmount = typeof priceAmount === 'string' ? parseFloat(priceAmount) : priceAmount;

  // Check if it's a valid number
  if (isNaN(numericAmount)) {
    return `${fieldName} must be a valid number`;
  }

  // Check if it's greater than 0
  if (numericAmount <= 0) {
    return `${fieldName} must be greater than 0`;
  }

  return null;
};

module.exports = {
  urlValidation,
  priceAmountValidation
};
