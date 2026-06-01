export const getBackendMessage = (
  error,
  fallback = "Something went wrong"
) => {
  const data = error?.response?.data;

  if (typeof data === "string") {
    return data;
  }

  return (
    data?.message ||
    data?.error ||
    data?.details ||
    error?.message ||
    fallback
  );
};