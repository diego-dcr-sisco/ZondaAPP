import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { Card } from "react-native-paper";
import SignatureCanvas from "react-native-signature-canvas";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import { loadFromJsonFile, saveToJsonFile } from "../storage/jsonFileStorage";
import { Order } from "../types/order";
import { Report, Review } from "../types/report";
import { Service } from "../types/service";

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";

import { syncReportsToServer } from "../utils/handleRepors";

import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { Device } from "../types/device";
import { useEffect } from "react";

type ActiveOrder = {
  order_id: string | number;
  order_folio: string;
  time: string;
};

const { width, height } = Dimensions.get("window");
const SCAN_FRAME_SIZE = width * 0.7;

export default function OrderDetailsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [userId, setUserId] = useState(null);
  const signatureRef = useRef<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [signature, setSignature] = useState<string | null>();
  const [syncing, setSyncing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedData, setScannedData] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [signatureName, setSignatureName] = useState("");

  const isReportLocked = currentReport?.is_finalized && currentReport?.is_synchronized;

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          const orders = await loadFromJsonFile("orders");
          const loadedReports: Report[] =
            (await loadFromJsonFile("reports")) || [];
          const mockOrder = orders.find(
            (ord: Order) => ord.id == Number(orderId)
          );
          const report: Report | null =
            loadedReports.find(
              (lr: Report) => lr.order_id == Number(orderId)
            ) ?? null;

          setOrder(mockOrder);
          setReports(loadedReports);
          setNotes(mockOrder?.notes || "");
          setCurrentReport(report);
          setNotes(report?.notes || "");
          setSignature(report?.customer_signature || null);
        } catch (error) {
          console.error("Error fetching data:", error);
          Alert.alert("Error", "No se pudieron cargar los datos");
        }

        const userData = await AsyncStorage.getItem("userData");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUserId(parsedUser["userId"]);
        }
      };

      const unsubscribe = NetInfo.addEventListener((state) => {
        const nowOnline = state.isConnected ?? false;
        setIsOnline(nowOnline);
      });

      unsubscribe();
      fetchData();
    }, [orderId, isOnline])
  );

  const isServiceComplete = (service: Service) => {
    const serviceReport = reports.find((r) => r.order_id === Number(orderId));
    if (serviceReport) {
      return true;
    } else {
      return false;
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScannedData(data);
    Alert.alert("Código Escaneado", data, [
      { text: "OK", onPress: () => setShowQRScanner(false) },
    ]);
  };

  const openScanner = async () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede escanear QR en un reporte finalizado y sincronizado."
      );
      return;
    }

    const { status } = await requestPermission();
    if (status === "granted") {
      setScannedData("");
      setShowQRScanner(true);
    } else {
      Alert.alert(
        "Permiso denegado",
        "Se necesita acceso a la cámara para escanear QR"
      );
    }
  };

  const openMaps = () => {
    const url = order?.customer?.map_url;
    if (!url) {
      Alert.alert("Error", "No se encontró la dirección del cliente");
      return;
    }
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("Error", "No se pudo abrir Google Maps");
      }
    });
  };

  const handleServicePress = (serviceId: number) => {
    /*if (isReportLocked) {
      Alert.alert(
        "Reporte Inactivo",
        "No se pueden modificar servicios en un reporte finalizado y sincronizado."
      );
      return;
    }*/
    router.push({
      pathname: "/(tabs)/service-details",
      params: {
        orderId: order?.id.toString(),
        serviceId: serviceId.toString(),
        serviceName:
          order?.services.find((s) => s.id === serviceId)?.name || "Servicio",
        isLocked: '1',
      },
    });
  };

  const handleSignature = async (signature: string, name: string = "") => {
    setSignature(signature);
    setSignatureName(name);
    setShowSignature(false);
  };

  const handleSaveNotes = async () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se pueden modificar notas en un reporte finalizado y sincronizado."
      );
      return;
    }

    try {
      const allReports: Report[] = (await loadFromJsonFile("reports")) || [];
      const now = new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const reportIndex = allReports.findIndex(
        (r) => r.order_id === Number(orderId)
      );

      if (reportIndex !== -1) {
        allReports[reportIndex] = {
          ...allReports[reportIndex],
          notes,
          is_synchronized: false,
        };

        setCurrentReport(allReports[reportIndex]);
      } else {
        const newReport: Report = {
          order_id: Number(orderId),
          user_id: userId ?? null,
          start_time: now,
          end_time: null,
          completed_date: now,
          notes,
          customer_signature: null,
          signature_name: signatureName,
          reviews: [],
          products: [],
          pests: [],
          is_finalized: false,
          is_synchronized: false,
          status_id: order?.status_id ?? 1,
        };

        allReports.push(newReport);
        setCurrentReport(newReport);
      }

      await saveToJsonFile("reports", allReports);
      setOrder((prev) => (prev ? { ...prev, notes } : null));
      setIsEditingNotes(false);

      Alert.alert("Éxito", "Notas guardadas correctamente");
    } catch (error) {
      console.error("Error saving notes:", error);
      Alert.alert("Error", "No se pudieron guardar las notas");
    }
  };

  const handlePickImage = async () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede modificar la firma en un reporte finalizado y sincronizado."
      );
      return;
    }

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Error", "Se necesita permiso para acceder a la galería");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const signature = `data:image/jpeg;base64,${result.assets[0].base64}`;

        Alert.prompt(
          "Nombre de quien firma",
          "Por favor ingresa el nombre de la persona que firma",
          [
            {
              text: "Cancelar",
              style: "cancel",
            },
            {
              text: "Guardar",
              onPress: (name: any) => handleSignature(signature, name || ""),
            },
          ],
          "plain-text"
        );
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "No se pudo cargar la imagen");
    }
  };

  const handleTakePhoto = async () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede modificar la firma en un reporte finalizado y sincronizado."
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Error", "Se necesita permiso para acceder a la cámara");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const signature = `data:image/jpeg;base64,${result.assets[0].base64}`;

        Alert.prompt(
          "Nombre de quien firma",
          "Por favor ingresa el nombre de la persona que firma",
          [
            {
              text: "Cancelar",
              style: "cancel",
            },
            {
              text: "Guardar",
              onPress: (name: any) => handleSignature(signature, name || ""),
            },
          ],
          "plain-text"
        );
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "No se pudo cargar la imagen");
    }
  };

  const showSignatureOptions = () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede modificar la firma en un reporte finalizado y sincronizado."
      );
      return;
    }

    Alert.alert("Añadir Firma", "¿Cómo deseas añadir la firma?", [
      {
        text: "Dibujar Firma",
        onPress: () => setShowSignature(true),
      },
      {
        text: "Seleccionar Imagen",
        onPress: handlePickImage,
      },
      {
        text: "Tomar Foto",
        onPress: handleTakePhoto,
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  const handleDeleteSignature = async () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede eliminar la firma en un reporte finalizado y sincronizado."
      );
      return;
    }

    Alert.alert(
      "Eliminar Firma",
      "¿Estás seguro que deseas eliminar la firma?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setSignature(null);
              const allReports: Report[] =
                (await loadFromJsonFile("reports")) || [];
              const reportIndex = allReports.findIndex(
                (r) => r.order_id === Number(orderId)
              );

              if (reportIndex !== -1) {
                const updatedReport = {
                  ...allReports[reportIndex],
                  customer_signature: null,
                  is_synchronized: false,
                };
                allReports[reportIndex] = updatedReport;

                await saveToJsonFile("reports", allReports);
                setCurrentReport(updatedReport);
              }

              Alert.alert("Éxito", "Firma eliminada correctamente");
            } catch (error) {
              console.error("Error al eliminar la firma:", error);
              Alert.alert("Error", "No se pudo eliminar la firma.");
            }
          },
        },
      ]
    );
  };

  const showSignatureModifyOptions = () => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede modificar la firma en un reporte finalizado y sincronizado."
      );
      return;
    }

    Alert.alert("Modificar Firma", "¿Qué deseas hacer con la firma?", [
      {
        text: "Cambiar Firma",
        onPress: showSignatureOptions,
      },
      {
        text: "Eliminar Firma",
        onPress: handleDeleteSignature,
        style: "destructive",
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  const renderServices = () => {
    if (!order?.services || order?.services.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="file-tray-outline" size={48} color="#C4C4C4" />
          <ThemedText style={styles.emptyText}>
            No hay servicios registrados
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Agregue servicios para comenzar
          </ThemedText>
        </View>
      );
    }

    return order.services.map((service, index) => {
      const isComplete = isServiceComplete(service);

      return (
        <View
          key={service.id}
          style={[
            styles.serviceItem,
            index === order.services.length - 1 && styles.lastServiceItem,
          ]}
        >
          <View style={styles.serviceContent}>
            <View style={styles.serviceHeader}>
              <ThemedText style={styles.serviceName} numberOfLines={1}>
                {service.name}
              </ThemedText>
            </View>

            {service.description && (
              <ThemedText
                style={styles.serviceDescription}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {service.description}
              </ThemedText>
            )}

            <TouchableOpacity
              onPress={() => handleServicePress(service.id)}
              style={styles.viewServiceButton}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.viewServiceButtonText}>
                Ver Servicio
              </ThemedText>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  if (!order) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  if (showSignature) {
    return (
      <ThemedView style={styles.signatureModalContainer}>
        <View style={styles.signatureHeader}>
          <TouchableOpacity
            onPress={() => setShowSignature(false)}
            style={styles.backButton}
          >
            <Ionicons
              name="close"
              size={24}
              color={Colors[colorScheme ?? "light"].text}
            />
          </TouchableOpacity>
          <ThemedText style={styles.signatureTitle}>
            Firma del Cliente
          </ThemedText>
        </View>

        <View style={styles.signatureNameContainer}>
          <TextInput
            style={[
              styles.signatureNameInput,
              {
                color: Colors[colorScheme ?? "light"].text,
                backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
              },
            ]}
            value={signatureName}
            onChangeText={setSignatureName}
            placeholder="Nombre de quien firma"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.signatureCanvasContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={(signature) => handleSignature(signature, signatureName)}
            onEmpty={() =>
              Alert.alert("Error", "Por favor firme antes de guardar")
            }
            descriptionText="Firme aquí"
            clearText="Limpiar"
            confirmText="Guardar"
            webStyle={`.m-signature-pad--footer { 
              display: flex; justify-content: space-between; 
            }
            .m-signature-pad--footer .button {
              background-color: ${Colors[colorScheme ?? "light"].tint};
              color: white;
              padding: 10px 20px;
              border-radius: 5px;
              border: none;
              marginTop: 40px;
            }`}
          />
        </View>
      </ThemedView>
    );
  }

  const finalizeReport = async () => {
    Alert.alert(
      "Finalizar Orden",
      "¿Estás seguro que deseas finalizar esta orden? Esta acción no se puede deshacer.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Finalizar",
          style: "destructive",
          onPress: async () => {
            try {
              setSyncing(true);

              const finalizationSuccess = await updateReportFinalization(
                order.id,
                true,
                {
                  notes,
                  customer_signature: signature ?? undefined,
                }
              );

              if (!finalizationSuccess) {
                throw new Error("No se pudo finalizar el reporte localmente");
              }

              const allReports: Report[] =
                (await loadFromJsonFile("reports")) || [];
              const updatedReport = allReports.find(
                (r) => r.order_id === Number(orderId)
              );

              if (!updatedReport) {
                throw new Error("No se encontró el reporte actualizado");
              }

              setCurrentReport(updatedReport);

              if (isOnline) {
                const syncSuccess = await syncReportsToServer([updatedReport]);

                if (syncSuccess) {
                  const syncedReports = allReports.map((report) =>
                    report.order_id === updatedReport.order_id
                      ? {
                          ...report,
                          is_synchronized: true,
                          synchronized_at: new Date().toISOString(),
                        }
                      : report
                  );

                  await saveToJsonFile("reports", syncedReports);
                  setCurrentReport(
                    syncedReports.find((r) => r.order_id === Number(orderId)) ||
                      null
                  );

                  Alert.alert(
                    "Éxito",
                    "Orden finalizada y sincronizada correctamente"
                  );
                } else {
                  Alert.alert(
                    "Éxito Parcial",
                    "Orden finalizada, pero no se pudo sincronizar. Se intentará más tarde."
                  );
                }
              } else {
                Alert.alert(
                  "Éxito",
                  "Orden finalizada correctamente. Se sincronizará cuando haya conexión."
                );
              }
            } catch (error) {
              console.error("Error en finalizeReport:", error);
              Alert.alert(
                "Error",
                "No se pudo completar el proceso de finalización"
              );
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  const updateReportFinalization = async (
    orderId: number,
    isFinalized: boolean,
    options?: {
      notes?: string;
      customer_signature?: string;
      signature_name?: string;
    }
  ): Promise<boolean> => {
    try {
      const allReports: Report[] = (await loadFromJsonFile("reports")) || [];

      const storedOrder = await AsyncStorage.getItem("active_order");
      let activeOrder: ActiveOrder | null = null;

      if (storedOrder) {
        try {
          const parsed = JSON.parse(storedOrder);
          if (parsed?.order_id && parsed?.time) {
            activeOrder = parsed as ActiveOrder;
          }
        } catch (e) {
          console.error("Error parsing active_order:", e);
        }
      }

      const now = new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const reportIndex = allReports.findIndex((r) => r.order_id === orderId);

      if (reportIndex !== -1) {
        allReports[reportIndex] = {
          ...allReports[reportIndex],
          user_id: userId ?? null,
          is_finalized: isFinalized,
          start_time: activeOrder?.time ?? allReports[reportIndex].start_time,
          end_time: isFinalized ? now : null,
          notes: options?.notes ?? allReports[reportIndex].notes,
          customer_signature:
            options?.customer_signature ??
            allReports[reportIndex].customer_signature,
          signature_name:
            options?.signature_name ?? allReports[reportIndex].signature_name,
        };
      } else {
        const newReport: Report = {
          order_id: orderId,
          user_id: userId ?? null,
          start_time: activeOrder?.time ?? now,
          end_time: isFinalized ? now : null,
          completed_date: now,
          notes: options?.notes ?? null,
          customer_signature: options?.customer_signature ?? null,
          signature_name: signatureName,
          reviews: [],
          products: [],
          pests: [],
          is_finalized: isFinalized,
          is_synchronized: false,
          status_id: 1,
        };
        allReports.push(newReport);
      }

      await saveToJsonFile("reports", allReports);
      return true;
    } catch (error) {
      console.error("Error updating report finalization:", error);
      return false;
    }
  };

  const handleQRCodeScanned = async (scanningResult: BarcodeScanningResult) => {
    if (isReportLocked) {
      Alert.alert(
        "Función Bloqueada",
        "No se puede escanear QR en un reporte finalizado y sincronizado."
      );
      return;
    }

    const { data } = scanningResult;
    setScannedData(data);
    setShowQRScanner(false);

    if (!order) {
      Alert.alert("Error", "No se pudo cargar la información de la orden");
      return;
    }

    let deviceFound: Device | null = null;
    let serviceFound: Service | null = null;

    for (const service of order.services) {
      const matchingDevice = service.devices?.find(
        (device: Device) => device.code === data
      );
      if (matchingDevice) {
        deviceFound = matchingDevice;
        serviceFound = service;
        break;
      }
    }

    if (!deviceFound || !serviceFound) {
      Alert.alert(
        "Código QR Escaneado",
        `Resultado: ${data}\n\nNo se encontró un dispositivo asociado a este código.`,
        [{ text: "OK" }]
      );
      return;
    }

    try {
      const allReports: Report[] = (await loadFromJsonFile("reports")) || [];
      let report = allReports.find((r) => r.order_id === Number(orderId));

      if (!report) {
        report = {
          order_id: Number(orderId),
          user_id: userId ?? null,
          start_time: new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          end_time: null,
          completed_date: new Date().toISOString(),
          notes: null,
          customer_signature: null,
          signature_name: null,
          reviews: [],
          products: [],
          pests: [],
          is_finalized: false,
          is_synchronized: false,
          status_id: order.status_id ?? 1,
        };
        allReports.push(report);
      }

      let reviewIndex = report.reviews.findIndex(
        (r) => r.device_id === deviceFound?.id
      );
      let review: Review;

      if (reviewIndex === -1) {
        review = {
          device_id: deviceFound.id,
          pests: [],
          products: [],
          answers: [],
          image: null,
          is_checked: false,
          is_scanned: true,
        };
        report.reviews.push(review);
        reviewIndex = report.reviews.length - 1;
      } else {
        review = {
          ...report.reviews[reviewIndex],
          is_scanned: true,
        };
        report.reviews[reviewIndex] = review;
      }

      await saveToJsonFile("reports", allReports);

      router.push({
        pathname: "/(tabs)/device-details",
        params: {
          orderId: orderId,
          serviceId: serviceFound.id.toString(),
          serviceName: serviceFound.name,
          deviceId: deviceFound.id.toString(),
          deviceData: JSON.stringify(deviceFound),
          productsData: JSON.stringify(serviceFound.products),
          pestsData: JSON.stringify(serviceFound.pests),
          reviewData: JSON.stringify(review),
        },
      });
    } catch (error) {
      console.error("Error al procesar el escaneo:", error);
      Alert.alert("Error", "Ocurrió un error al procesar el código QR");
    }
  };

  const synchronizeReport = async () => {
    if (!isOnline) {
      Alert.alert(
        "Sin conexión",
        "No hay conexión a internet. Conéctate para sincronizar el reporte."
      );
      return;
    }

    try {
      setSyncing(true);

      const allReports: Report[] = (await loadFromJsonFile("reports")) || [];

      if (!currentReport) {
        Alert.alert("Error", "No se encontró el reporte para sincronizar");
        return;
      }

      if (!currentReport.is_finalized) {
        Alert.alert(
          "Reporte no finalizado",
          "Debes finalizar el reporte antes de sincronizarlo"
        );
        return;
      }

      if (currentReport.is_synchronized) {
        Alert.alert(
          "Ya sincronizado",
          "Este reporte ya ha sido sincronizado anteriormente"
        );
        return;
      }

      const syncSuccess = await syncReportsToServer([currentReport]);

      if (syncSuccess) {
        const updatedReports = allReports.map((report) => {
          if (report.order_id === currentReport.order_id) {
            return {
              ...report,
              is_synchronized: true,
              synchronized_at: new Date().toISOString(),
            };
          }
          return report;
        });

        await saveToJsonFile("reports", updatedReports);

        setCurrentReport(
          updatedReports.find((r) => r.order_id === currentReport.order_id) ||
            null
        );

        Alert.alert(
          "Éxito",
          "Reporte sincronizado correctamente con el servidor"
        );
      }
    } catch (error) {
      console.error("Error en sincronización:", error);
      Alert.alert(
        "Error de sincronización",
        "Ocurrió un problema al sincronizar con el servidor. Intenta nuevamente."
      );
    } finally {
      setSyncing(false);
    }
  };

  const editReport = async () => {
    try {
      const allReports: Report[] = (await loadFromJsonFile("reports")) || [];

      const reportIndex = allReports.findIndex(
        (r) => r.order_id === Number(orderId)
      );

      if (reportIndex !== -1) {
        allReports[reportIndex] = {
          ...allReports[reportIndex],
          is_finalized: false,
          is_synchronized: false,
          end_time: null,
        };

        await saveToJsonFile("reports", allReports);

        setCurrentReport(allReports[reportIndex]);

        Alert.alert(
          "Éxito",
          "El reporte ahora está en modo edición. Puedes realizar cambios.",
          [{ text: "OK" }]
        );

        const updatedReports = await loadFromJsonFile("reports");
        setReports(updatedReports);
      } else {
        Alert.alert("Error", "No se encontró el reporte para editar");
      }
    } catch (error) {
      console.error("Error al editar el reporte:", error);
      Alert.alert("Error", "No se pudo habilitar la edición del reporte");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={Colors[colorScheme ?? "light"].text}
          />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>
          Orden #{order.folio.split("-")[1]} - ID: {order.id}
        </ThemedText>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.card, styles.servicesCard]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <ThemedText style={styles.sectionTitle}>
                Información del Cliente
              </ThemedText>
            </View>

            <View style={styles.clientInfoContainer}>
              <View style={styles.clientNameContainer}>
                <ThemedText style={styles.clientName}>
                  {order.customer?.name}
                </ThemedText>
              </View>

              <View style={styles.infoBoxNoShadow}>
                <TouchableOpacity onPress={openMaps} style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color="#A3044C"
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>Dirección</ThemedText>
                    <ThemedText style={styles.infoText} numberOfLines={2}>
                      {order.address}
                    </ThemedText>
                  </View>
                  <View style={styles.infoAction}>
                    <Ionicons name="open-outline" size={18} color="#3498db" />
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#A3044C"
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>
                      Fecha programada
                    </ThemedText>
                    <ThemedText style={styles.infoText}>
                      {new Date(order.programmed_date).toLocaleDateString(
                        "es-MX",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        }
                      )}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Ionicons
                      name="pricetag-outline"
                      size={20}
                      color="#A3044C"
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>
                      Tipo de servicio
                    </ThemedText>
                    <ThemedText style={styles.infoText}>
                      {order.service_type}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.card, styles.servicesCard]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.sectionTitle}>Servicios</ThemedText>
              <View style={styles.counterBadge}>
                <ThemedText style={styles.counterText}>
                  {order?.services?.length || 0}
                </ThemedText>
              </View>
            </View>

            <View style={styles.servicesList}>{renderServices()}</View>
          </Card.Content>
        </Card>

        <Card style={[styles.card, styles.qrCard]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.sectionTitle}>
                Escanear Código QR
              </ThemedText>
              {isReportLocked && (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.lockedBadgeText}>Inactivo</ThemedText>
                </View>
              )}
            </View>

            <View style={styles.qrContent}>
              {isReportLocked ? (
                <View style={styles.lockedFunctionContainer}>
                  <Ionicons name="lock-closed" size={48} color="#9CA3AF" />
                  <ThemedText style={styles.lockedFunctionText}>
                    Escaneo QR no disponible
                  </ThemedText>
                  <ThemedText style={styles.lockedFunctionSubtext}>
                    El reporte finalizado y sincronizado no permite modificaciones
                  </ThemedText>
                </View>
              ) : !showQRScanner ? (
                <>
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={openScanner}
                    activeOpacity={0.8}
                  >
                    <View style={styles.qrButtonIconContainer}>
                      <Ionicons
                        name="qr-code-outline"
                        size={32}
                        color="#FFFFFF"
                      />
                    </View>
                    <ThemedText style={styles.qrButtonText}>
                      Iniciar Escaneo QR
                    </ThemedText>
                    <ThemedText style={styles.qrButtonSubtext}>
                      Toca para escanear un código QR
                    </ThemedText>
                  </TouchableOpacity>

                  {scannedData ? (
                    <View style={styles.scannedDataContainer}>
                      <View style={styles.scannedDataHeader}>
                        <Ionicons
                          name="checkmark-done-circle"
                          size={18}
                          color="#10B981"
                        />
                        <ThemedText style={styles.scannedDataTitle}>
                          Último escaneo realizado
                        </ThemedText>
                      </View>
                      <View style={styles.scannedDataContent}>
                        <ThemedText
                          style={styles.scannedDataText}
                          numberOfLines={2}
                        >
                          {scannedData}
                        </ThemedText>

                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => {
                            Clipboard.setStringAsync(scannedData);
                          }}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={16}
                            color="#4a90e2"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.helpTextContainer}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#6B7280"
                      />
                      <ThemedText style={styles.helpText}>
                        Escanea el código QR del dispositivo para generar o
                        visualizar una revisión
                      </ThemedText>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.scannerContainer}>
                  <CameraView
                    style={styles.cameraView}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    onBarcodeScanned={handleQRCodeScanned}
                  >
                    <View style={styles.scannerOverlay}>
                      <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                      </View>
                    </View>
                  </CameraView>

                  <View style={styles.scannerInstructions}>
                    <Ionicons name="scan-outline" size={18} color="#4a90e2" />
                    <ThemedText style={styles.scannerInstructionsText}>
                      Encuadra el código QR dentro del marco
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.card, styles.notesCard]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <ThemedText style={styles.sectionTitle}>
                Notas del Cliente
              </ThemedText>

              {isReportLocked ? (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.lockedBadgeText}>Inactivo</ThemedText>
                </View>
              ) : !isEditingNotes ? (
                <TouchableOpacity
                  onPress={() => setIsEditingNotes(true)}
                  style={styles.editButton}
                >
                  <Ionicons name="create-outline" size={16} color={"#FFF"} />
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={() => setIsEditingNotes(false)}
                    style={[styles.actionButton, styles.cancelButton]}
                  >
                    <ThemedText style={styles.cancelButtonText}>
                      Cancelar
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveNotes}
                    style={[styles.actionButton, styles.saveButton]}
                  >
                    <ThemedText style={styles.saveButtonText}>
                      Guardar
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {isReportLocked ? (
              <View style={styles.lockedNotesContainer}>
                <ThemedText style={notes ? styles.notesText : styles.emptyNotesText}>
                  {notes || "No hay notas registradas"}
                </ThemedText>
                <View style={styles.lockedOverlay}>
                  <Ionicons name="lock-closed" size={24} color="#6B7280" />
                  <ThemedText style={styles.lockedOverlayText}>
                    Campo de notas desactivado
                  </ThemedText>
                </View>
              </View>
            ) : isEditingNotes ? (
              <View style={styles.notesInputContainer}>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      color: Colors[colorScheme ?? "light"].text,
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                    },
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  placeholder="Escribe las notas del cliente aquí..."
                  placeholderTextColor="#9CA3AF"
                  textAlignVertical="top"
                />
                <View style={styles.characterCount}>
                  <ThemedText style={styles.characterCountText}>
                    {notes.length}/500 caracteres
                  </ThemedText>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditingNotes(true)}
                style={styles.notesDisplayContainer}
              >
                <ThemedText
                  style={notes ? styles.notesText : styles.emptyNotesText}
                >
                  {notes ||
                    "No hay notas registradas. Toca para agregar notas."}
                </ThemedText>
                {!notes && (
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#A3044C"
                    style={styles.addNotesIcon}
                  />
                )}
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>

        <Card style={[styles.card, styles.signatureCard]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.sectionTitle}>
                Firma del Cliente
              </ThemedText>
              {isReportLocked ? (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.lockedBadgeText}>Inactivo</ThemedText>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={showSignatureModifyOptions}
                  style={styles.optionsButton}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              )}
            </View>

            {isReportLocked ? (
              <View style={styles.lockedSignatureContainer}>
                {signature ? (
                  <View style={styles.signatureContainer}>
                    <View style={styles.signaturePreview}>
                      <Image
                        source={{ uri: signature }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.signatureStatus}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <ThemedText style={styles.signatureStatusText}>
                        Firma registrada (Bloqueada)
                      </ThemedText>
                      {signatureName && (
                        <ThemedText style={styles.signatureName}>
                          Por: {signatureName}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.lockedNoSignature}>
                    <Ionicons name="close-circle" size={48} color="#9CA3AF" />
                    <ThemedText style={styles.lockedNoSignatureText}>
                      No hay firma registrada
                    </ThemedText>
                    <ThemedText style={styles.lockedNoSignatureSubtext}>
                      La firma no puede ser agregada en un reporte bloqueado
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : signature ? (
              <View style={styles.signatureContainer}>
                <View style={styles.signaturePreview}>
                  <Image
                    source={{ uri: signature }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.signatureStatus}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <ThemedText style={styles.signatureStatusText}>
                    Firma registrada
                  </ThemedText>
                  {signatureName ? (
                    <ThemedText style={styles.signatureName}>
                      Por: {signatureName}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.signatureDate}>
                    {new Date().toLocaleDateString("es-ES")}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signatureButton}
                onPress={showSignatureOptions}
                activeOpacity={0.7}
              >
                <View style={styles.signatureButtonIcon}>
                  <Ionicons name="create-outline" size={28} color="#A3044C" />
                </View>
                <ThemedText style={styles.signatureButtonText}>
                  Solicitar Firma del Cliente
                </ThemedText>
                <ThemedText style={styles.signatureButtonSubtext}>
                  Toca para capturar la firma
                </ThemedText>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>

        {!currentReport?.is_synchronized ? (
          !currentReport?.is_finalized ? (
            <TouchableOpacity
              style={[
                styles.closeServiceButton,
                { backgroundColor: Colors[colorScheme ?? "light"].tint },
              ]}
              onPress={finalizeReport}
            >
              <Ionicons name="checkmark-done" size={20} color="white" />
              <ThemedText style={styles.closeServiceButtonText}>
                Finalizar Reporte
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.closeServiceButton,
                  { backgroundColor: "#6c757d" },
                ]}
                onPress={editReport}
              >
                <Ionicons name="create" size={20} color="white" />
                <ThemedText style={styles.closeServiceButtonText}>
                  Editar Reporte
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.closeServiceButton,
                  { backgroundColor: "#5E35B1" },
                ]}
                onPress={() => {
                  Alert.alert(
                    "¿Sincronizar Reporte?",
                    "¿Estás seguro de que deseas sincronizar este reporte con el servidor?",
                    [
                      {
                        text: "Cancelar",
                        style: "cancel",
                      },
                      {
                        text: "Sincronizar",
                        onPress: synchronizeReport,
                        style: "default",
                      },
                    ],
                    { cancelable: true }
                  );
                }}
              >
                <Ionicons name="cloud-upload" size={20} color="white" />
                <ThemedText style={styles.closeServiceButtonText}>
                  Sincronizar Reporte
                </ThemedText>
              </TouchableOpacity>
            </>
          )
        ) : (
          <View style={styles.synchronizedBadge}>
            <Ionicons name="cloud-done" size={20} color="white" />
            <ThemedText style={styles.synchronizedText}>
              Reporte finalizado y sincronizado
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  lockedFunctionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 32,
  },
  lockedFunctionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  lockedFunctionSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  lockedNotesContainer: {
    position: 'relative',
    minHeight: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249, 250, 251, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  lockedOverlayText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  lockedSignatureContainer: {
    opacity: 0.7,
  },
  lockedNoSignature: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 32,
  },
  lockedNoSignatureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  lockedNoSignatureSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  card: {
    borderRadius: 6,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    margin: 10,
  },
  signatureNameContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  signatureNameInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  signatureName: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "600",
  },
  synchronizedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    padding: 16,
    marginTop: 20,
  },
  synchronizedText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  closeServiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    margin: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeServiceButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 10,
  },
  viewServiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#A3044C",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  viewServiceButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 6,
  },
  qrCard: {
    backgroundColor: "#FFFFFF",
  },
  closeScannerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  qrContent: {
    marginTop: 8,
  },
  qrButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F7FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4a90e2",
    borderStyle: "dashed",
    padding: 24,
    marginBottom: 16,
  },
  qrButtonIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4a90e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 4,
  },
  qrButtonSubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  scannedDataContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  scannedDataHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  scannedDataTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
    marginLeft: 6,
  },
  scannedDataContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scannedDataText: {
    fontSize: 14,
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
    fontFamily: "monospace",
  },
  copyButton: {
    padding: 4,
  },
  helpTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
  },
  helpText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 8,
    flex: 1,
  },
  scannerContainer: {
    height: 320,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  cameraView: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  scanFrame: {
    width: 220,
    height: 220,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 25,
    height: 25,
    borderColor: "#4a90e2",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scannerInstructions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  scannerInstructionsText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 8,
  },
  signatureCard: {
    backgroundColor: "#FFFFFF",
  },
  optionsButton: {
    padding: 4,
  },
  signatureContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  signaturePreview: {
    width: "100%",
    height: 150,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
  },
  signatureImage: {
    width: "100%",
    height: "100%",
  },
  signatureStatus: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    display: "flex",
    flexWrap: "wrap",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  signatureStatusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#065F46",
    marginLeft: 6,
    marginRight: 12,
  },
  signatureDate: {
    fontSize: 14,
    color: "#047857",
    marginLeft: 6,
  },
  signatureButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    padding: 24,
    marginTop: 8,
  },
  signatureButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FDE8EF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 4,
  },
  signatureButtonSubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  notesCard: {
    backgroundColor: "#FFFFFF",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d6efd",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
    marginLeft: 4,
  },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  saveButton: {
    backgroundColor: "#0d6efd",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  notesInputContainer: {
    marginTop: 8,
  },
  notesInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  characterCount: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  notesDisplayContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 120,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1F2937",
    flex: 1,
  },
  emptyNotesText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    fontStyle: "italic",
    flex: 1,
  },
  addNotesIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  clientInfoContainer: {
    marginTop: 8,
  },
  clientNameContainer: {
    marginBottom: 16,
  },
  clientName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  infoBoxNoShadow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FDE8EF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  infoAction: {
    paddingLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 12,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    marginRight: 15,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  servicesCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: "#A3044C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
  },
  counterBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  serviceItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  lastServiceItem: {
    marginBottom: 0,
  },
  serviceContent: {
    flex: 1,
    backgroundColor: "#FDE8EF",
    borderRadius: 12,
    padding: 12,
    zIndex: 2,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    flex: 1,
    marginRight: 12,
  },
  serviceDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  signatureModalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  signatureHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 16,
  },
  signatureCanvasContainer: {
    flex: 1,
    padding: 16,
  },
  servicesList: {
    marginTop: 8,
  },
});