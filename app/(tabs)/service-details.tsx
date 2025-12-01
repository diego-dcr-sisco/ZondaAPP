import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";

import { loadFromJsonFile, saveToJsonFile } from "../storage/jsonFileStorage";
import { ApplicationMethod } from "../types/application-method";
import { Device } from "../types/device";
import { Lot } from "../types/lot";
import { Order } from "../types/order";
import { Pest } from "../types/pest";
import { Product } from "../types/product";
import { PestReview, ProductReview, Report } from "../types/report";
import { Service } from "../types/service";

import { useAuth } from "../context/AuthContext";
import { Picker } from "@react-native-picker/picker";

interface SelectedProduct {
  product: (Product & { application_methods?: ApplicationMethod[] }) | null;
  selectedLot: Lot | null;
  selectedMethod: ApplicationMethod | null;
  amount: string;
}

const base_color = "#032859";
const primary_color = "#0d6efd";
const text_color = "#000";
const header_color = "#D94A3D";
const success_color = "#198754"

export default function ServiceDetailsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { orderId, serviceId, serviceName, isLocked } = useLocalSearchParams<{
    orderId: string;
    serviceId: string;
    serviceName: string;
    isLocked: string;
  }>();

  const locked = isLocked == "1" || Number(isLocked) == 1;

  const [service, setService] = useState<Service>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);

  const hasDeviceReview = (deviceId: number): boolean => {
    if (!currentReport || !currentReport.reviews) return false;
    return currentReport.reviews.some(
      (review) => review.device_id === deviceId
    );
  };

  const [availableAppMethods, setAvailableAppMethods] = useState<
    ApplicationMethod[]
  >([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct>({
    product: null,
    selectedLot: null,
    selectedMethod: null,
    amount: "",
  });
  const [products, setProducts] = useState<ProductReview[]>([]);

  const [availablePests, setAvailablePests] = useState<Pest[]>([]);
  const [selectedPest, setSelectedPest] = useState<Pest | null>(null);
  const [pestCount, setPestCount] = useState<string>("");
  const [pests, setPests] = useState<PestReview[]>([]);

  const handleProductSelect = (product: Product) => {
    //console.log("Métodos del producto:", product.application_methods);
    //console.log("Producto seleccionado:", product);
    //console.log("Métodos del servicio:", service?.application_methods);

    // Determinar los métodos de aplicación a usar
    let applicationMethods: ApplicationMethod[] = [];

    // Primero intentar usar los métodos del producto
    if (product.application_methods && product.application_methods.length > 0) {
      applicationMethods = product.application_methods;
      //console.log("Usando métodos del producto:", applicationMethods);
    }
    // Si el producto no tiene métodos, usar los del servicio
    else if (
      service?.application_methods &&
      service.application_methods.length > 0
    ) {
      applicationMethods = service.application_methods;
      //console.log("Usando métodos del servicio:", applicationMethods);
    }
    // Si no hay métodos disponibles, mostrar un mensaje
    else {
      console.log("No hay métodos de aplicación disponibles");
      Alert.alert(
        "Información",
        "Este producto no tiene métodos de aplicación configurados"
      );
    }

    setSelectedProduct({
      product: {
        ...product,
        application_methods: applicationMethods,
      },
      selectedLot: null,
      selectedMethod: null,
      amount: "",
    });
  };

  const { logout, user } = useAuth();

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const orders: Order[] = await loadFromJsonFile("orders");
        //console.log(JSON.stringify(orders, null, 2));
        const mockOrder: Order | undefined = orders.find(
          (ord: Order) => ord.id == Number(orderId)
        );
        const service = mockOrder?.services.find(
          (serv: Service) => serv.id == Number(serviceId)
        );

        const reports: Report[] = (await loadFromJsonFile("reports")) || [];
        const report = reports.find((r) => r.order_id == Number(orderId));

        if (service) {
          setService(service);
          setAvailableProducts(service.products);
          setAvailablePests(service.pests);
          setAvailableAppMethods(service.application_methods);
          setDevices(service.devices);
        }

        if (report) {
          setCurrentReport(report);
          setProducts(report.products);
          setPests(report.pests);
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
      }
    };

    fetchOrderDetails();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          const orders: Order[] = await loadFromJsonFile("orders");
          const reports: Report[] = (await loadFromJsonFile("reports")) || [];
          const report = reports.find((r) => r.order_id == Number(orderId));

          const mockOrder: Order | undefined = orders.find(
            (ord: Order) => ord.id == Number(orderId)
          );
          const service = mockOrder?.services.find(
            (serv: Service) => serv.id == Number(serviceId)
          );

          setCurrentReport(report ?? null);

          if (service) {
            setService(service);
            setDevices(service.devices);
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      };

      fetchData();
    }, [orderId, serviceId])
  );

  const navigateToDevice = (device: Device) => {
    router.push({
      pathname: "/(tabs)/device-details",
      params: {
        orderId: orderId,
        serviceId: serviceId.toString(),
        serviceName: service?.name,
        deviceId: device.id.toString(),
        deviceData: JSON.stringify(device),
        productsData: JSON.stringify(service?.products),
        pestsData: JSON.stringify(service?.pests),
        isLocked: locked ? "1" : "0",
      },
    });
  };

  const addProduct = () => {
    if (!selectedProduct.product || !selectedProduct.amount) {
      Alert.alert(
        "Error",
        "Debes seleccionar un producto y especificar la cantidad"
      );
      return;
    }

    const newProductReview: ProductReview = {
      name: selectedProduct.product.name,
      product_id: selectedProduct.product.id,
      lot_id: selectedProduct.selectedLot?.id || null,
      app_method_id: selectedProduct.selectedMethod?.id || null,
      amount: selectedProduct.amount,
      metric: selectedProduct.product.metric,
      service_id: Number(serviceId),
    };

    setProducts([...products, newProductReview]);
    setSelectedProduct({
      product: null,
      selectedLot: null,
      selectedMethod: null,
      amount: "",
    });
  };

  const addPest = () => {
    if (!selectedPest || !pestCount) {
      Alert.alert(
        "Error",
        "Debes seleccionar una plaga y especificar el conteo"
      );
      return;
    }

    const newPestReview: PestReview = {
      pest_id: selectedPest.id,
      service_id: Number(serviceId),
      count: pestCount,
    };

    setPests([...pests, newPestReview]);
    setSelectedPest(null);
    setPestCount("");
  };

  const removePest = (pest_id: number) => {
    setPests(pests.filter((p) => p.pest_id !== pest_id));
  };

  const removeProduct = (product_id: number) => {
    setProducts(
      products.filter((product) => product.product_id !== product_id)
    );
  };

  const saveReport = async (report: Report): Promise<boolean> => {
    try {
      const reports = (await loadFromJsonFile("reports")) || [];
      const reportIndex = reports.findIndex(
        (r: Report) => r.order_id === currentReport?.order_id
      );
      if (reportIndex !== -1) {
        reports[reportIndex] = report;
      } else {
        reports.push(report);
      }
      await saveToJsonFile("reports", reports);
      return true;
    } catch (error) {
      console.error("Error saving report:", error);
      return false;
    }
  };

  const handleService = async () => {
    Alert.alert(
      "Finalizar servicio",
      "¿Estás seguro que deseas finalizar este servicio?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Finalizar",
          onPress: async () => {
            try {
              const now = new Date().toISOString();

              const currentReport: Report | undefined = await loadFromJsonFile(
                "reports"
              ).then((reports: Report[]) =>
                reports.find((r) => r.order_id === Number(orderId))
              );

              const updatedReport: Report = {
                order_id: Number(orderId),
                user_id: user?.userId || 0,
                start_time: currentReport?.start_time || now,
                end_time: now,
                completed_date: now,
                notes: currentReport?.notes || null,
                customer_signature: currentReport?.customer_signature || null,
                signature_name: currentReport?.signature_name || null,
                reviews: currentReport?.reviews || [],
                products: [
                  ...products.map((p) => ({
                    product_id: p.product_id,
                    name: p.name,
                    lot_id: p.lot_id,
                    app_method_id: p.app_method_id,
                    amount: p.amount,
                    metric: p.metric,
                    service_id: p.service_id,
                  })),
                ],
                pests: [
                  ...pests.map((p) => ({
                    pest_id: p.pest_id,
                    service_id: Number(serviceId),
                    count: p.count,
                  })),
                ],
                is_finalized: false,
                is_synchronized: false,
              };

              if (service?.prefix === 1 && devices.length > 0) {
                updatedReport.reviews = devices.map((device) => {
                  const existingReview = currentReport?.reviews?.find(
                    (r) => r.device_id === device.id
                  );
                  return (
                    existingReview || {
                      device_id: device.id,
                      answers: [],
                      products: [],
                      pests: [],
                      image: null,
                      is_checked: false,
                      is_scanned: false,
                    }
                  );
                });
              }

              const success = await saveReport(updatedReport);

              if (success) {
                Alert.alert(
                  "Éxito",
                  "El servicio ha sido finalizado correctamente"
                );
                router.push({
                  pathname: "/(tabs)/order-details",
                  params: { orderId: orderId },
                });
              } else {
                Alert.alert("Error", "No se pudo finalizar el servicio");
              }
            } catch (error) {
              console.error("Error al finalizar servicio:", error);
              Alert.alert(
                "Error",
                "Ocurrió un problema al finalizar el servicio"
              );
            }
          },
        },
      ]
    );
  };

  const renderDeviceItem = (device: Device, index: number) => (
    <TouchableOpacity
      key={`${device.id}-${index}-${device.control_point.code}`}
      onPress={() => navigateToDevice(device)}
      style={styles.deviceItem}
    >
      <View style={styles.deviceInfo}>
        <View style={styles.deviceHeader}>
          <ThemedText style={styles.deviceCode}>
            {device.control_point.code} - {device.nplan}
          </ThemedText>
          <ThemedText style={styles.deviceName}>
            {device.control_point.name}
          </ThemedText>
          {hasDeviceReview(device.id) && (
            <View style={styles.reviewedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <ThemedText style={styles.reviewedText}>Revisado</ThemedText>
            </View>
          )}
        </View>
        <ThemedText style={styles.deviceDetail}>
          Área: {device.area.name}
        </ThemedText>
        <ThemedText style={styles.deviceDetail}>
          Plano: {device.floorplan.name}
        </ThemedText>
        <ThemedText style={styles.deviceDetail}>
          Preguntas: {device.questions.length}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );

  const allDevicesReviewed =
    devices.length > 0 && devices.every((device) => hasDeviceReview(device.id));
  const hasProductsAdded = products.length > 0;
  const canFinishService =
    (service?.prefix !== 1 && hasProductsAdded) || allDevicesReviewed;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(tabs)/order-details",
              params: { orderId: orderId },
            })
          }
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={Colors[colorScheme ?? "light"].text}
          />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>
          {serviceName || "Servicio"}
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card de Descripción */}
        <Card style={[styles.card, styles.descriptionCard]}>
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
                Descripción del Servicio
              </ThemedText>
            </View>
            <ThemedText style={styles.descriptionText}>
              {service?.description ||
                "No hay descripción disponible para este servicio"}
            </ThemedText>
          </Card.Content>
        </Card>

        {/* Card de Dispositivos */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons
                  name="hardware-chip-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <ThemedText style={styles.sectionTitle}>Dispositivos</ThemedText>
            </View>
            {devices.length > 0 ? (
              devices.map((device, index) => renderDeviceItem(device, index))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="hardware-chip-outline"
                  size={48}
                  color="#C4C4C4"
                />
                <ThemedText style={styles.emptyText}>
                  No hay dispositivos asignados
                </ThemedText>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Card de Productos */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="flask-outline" size={20} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.sectionTitle}>
                Productos Utilizados
              </ThemedText>
            </View>

            {products.length > 0 ? (
              products.map((product, index) => (
                <View
                  key={`product-review-${index}-${Date.now()}`}
                  style={styles.productItem}
                >
                  <View style={styles.productInfo}>
                    <ThemedText style={styles.productName}>
                      {product.name}
                    </ThemedText>
                    <View style={styles.productDetails}>
                      <ThemedText style={styles.quantityText}>
                        {product.amount} {product.metric}
                      </ThemedText>
                      {product.lot_id && (
                        <View style={styles.detailBadge}>
                          <Ionicons
                            name="barcode-outline"
                            size={12}
                            color={base_color}
                          />
                          <ThemedText style={styles.detailText}>
                            {
                              availableProducts
                                .find((p) => p.id === product.product_id)
                                ?.lots.find((l) => l.id === product.lot_id)
                                ?.registration_number
                            }
                          </ThemedText>
                        </View>
                      )}
                      {product.app_method_id && (
                        <View style={styles.detailBadge}>
                          <Ionicons
                            name="settings-outline"
                            size={12}
                            color={base_color}
                          />
                          <ThemedText style={styles.detailText}>
                            {
                              availableAppMethods.find(
                                (m) => m.id === product.app_method_id
                              )?.name
                            }
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeProduct(product.product_id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="flask-outline" size={48} color="#C4C4C4" />
                <ThemedText style={styles.emptyText}>
                  No hay productos agregados
                </ThemedText>
              </View>
            )}

            <View style={styles.addSection}>
              <ThemedText style={styles.addSectionTitle}>
                Agregar Producto
              </ThemedText>
              <Picker
                selectedValue={selectedProduct.product?.id || ""}
                onValueChange={(itemValue) => {
                  const product = availableProducts.find(
                    (p) => p.id === itemValue
                  );
                  if (product) handleProductSelect(product);
                }}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione un producto" value="" />
                {availableProducts.map((product) => (
                  <Picker.Item
                    key={"product-list" + product.id}
                    label={product.name}
                    value={product.id}
                  />
                ))}
              </Picker>
              {selectedProduct.product && (
                <>
                  <Picker
                    selectedValue={selectedProduct.selectedLot?.id || ""}
                    onValueChange={(itemValue) => {
                      const lot = selectedProduct.product?.lots.find(
                        (l) => l.id === itemValue
                      );
                      setSelectedProduct({
                        ...selectedProduct,
                        selectedLot: lot || null,
                      });
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccione un lote" value="" />
                    {selectedProduct.product.lots.map((lot) => (
                      <Picker.Item
                        key={"selected-lot-" + lot.id}
                        label={lot.registration_number}
                        value={lot.id}
                      />
                    ))}
                  </Picker>

                  {/* Picker de métodos con validación */}
                  {selectedProduct.product.application_methods &&
                  selectedProduct.product.application_methods.length > 0 ? (
                    <Picker
                      selectedValue={selectedProduct.selectedMethod?.id || ""}
                      onValueChange={(itemValue) => {
                        const method =
                          selectedProduct.product?.application_methods?.find(
                            (m) => m.id === itemValue
                          );
                        setSelectedProduct({
                          ...selectedProduct,
                          selectedMethod: method || null,
                        });
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccione un método" value="" />
                      {selectedProduct.product.application_methods.map(
                        (method) => (
                          <Picker.Item
                            key={"method-selected-" + method.id}
                            label={method.name}
                            value={method.id}
                          />
                        )
                      )}
                    </Picker>
                  ) : (
                    <View style={styles.warningContainer}>
                      <Ionicons
                        name="warning-outline"
                        size={20}
                        color="#F59E0B"
                      />
                      <ThemedText style={styles.warningText}>
                        No hay métodos de aplicación disponibles
                      </ThemedText>
                    </View>
                  )}
                </>
              )}

              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Cantidad"
                  value={selectedProduct.amount}
                  onChangeText={(text) =>
                    setSelectedProduct({ ...selectedProduct, amount: text })
                  }
                  keyboardType="numeric"
                />
                <View style={styles.metricContainer}>
                  <ThemedText style={styles.metricText}>
                    {selectedProduct.product?.metric || "uds"}
                  </ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.addButton,
                  (!selectedProduct.product ||
                    !selectedProduct.amount ||
                    locked) &&
                    styles.addButtonDisabled,
                ]}
                onPress={addProduct}
                disabled={
                  !selectedProduct.product || !selectedProduct.amount || locked
                }
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addButtonText}>
                  Agregar Producto
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Card de Plagas */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="bug-outline" size={20} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.sectionTitle}>
                Plagas Detectadas
              </ThemedText>
            </View>

            {pests.length > 0 ? (
              pests.map((pest, index) => {
                const pestInfo = availablePests.find(
                  (p) => p.id === pest.pest_id
                );
                return (
                  <View
                    key={"selected-pest-" + pest.pest_id + "-" + index}
                    style={styles.pestItem}
                  >
                    <View style={styles.pestInfo}>
                      <ThemedText style={styles.pestName}>
                        {pestInfo?.name || `Plaga ID: ${pest.pest_id}`}
                        {pestInfo?.code && ` (${pestInfo.code})`}
                      </ThemedText>
                      <ThemedText style={styles.pestCount}>
                        Conteo: {pest.count}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={() => removePest(pest.pest_id)}
                      style={styles.deleteButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="bug-outline" size={48} color="#C4C4C4" />
                <ThemedText style={styles.emptyText}>
                  No hay plagas registradas
                </ThemedText>
              </View>
            )}

            <View style={styles.addSection}>
              <ThemedText style={styles.addSectionTitle}>
                Agregar Plaga
              </ThemedText>

              <Picker
                selectedValue={selectedPest?.id || ""}
                onValueChange={(itemValue) => {
                  const pest = availablePests.find((p) => p.id === itemValue);
                  setSelectedPest(pest || null);
                }}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione una plaga" value="" />
                {availablePests.map((pest, index) => (
                  <Picker.Item
                    key={`available-pest-${pest.id}-${index}`}
                    label={`${pest.name}${pest.code ? ` (${pest.code})` : ""}`}
                    value={pest.id}
                  />
                ))}
              </Picker>

              <TextInput
                style={styles.input}
                placeholder="Conteo"
                value={pestCount}
                onChangeText={setPestCount}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[
                  styles.addButton,
                  (!selectedPest || !pestCount || locked) &&
                    styles.addButtonDisabled,
                ]}
                onPress={addPest}
                disabled={!selectedPest || !pestCount || locked}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addButtonText}>
                  Agregar Plaga
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Botón de Finalizar */}
        {!currentReport?.is_finalized && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.finishButton]}
              onPress={handleService}
            >
              <Ionicons name="checkmark-done" size={24} color="#FFFFFF" />
              <ThemedText style={styles.finishButtonText}>
                Guardar Servicio
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
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

  // Card Styles
  card: {
    margin: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  descriptionCard: {
    marginBottom: 8,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: base_color,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: header_color,
  },

  // Content Styles
  descriptionText: {
    fontSize: 15,
    color: "#000000",
    lineHeight: 22,
  },

  // Device Styles
  deviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  deviceCode: {
    fontSize: 14,
    fontWeight: "600",
    color: base_color,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  deviceDetail: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 2,
  },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: success_color,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  reviewedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },

  // Product Styles
  productItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  productDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "500",
    color: base_color,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  detailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#6B7280",
  },

  // Pest Styles
  pestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: success_color,
  },
  pestInfo: {
    flex: 1,
  },
  pestName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 4,
  },
  pestCount: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "500",
  },

  // Common Styles
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
    textAlign: "center",
  },
  addSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  addSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },

  // Input & Picker Styles
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#374151",
  },
  picker: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },

  // Button Styles
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: primary_color,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  addButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#FEF2F2",
  },

  // Footer Styles
  footer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  finishButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#198754",
    padding: 8,
    borderRadius: 8,
  },
  finishButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
  finalizedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  finalizedText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },

  amountInputContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
    overflow: "hidden",
  },
  amountInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: "#374151",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  metricContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    minWidth: 80,
  },
  metricText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  warningText: {
    marginLeft: 8,
    color: "#92400E",
    fontSize: 14,
  },
});
