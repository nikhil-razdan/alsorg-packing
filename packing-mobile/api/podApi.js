import {
  api,
  API_BASE_URL,
} from "./client";

function getFileName(uri) {
  const name =
    uri?.split("/")?.pop() ||
    `pod-${Date.now()}.jpg`;

  if (name.includes(".")) {
    return name;
  }

  return `${name}.jpg`;
}

function getMimeType(filename) {
  const ext =
    filename
      ?.split(".")
      ?.pop()
      ?.toLowerCase() || "jpg";

  if (ext === "png") {
    return "image/png";
  }

  if (ext === "webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function absoluteUrl(url) {
  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `${API_BASE_URL}${
    url.startsWith("/") ? "" : "/"
  }${url}`;
}

export async function uploadPodPhoto(uri) {
  if (!uri) {
    throw new Error("POD photo URI missing");
  }

  const filename = getFileName(uri);
  const type = getMimeType(filename);

  const formData = new FormData();

  formData.append("file", {
    uri,
    name: filename,
    type,
  });

  const res = await api.post(
    "/api/pod-files/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      transformRequest: (data) => data,
    }
  );

  return {
    ...res.data,
    url: absoluteUrl(
      res.data?.url ||
        res.data?.podUrl ||
        ""
    ),
  };
}