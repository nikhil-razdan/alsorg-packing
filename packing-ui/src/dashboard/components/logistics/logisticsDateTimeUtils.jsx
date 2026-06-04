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

export const GENERAL_SHIFT_START_HOUR = 9;
export const GENERAL_SHIFT_END_HOUR = 18;

const pad = (value) =>
  String(value).padStart(2, "0");

export const toDateTimeLocalValue = (date) => {
  if (!date) return "";

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

export const getDefaultShiftStartLocal = () => {
  const date = new Date();

  date.setHours(
    GENERAL_SHIFT_START_HOUR,
    0,
    0,
    0
  );

  return toDateTimeLocalValue(date);
};

export const getDefaultShiftEndLocal = () => {
  const date = new Date();

  date.setHours(
    GENERAL_SHIFT_END_HOUR,
    0,
    0,
    0
  );

  return toDateTimeLocalValue(date);
};

export const calculateShiftHours = (shift) => {
  if (
    !shift?.shiftStart ||
    !shift?.shiftEnd
  ) {
    return 0;
  }

  const start = new Date(shift.shiftStart);
  const end = new Date(shift.shiftEnd);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return 0;
  }

  const minutes =
    (end.getTime() - start.getTime()) /
    60000;

  return Math.max(minutes / 60, 0);
};

export const getShiftDateKey = (shift) => {
  const value =
    shift?.shiftStart ||
    shift?.date ||
    shift?.createdAt;

  if (!value) return "-";

  try {
    const date = new Date(value);

    return `${date.getFullYear()}-${pad(
      date.getMonth() + 1
    )}-${pad(date.getDate())}`;
  } catch {
    return "-";
  }
};