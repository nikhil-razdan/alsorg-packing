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

export const isShiftOverSixPm = (shift) => {
  const value =
    shift?.shiftEnd ||
    shift?.endTime ||
    "";

  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();

  return (
    hours > 18 ||
    (hours === 18 && minutes > 0)
  );
};