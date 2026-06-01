export const getBackendMessage = (
  error,
  fallback = "Something went wrong"
) => {
  const data = error?.response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (data?.details) return data.details;

  const message = error?.message;

  if (message) {
    try {
      const parsed = JSON.parse(message);

      return (
        parsed?.message ||
        parsed?.error ||
        parsed?.details ||
        message
      );
    } catch {
      return message;
    }
  }

  return fallback;
};