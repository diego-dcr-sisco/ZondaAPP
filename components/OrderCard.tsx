import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { Card } from "react-native-paper";
import { Order } from "../app/types/order";
import { useColorScheme } from "../hooks/useColorScheme";
import { ThemedText } from "./ThemedText";
import { loadFromJsonFile } from "@/app/storage/jsonFileStorage";
import { Report } from "@/app/types/report";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ActiveOrder = {
  order_id: string | number;
  order_folio: string;
  time: string;
};

interface OrderCardProps {
  order: Order;
  isOnline?: boolean;
}

const statusColors: Record<number, string> = {
  0: "#FFA726", // Pendiente - Naranja
  1: "#42A5F5", // En Progreso - Azul
  2: "#66BB6A", // Completada - Verde
};

const syncColors: Record<number, string> = {
  0: "#F21C0D", // Pendiente - Rojo
  1: "#66BB6A", // Completada - Verde
};

const statusTranslations: Record<number, string> = {
  0: "Pendiente",
  1: "En Proceso",
  2: "Completada",
};

const statusIcons: Record<number, keyof typeof Ionicons.glyphMap> = {
  0: "time-outline",
  1: "construct-outline",
  2: "checkmark-done-outline",
};

// En un archivo de utils (ej: formatUtils.js)
const formatPrice = (price: any) => {
  if (price == null || isNaN(Number(price))) {
    return "--";
  }
  return `$${Number(price).toFixed(2)}`;
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, isOnline }) => {
  const colorScheme = useColorScheme() ?? "light";
  const secondaryTextColor = colorScheme === "dark" ? "#94A3B8" : "#263238";
  const borderColor = colorScheme === "dark" ? "#334155" : "#D6D3D1";
  const serviceNames = order.services.map((service) => service.name);
  const [report, setReport] = useState<Report | null | undefined>(null);

  const formattedDate = new Date(order.programmed_date).toLocaleDateString(
    "es-MX",
    {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  );

  const formattedTime = order.start_time
    ? order.start_time.substring(0, 5)
    : "--:--";

  useEffect(() => {
    const loadReport = async () => {
      const reports: Report[] | undefined =
        (await loadFromJsonFile("reports")) || [];
      setReport(reports?.find((r: Report) => r.order_id == order.id));
    };

    loadReport();
  }, [order]);

  const handlePress = async () => {
    try {
      const existingOrder = await AsyncStorage.getItem("active_order");
      let shouldProceed = false;

      if (existingOrder) {
        const parsedOrder = JSON.parse(existingOrder);
        if (parsedOrder.order_id != order.id) {
          Alert.alert(
            "Orden en progreso",
            "Ya tienes la orden #" +
              parsedOrder.order_folio +
              " activa. ¿Deseas abrir una nueva orden?",
            [
              {
                text: "Cancelar",
                style: "cancel",
              },
              {
                text: "Continuar",
                onPress: async () => {
                  await saveOrderAndNavigate();
                },
              },
            ]
          );
        } else {
          shouldProceed = true;
        }
      } else {
        shouldProceed = true;
      }

      if (shouldProceed) {
        await saveOrderAndNavigate();
      }
    } catch (error) {
      console.error("Error al manejar la orden:", error);
    }
  };

  const saveOrderAndNavigate = async () => {
    await AsyncStorage.setItem(
      "active_order",
      JSON.stringify({
        order_id: order.id,
        order_folio: order.folio,
        time: new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      })
    );

    router.push({
      pathname: "/(tabs)/order-details",
      params: { orderId: order.id.toString() },
    });
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Card style={[styles.card, { borderColor }]}>
        <Card.Content style={styles.cardContent}>
          <View style={{ flexDirection: "row", marginBottom: 10, gap: 10 }}>
            {/* Badge de estado de la orden */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: report?.is_finalized
                    ? statusColors[2]
                    : statusColors[order.status_id - 1],
                },
              ]}
            >
              <Ionicons
                name={statusIcons[order.status_id - 1] ?? ""}
                size={12}
                color="white"
              />
              <ThemedText style={styles.statusText}>
                {report?.is_finalized
                  ? statusTranslations[2]
                  : statusTranslations[order.status_id - 1]}
              </ThemedText>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: report?.is_synchronized
                    ? syncColors[1]
                    : syncColors[0],
                },
              ]}
            >
              <Ionicons
                name={report?.is_synchronized ? "sync" : "sync-circle-outline"}
                size={12}
                color="white"
              />
              <ThemedText style={styles.statusText}>
                {report?.is_synchronized ? "Sincronizado" : "No sincronizado"}
              </ThemedText>
            </View>
          </View>
          {/* Header con folio y estado */}
          <View style={styles.header}>
            <View style={styles.folioContainer}>
              <Ionicons
                name="document-text-outline"
                size={16}
                color="#3B82F6"
              />
              <ThemedText style={styles.folioText}>
                #{order.folio} ({order.id})
              </ThemedText>
            </View>

            <View style={styles.statusContainer}>
              {/* Icono de estado de conexión */}
              <View style={styles.connectionIcon}>
                <Ionicons
                  name={isOnline === false ? "cloud-offline" : "cloud"}
                  size={16}
                  color={isOnline === false ? "#EF4444" : "#10B981"}
                />
              </View>

              {/* Icono de estado de sincronización */}
              <View style={styles.syncIcon}>
                <Ionicons
                  name={
                    report?.is_synchronized
                      ? "cloud-done-outline"
                      : "cloud-upload-outline"
                  }
                  size={16}
                  color={
                    report && report.is_synchronized ? "#10B981" : "#EF4444"
                  }
                />
              </View>
            </View>
          </View>

          {/* Información de contacto */}
          <View style={styles.infoContainer}>
            {/* Nombre con salto de línea */}
            <View style={styles.infoItem}>
              <Ionicons
                name="person-outline"
                size={14}
                color={secondaryTextColor}
                style={styles.fixedIcon}
              />
              <ThemedText style={styles.customerName}>
                {order.customer.name || "Sin Nombre"}
              </ThemedText>
            </View>

            {/* Dirección con salto de línea */}
            <View style={styles.infoItem}>
              <Ionicons
                name="location-outline"
                size={14}
                color={secondaryTextColor}
                style={styles.fixedIcon}
              />
              <ThemedText style={styles.customerAddress}>
                {order.customer.address || "Sin dirección"}
              </ThemedText>
            </View>

            {/* Información fija (una línea) */}
            <View style={styles.infoItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={secondaryTextColor}
                style={styles.fixedIcon}
              />
              <ThemedText style={styles.infoText} numberOfLines={1}>
                {formattedDate}
              </ThemedText>
            </View>
          </View>

          {/* Servicios */}
          <View style={styles.servicesSection}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="list-outline"
                size={14}
                color={secondaryTextColor}
              />
              <ThemedText style={styles.sectionTitle}>Servicios</ThemedText>
            </View>
            <View style={styles.servicesList}>
              {serviceNames.slice(0, 2).map((name, index) => (
                <View key={index} style={styles.serviceChip}>
                  <ThemedText style={styles.serviceText}>{name}</ThemedText>
                </View>
              ))}
              {serviceNames.length > 2 && (
                <View style={styles.moreChip}>
                  <ThemedText style={styles.moreText}>
                    +{serviceNames.length - 2} más
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Footer con precio y acción */}
          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <View style={styles.priceContainer}>
              <ThemedText style={styles.totalLabel}>Total:</ThemedText>
              <ThemedText style={styles.totalAmount}>
                {formatPrice(order?.price)}
              </ThemedText>
            </View>

            <View style={styles.actionContainer}>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={secondaryTextColor}
              />
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#000000",
    backgroundColor: "#FFFFFF",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    overflow: "hidden",
  },
  cardContent: {
    padding: 16,
  },

  infoContainer: {
    gap: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  fixedIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  customerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
    flexWrap: "wrap",
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 20, // Mejor espaciado entre líneas
  },
  customerAddress: {
    fontSize: 14,
    color: "#64748B",
    flex: 1,
    flexWrap: "wrap",
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 18,
  },
  infoText: {
    fontSize: 14,
    color: "#64748B",
    flex: 1,
    minWidth: 0,
  },

  statusContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  connectionIcon: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
  },
  syncIcon: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
  },

  // Eliminar o mantener los badges antiguos según prefieras
  badgesContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8, // Añadir margen superior si se mantiene
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  folioContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  folioText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  mainContent: {
    gap: 12,
    marginBottom: 16,
  },

  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  servicesSection: {
    marginVertical: 10,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  servicesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  serviceChip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serviceText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#455A64",
  },
  moreChip: {
    backgroundColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  moreText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#263238",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#263238",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#059669",
  },
  actionContainer: {
    padding: 4,
  },
});
