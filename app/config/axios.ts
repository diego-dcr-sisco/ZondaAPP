import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://siscoplagas.zondaerp.mx/api/",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
  withCredentials: true,
});

// Interceptor para debug
axiosInstance.interceptors.request.use(
  (config) => {
    //console.log("📡 Enviando petición a:", config.url);
    //console.log("📦 Datos:", config.data);
    return config;
  },
  (error) => {
    console.error("❌ Error en interceptor de request:", error);
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    //console.log("✅ Respuesta recibida:", response.status);
    return response;
  },
  (error) => {
    console.error("❌ Error en interceptor de response:", error);
    return Promise.reject(error);
  }
);

export default axiosInstance;
