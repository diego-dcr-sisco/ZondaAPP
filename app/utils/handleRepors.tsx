// utils/handleReports.ts
import axiosInstance from "../config/axios";
import axios from "axios";
import { Report } from "../types/report";
import {
  Alert
} from 'react-native';

/**
 * Envía reportes uno por uno a /reports/handle y espera confirmación antes de continuar.
 */
export const syncReportsToServer = async (
  reports: Report[]
): Promise<boolean> => {
  for (const report of reports) {
    //console.log('Reporte: ', JSON.stringify(report, null, 2))
    try {
      const response = await axiosInstance.post("/reports/handle", report);
      console.log(`Reporte ${report.order_id} sincronizado:`, response.data);
    } catch (error) {
      /*console.error(
        `Error al sincronizar el reporte ${report.order_id}:`,
        error
      );*/

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        if (status === 409) {
          Alert.alert('Error de sincronización', `${errorData?.message || 'No se puede sincronizar el reporte'}`);
        } else if (status === 500) {
          Alert.alert('Error de servidor', 'Hubo un problema en el servidor. Contacte a soporte.');
        } else {
          alert(`Error al sincronizar el reporte ${report.order_id}: ${errorData?.message || 'Error desconocido'}`); // Mensaje genérico para otros errores
        }
      }
      return false; // Detiene si ocurre un error
    }
  }

  return true;
};
