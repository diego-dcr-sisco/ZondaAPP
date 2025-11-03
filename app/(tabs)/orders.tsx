import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState, useCallback } from "react";

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getOrdersHistory,
  loadFromJsonFile,
  saveToJsonFile,
  updateOrdersHistory,
  clearJsonFile,
} from "../storage/jsonFileStorage";

import { OrderCard } from "../../components/OrderCard";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import { useAuth } from "../context/AuthContext";
import { Order } from "../types/order";
import { getOrders } from "../utils/handleOrders";

import { useFocusEffect } from "@react-navigation/native";

export default function OrdersScreen() {
  const colorScheme = useColorScheme();
  const { logout, user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // En tu OrdersScreen, actualiza la función loadOrders:
  const loadOrders = async (currentUserId: string, currentDate: Date) => {
    //await clearJsonFile("orders");
    //await clearJsonFile("reports");
    //await clearJsonFile("orders_history");

    //console.log(await loadFromJsonFile("orders"));
    //console.log(await loadFromJsonFile("reports"));
    //console.log(await loadFromJsonFile("orders_history"))

    try {
      setLoading(true);
      const dateStr = currentDate
        .toLocaleDateString("es-MX", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .split("/")
        .reverse()
        .join("-");

      const cacheKey = `orders_${currentUserId}_${dateStr}`;

      //await clearJsonFile("reports");
      //await clearJsonFile("orders");
      //await clearJsonFile("orders_history");

      if (isOnline) {
        try {
          // Intenta obtener órdenes del servidor
          const data = await getOrders(currentUserId, dateStr);
          if (data) {
            setOrders(data);
            // Guardar en caché específico de la fecha
            await saveToJsonFile(cacheKey, {
              data,
              lastUpdated: new Date().toISOString(),
            });

            // Actualizar el historial completo
            await updateOrdersHistory(data);
          }
        } catch (error) {
          await loadFromCache(cacheKey);
        }
      } else {
        // Modo offline - intenta cargar del historial completo
        const allOrders = await getOrdersHistory();
        const filteredOrders = allOrders.filter((order: Order) => {
          const orderDate = new Date(order.programmed_date)
            .toISOString()
            .split("T")[0];
          return orderDate === dateStr;
        });

        if (filteredOrders.length > 0) {
          setOrders(filteredOrders);
          Alert.alert("Modo Offline", "Viendo datos del historial local");
        } else {
          await loadFromCache(cacheKey);
        }
      }
    } catch (error) {
      console.error("Error general cargando órdenes:", error);
      setOrders([]);
      Alert.alert("Error", "No se pudieron cargar las órdenes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFromCache = async (cacheKey: string) => {
    const cachedData = await loadFromJsonFile(cacheKey);

    if (cachedData?.data) {
      setOrders(cachedData.data);
      Alert.alert(
        "Modo Offline",
        "Estás viendo órdenes almacenadas localmente"
      );
    } else {
      setOrders([]);
      Alert.alert("Sin conexión", "No hay órdenes almacenadas localmente");
    }
  };

  /*useEffect(() => {
    if (user?.userId) {
      loadOrders(user?.userId.toString(), date);
    }
  }, [userId, date]);*/

  const loadData = useCallback(() => {
    if (user?.userId) {
      loadOrders(user.userId.toString(), date);
    }
  }, [user?.userId, date]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = state.isConnected ?? false;
      setIsOnline(nowOnline);

      if (nowOnline && !isOnline) {
        loadData(); // Usar la nueva función
      }
    });

    return () => unsubscribe();
  }, [isOnline, loadData]); // Agregar loadData a las dependencias

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onRefresh = () => {
    if (user?.userId) {
      setRefreshing(true);
      loadOrders(user?.userId.toString(), date);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Ordenes de servicio
        </ThemedText>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.dateButton,
              {
                backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
              },
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={Colors[colorScheme ?? "light"].text}
            />
            <ThemedText style={styles.dateText}>
              {date.toLocaleDateString()}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
              },
            ]}
            onPress={onRefresh}
            disabled={refreshing || loading}
          >
            {refreshing || loading ? (
              <ActivityIndicator color={Colors[colorScheme ?? "light"].tint} />
            ) : (
              <Ionicons
                name="refresh"
                size={22}
                color={Colors[colorScheme ?? "light"].tint}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker value={date} mode="date" onChange={onDateChange} />
      )}

      <FlatList
        data={orders}
        keyExtractor={(order) => order.id.toString()}
        renderItem={({ item }) => (
          <OrderCard order={item} isOnline={isOnline} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText style={{ textAlign: "center", marginTop: 20 }}>
              No hay órdenes para la fecha seleccionada.
            </ThemedText>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    paddingTop: 40,
    backgroundColor: "#ffffff",
    display: "flex",
    gap: 6,
    marginBottom: 10,
  },
  title: { fontSize: 24 },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  dateText: { marginLeft: 8, fontSize: 16 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: { paddingVertical: 8 },
});
