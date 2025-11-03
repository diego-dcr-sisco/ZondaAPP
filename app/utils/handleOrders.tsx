import axiosInstance from "../config/axios";
import * as FileSystem from "expo-file-system/legacy";
import { ORDER_FILE_NAME } from "../storage/filenames";
import { loadFromJsonFile, saveToJsonFile } from "../storage/jsonFileStorage";
import { Order } from "../types/order";
import { Report } from "../types/report";

const getOrdersFileUri = (userId: string, date: string) =>
  `${FileSystem.documentDirectory}${ORDER_FILE_NAME}`;

// Guarda órdenes en archivo local para un userId y fecha
export const saveOrdersToFile = async (
  userId: string,
  date: string,
  orders: any[]
) => {
  try {
    const uri = getOrdersFileUri(userId, date);
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(orders), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error("Error guardando órdenes en archivo:", error);
  }
};

// Carga órdenes desde archivo local para userId y fecha
export const loadOrdersFromFile = async (userId: string, date: string) => {
  try {
    const uri = getOrdersFileUri(userId, date);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return null;

    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(content);
  } catch (error) {
    console.error("Error leyendo órdenes del archivo:", error);
    return null;
  }
};

// Descarga órdenes del servidor y guarda localmente
export const fetchOrdersFromApi = async (userId: string, date: string) => {
  try {
    const response = await axiosInstance.get(`orders/${userId}/${date}`);
    const orders = response.data.orders;
    const reports = response.data.reports;
    await saveOrdersToFile(userId, date, orders);

    return { orders, reports };
  } catch (error) {
    console.error("Error descargando órdenes desde API:", error);
    throw error;
  }
};

// Obtener órdenes, primero intenta local, si no, descarga
export const getOrders = async (userId: string, date: string) => {
  // Cargar reportes locales existentes
  const local_reports: Report[] = (await loadFromJsonFile("reports")) || [];

  // Obtener órdenes y reportes desde el API (los reportes vienen armados)
  const { orders, reports: server_reports } = await fetchOrdersFromApi(
    userId,
    date
  );

  // Combinar reportes: dar prioridad a los reportes locales sobre los del servidor
  const combined_reports = combineReports(local_reports, server_reports);

  // Filtrar y procesar las órdenes
  if (orders.length > 0) {
    orders.forEach((order: Order) => {
      // Buscar si existe un reporte para esta orden
      const report_index = combined_reports.findIndex(
        (rp: Report) => rp.order_id == order.id
      );

      // Si no existe reporte Y la orden tiene status_id == 1, crear uno básico
      /*if (report_index === -1 && order.status_id === 1) {
        const newReport: Report = createBasicReport(order.id, userId);
        combined_reports.push(newReport);
      }
      // Si existe reporte, aplicar lógica de prioridad
      else*/ if (report_index !== -1) {
        applyPriorityLogic(order, combined_reports[report_index]);
      }
    });
  }

  // Guardar los reportes combinados
  await saveToJsonFile("reports", combined_reports);
  return orders;
};

// Función para combinar reportes (prioridad a reportes locales)
const combineReports = (
  localReports: Report[],
  serverReports: Report[]
): Report[] => {
  const combined: Report[] = [...serverReports];

  localReports.forEach((localReport) => {
    const existingIndex = combined.findIndex(
      (r) => r.order_id === localReport.order_id
    );

    if (existingIndex !== -1) {
      // Mantener el reporte local (tiene prioridad)
      combined[existingIndex] = localReport;
    } else {
      // Agregar el reporte local si no existe en el servidor
      combined.push(localReport);
    }
  });

  return combined;
};

// Función para aplicar lógica de prioridad
const applyPriorityLogic = (order: Order, localReport: Report) => {
  const localStatus = localReport.is_finalized ? 3 : 1;
  const serverStatus = order.status_id ?? 1;

  if (serverStatus === 1 && localStatus !== 1) {
    if (localReport.is_finalized && localReport.is_synchronized) {
      order.status_id = 1;
      localReport.is_finalized = false;
      localReport.is_synchronized = false;
    }
  }

  if (serverStatus == 3 && localStatus == 1) {
    order.status_id = 3;
    localReport.is_finalized = true;
    localReport.is_synchronized = false;
  }
};

// Función para crear reporte básico
const createBasicReport = (orderId: number, userId: string): Report => ({
  order_id: orderId,
  user_id: Number(userId),
  start_time: new Date().toISOString(),
  end_time: null,
  completed_date: null,
  notes: null,
  customer_signature: null,
  signature_name: null,
  reviews: [],
  products: [],
  pests: [],
  is_finalized: false,
  is_synchronized: false,
});

// Actualizar o agregar orden en local (por id)
export const updateOrAddOrder = async (
  userId: string,
  date: string,
  newOrder: any
) => {
  let orders = (await loadOrdersFromFile(userId, date)) || [];

  const index = orders.findIndex((o: any) => o.order.id == newOrder.order.id);

  if (index != -1) {
    // Merge parcial: combina propiedades nuevas o actualiza existentes
    orders[index] = {
      ...orders[index],
      ...newOrder,
      order: {
        ...orders[index].order,
        ...newOrder.order,
      },
      customer: {
        ...orders[index].customer,
        ...newOrder.customer,
      },
      services: newOrder.services || orders[index].services,
    };
  } else {
    orders.push(newOrder);
  }

  await saveOrdersToFile(userId, date, orders);
  return orders;
};
