function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  formatDate,
  safeJsonParse,
};
