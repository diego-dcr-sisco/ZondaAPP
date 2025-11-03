import * as FileSystem from 'expo-file-system/legacy';
import { Order } from '../types/order';
import { Report } from '../types/report';

const getFileUri = (filename: string) => {
  return `${FileSystem.documentDirectory}${filename}.json`;
};

/**
 * Guarda cualquier objeto o array en un archivo JSON
 * @param {string} filename - Nombre del archivo sin extensión
 * @param {any} data - Objeto o array a guardar
 */
export const saveToJsonFile = async (filename: string, data: any) => {
  try {
    const uri = getFileUri(filename);
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(data), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error(`Error guardando ${filename}.json:`, error);
  }
};


export const loadFromJsonFile = async (filename: string) => {
  try {
    const uri = getFileUri(filename);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return null;

    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error leyendo ${filename}.json:`, error);
    return null;
  }
};

/**
 * Borra un archivo JSON si existe
 * @param {string} filename
 */

export const deleteJsonFile = async (filename: string) => {
  try {
    const uri = getFileUri(filename);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch (error) {
    console.error(`Error eliminando ${filename}.json:`, error);
  }
};

export const clearJsonFile = async (filename: string) => {
  try {
    await saveToJsonFile(filename, []); // Guarda un array vacío
    return true;
  } catch (error) {
    console.error("Error limpiando reports.json:", error);
    return false;
  }
};

// Agrega esta nueva función
export const updateOrdersHistory = async (newOrders: any[]) => {
  try {
    // 1. Cargar el historial existente
    const existingHistory = (await loadFromJsonFile("orders_history")) || [];
    
    // 2. Crear un mapa para actualización eficiente
    const orderMap = new Map(existingHistory.map((order: Order) => [order.id, order]));
    
    // 3. Actualizar/agregar las nuevas órdenes
    newOrders.forEach(order => {
      orderMap.set(order.id, {
        ...order,
        lastUpdated: new Date() .toISOString() // Marca de tiempo
      });
    });
    
    // 4. Convertir de vuelta a array y guardar
    const updatedHistory = Array.from(orderMap.values());
    await saveToJsonFile("orders_history", updatedHistory);
    
    return true;
  } catch (error) {
    console.error("Error actualizando historial de órdenes:", error);
    return false;
  }
};

// Función para obtener el historial completo
export const getOrdersHistory = async () => {
  return (await loadFromJsonFile("orders_history")) || [];
};

// En storage/jsonFileStorage.ts
export const finalizeOrderInStorage = async (orderId: number) => {
  const allReports = await loadFromJsonFile("reports") || [];
  
  const updatedReports = allReports.map((report: Report) => {
    if (report.order_id === orderId) {
      return {
        ...report,
        is_finalized: true,
        finalized_at: new Date().toISOString(),
        is_synchronized: false // Al finalizar, marcamos como no sincronizado
      };
    }
    return report;
  });

  await saveToJsonFile("reports", updatedReports);
};

export const reopenOrderInStorage = async (orderId: number) => {
  const allReports = await loadFromJsonFile("reports") || [];
  
  const updatedReports = allReports.map((report: Report) => {
    if (report.order_id === orderId) {
      return {
        ...report,
        is_finalized: false,
        reopened_at: new Date() .toISOString(),
        is_synchronized: false // Al reabrir, marcamos como no sincronizado
      };
    }
    return report;
  });

  await saveToJsonFile("reports", updatedReports);
};