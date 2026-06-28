import axios from "axios";
import { API_BASE_URL } from "../config";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new Event("app:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default API;