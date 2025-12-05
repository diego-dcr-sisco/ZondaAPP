import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import {
  getOrdersHistory,
  loadFromJsonFile,
  saveToJsonFile,
} from "../storage/jsonFileStorage";
import { Order } from "../types/order";
import { Report } from "../types/report";

import { syncReportsToServer } from "../utils/handleRepors"; // ajusta si tu estructura es distinta

import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export default function SyncReportsScreen() {
  const colorScheme = useColorScheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedReports, setSelectedReports] = useState<number[]>([]);
  const [ordersMap, setOrdersMap] = useState<Map<number, Order>>(new Map());

  // Cargar reportes no sincronizados
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadUnsyncedReports = async () => {
        try {
          setLoading(true);
          const allReports: Report[] =
            (await loadFromJsonFile("reports")) || [];
          const history_orders: Order[] = await getOrdersHistory();
          const unsyncedReports = allReports.filter(
            (report) => !report.is_synchronized && report.is_finalized
          );
          if (isActive) {
            setReports(unsyncedReports);
            setOrders(
              history_orders.filter((h_ord) =>
                unsyncedReports.some((r) => r.order_id == h_ord.id)
              )
            );
            // Crear un mapa para búsqueda rápida de folios
            setOrdersMap(
              new Map(history_orders.map((order) => [order.id, order]))
            );
          }
        } catch (error) {
          console.error("Error cargando reportes:", error);
          Alert.alert("Error", "No se pudieron cargar los reportes");
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      loadUnsyncedReports();

      return () => {
        isActive = false; // Cleanup si se desmonta antes de terminar
      };
    }, [])
  );

  // Función para sincronizar reportes seleccionados
  const syncSelectedReports = async () => {
    if (selectedReports.length === 0) {
      Alert.alert(
        "Advertencia",
        "Selecciona al menos un reporte para sincronizar"
      );
      return;
    }

    setSyncing(true);
    try {
      // 1. Filtrar reportes seleccionados
      // Dentro de syncSelectedReports:
      const reportsToSync = reports.filter((report) =>
        selectedReports.includes(report.order_id)
      );

      // 2. Simular envío al servidor (reemplazar con tu API real)
      const syncSuccess = await syncReportsToServer(reportsToSync);
      //console.log("syncSuccess:", syncSuccess);

      if (syncSuccess) {
        // 3. Actualizar estado local
        const allReports: Report[] = (await loadFromJsonFile("reports")) || [];
        const updatedReports = allReports.map((report) => {
          if (selectedReports.includes(report.order_id)) {
            return {
              ...report,
              is_synchronized: true,
              synchronized_at: new Date().toISOString(),
            };
          }
          return report;
        });

        // 4. Guardar cambios
        await saveToJsonFile("reports", updatedReports);

        // 5. Actualizar vista
        const remainingUnsynced = updatedReports.filter(
          (r) => !r.is_synchronized
        );
        setReports(remainingUnsynced);
        setSelectedReports([]);

        Alert.alert(
          "Éxito",
          `${selectedReports.length} reportes sincronizados correctamente`
        );
      } else {
        //Alert.alert("Error", "Falló la sincronización con el servidor");
        //console.error("Falló la sincronización con el servidor");
      }
    } catch (error) {
      console.error("Error en sincronización:", error);
      Alert.alert("Error", "Ocurrió un problema al sincronizar");
      
    } finally {
      setSyncing(false);
    }
  };

  // Alternar selección de reporte
  const toggleReportSelection = (orderId: number) => {
    setSelectedReports((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id != orderId)
        : [...prev, orderId]
    );
  };

  // Renderizar cada ítem de reporte
  const renderReportItem = ({ item }: { item: Report }) => {
    const orderInfo = ordersMap.get(item.order_id);
    return (
      <TouchableOpacity
        style={[
          styles.reportItem,
          {
            borderColor: Colors[colorScheme ?? "light"].border,
            backgroundColor: selectedReports.includes(item.order_id)
              ? Colors[colorScheme ?? "light"].tintLight
              : Colors[colorScheme ?? "light"].background,
          },
        ]}
        onPress={() => toggleReportSelection(item.order_id)}
      >
        <View style={styles.reportHeader}>
          <Ionicons
            name={
              selectedReports.includes(item.order_id)
                ? "checkbox"
                : "square-outline"
            }
            size={24}
            color={Colors[colorScheme ?? "light"].tint}
          />
          <ThemedText style={styles.reportTitle}>
            Orden #{item.order_id} ({orderInfo?.folio})
          </ThemedText>
        </View>

        <View style={styles.reportDetails}>
          <ThemedText style={styles.detailText}>
            <Ionicons name="calendar" size={14} />{" "}
            {item.completed_date
              ? new Date(item.completed_date).toLocaleDateString()
              : "Sin fecha"}
          </ThemedText>
          <ThemedText style={styles.detailText}>
            <Ionicons name="time" size={14} /> {item.start_time} - {" "}
            {item.end_time || "Sin finalizar"}
          </ThemedText>
        </View>

        <View style={styles.reportStats}>
          <ThemedText style={styles.statText}>
            <Ionicons name="list" size={14} /> {item.reviews?.length || 0} dispositivos
          </ThemedText>
          <ThemedText style={styles.statText}>
            <Ionicons name="flask" size={14} /> {item.products?.length || 0} productos
          </ThemedText>
          <ThemedText style={styles.statText}>
            <Ionicons name="bug" size={14} /> {item.pests?.length || 0} plagas
          </ThemedText>
        </View>

        {item.is_finalized && (
          <ThemedText style={styles.finalizedBadge}>
            <Ionicons name="checkmark-done" size={14} /> FINALIZADA
          </ThemedText>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme ?? "light"].tint}
        />
        <ThemedText style={styles.loadingText}>Cargando reportes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Sincronizar Reportes
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {reports.length} reportes pendientes de sincronización
        </ThemedText>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.order_id.toString()}
        renderItem={renderReportItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <ThemedView style={styles.emptyContainer}>
            <Ionicons
              name="cloud-done"
              size={48}
              color={Colors[colorScheme ?? "light"].text}
            />
            <ThemedText style={styles.emptyText}>
              Todos los reportes están sincronizados
            </ThemedText>
          </ThemedView>
        }
      />

      {reports.length > 0 && (
        <TouchableOpacity
          style={[
            styles.syncButton,
            { backgroundColor: Colors[colorScheme ?? "light"].tint },
          ]}
          onPress={syncSelectedReports}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="white" />
              <ThemedText style={styles.syncButtonText}>
                Sincronizar{" "}
                {selectedReports.length > 0
                  ? `(${selectedReports.length})`
                  : ""}
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    paddingBottom: 20,
  },
  reportItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  reportDetails: {
    marginBottom: 8,
    gap: 4,
  },
  detailText: {
    fontSize: 14,
  },
  reportStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  statText: {
    fontSize: 13,
  },
  finalizedBadge: {
    color: "#10B981",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  syncButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
