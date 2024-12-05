const validateString = (string, length = 0) => {
  if (typeof string !== "string") return false;
  string = string.trim();

  if (string.length < length) return false;
  if (!string) return false;

  return string;
};

module.exports = validateString;
