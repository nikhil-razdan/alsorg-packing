export const getShiftDateValue = (shift) => {
  return (
    shift?.shiftStart ||
    shift?.date ||
    shift?.createdAt ||
    ""
  );
};

export const formatShiftDate = (shift) => {
  const value = getShiftDateValue(shift);

  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "-";
  }
};

export const formatShiftTime = (value) => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "";
  }
};

export const formatShiftTimeRange = (shift) => {
  const start = formatShiftTime(
    shift?.shiftStart
  );

  const end = formatShiftTime(
    shift?.shiftEnd
  );

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) return start;

  return "";
};