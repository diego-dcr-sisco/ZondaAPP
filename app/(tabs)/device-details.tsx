import React, { use, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card } from "react-native-paper";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import { loadFromJsonFile, saveToJsonFile } from "../storage/jsonFileStorage";
import { Device } from "../types/device";
import { Question } from "../types/question";
import {
  Answer as AnswerInterface,
  PestReview,
  ProductReview,
  Report,
  Review,
} from "../types/report";
import { Order } from "../types/order";
import { Pest } from "../types/pest";
import { Product } from "../types/product";
import { Service } from "../types/service";
import { ApplicationMethod } from "../types/application-method";
import { Lot } from "../types/lot";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";

interface AnswerState {
  questionId: number;
  response: string;
}

interface SelectedProduct {
  product: (Product & { application_methods?: ApplicationMethod[] }) | null;
  selectedLot: Lot | null;
  selectedMethod: ApplicationMethod | null;
  amount: string;
}

interface PestForm {
  pestId: string;
  count: string;
}

export default function DeviceDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const {
    deviceData,
    productsData,
    pestsData,
    orderId,
    deviceId,
    serviceId,
    serviceName,
    isLocked,
  } = useLocalSearchParams<{
    deviceData: string;
    productsData: string;
    pestsData: string;
    orderId: string;
    deviceId: string;
    serviceId: string;
    serviceName: string;
    isLocked: string;
  }>();

  const [device, setDevice] = useState<Device | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availablePests, setAvailablePests] = useState<Pest[]>([]);
  const [availableApplicationMethods, setAvailableApplicationMethods] =
    useState<ApplicationMethod[]>([]);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [products, setProducts] = useState<ProductReview[]>([]);
  const [pests, setPests] = useState<PestReview[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct>({
    product: null,
    selectedLot: null,
    selectedMethod: null,
    amount: "",
  });
  const [newPest, setNewPest] = useState<PestForm>({
    pestId: "",
    count: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [imgBase64, setImgBase64] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [observations, setObservations] = useState<string>("");

  const locked = isLocked == '1' || isLocked == 1;

  useEffect(() => {
    const loadServiceApplicationMethods = async () => {
      if (!serviceId) return;

      try {
        const orders = (await loadFromJsonFile("orders")) || [];
        const order = orders.find((o: Order) => o.id === Number(orderId));
        const services = order?.services || [];
        const currentService = services.find((s: Service) => s.id == Number(serviceId));

        if (currentService && currentService.application_methods) {
          setAvailableApplicationMethods(currentService.application_methods);
        }
      } catch (error) {
        console.error("Error loading service application methods:", error);
      }
    };

    loadServiceApplicationMethods();
  }, [serviceId]);

  const handleProductSelect = (product: Product) => {
    // console.log("Producto seleccionado:", product);
    // console.log("Métodos del producto:", product.application_methods);
    // console.log("Métodos del servicio:", availableApplicationMethods);

    let applicationMethods: ApplicationMethod[] = [];

    if (product.application_methods && product.application_methods.length > 0) {
      applicationMethods = product.application_methods;
      console.log("Usando métodos del producto:", applicationMethods);
    }
    else if (availableApplicationMethods.length > 0) {
      applicationMethods = availableApplicationMethods;
      console.log("Usando métodos del servicio:", applicationMethods);
    }
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

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });

        if (photo.uri) {
          setCapturedImage(photo.uri);

          const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [
              {
                resize: {
                  width: 800,
                },
              },
            ],
            {
              compress: 0.7,
              format: ImageManipulator.SaveFormat.PNG,
              base64: true,
            }
          );

          if (manipResult.base64) {
            const base64WithPrefix = `data:image/png;base64,${manipResult.base64}`;
            setImgBase64(base64WithPrefix);
          }

          setCameraVisible(false);
          Alert.alert("Éxito", "Imagen guardada correctamente");
        }
      } catch (error) {
        console.error("Error al tomar la foto:", error);
        Alert.alert("Error", "No se pudo tomar la foto");
      }
    }
  };

  function toggleCameraFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  useEffect(() => {
    const resetDeviceState = () => {
      setAnswers([]);
      setProducts([]);
      setPests([]);
      setCapturedImage(null);
      setImgBase64(null);
      setObservations("");
      setSelectedProduct({
        product: null,
        selectedLot: null,
        selectedMethod: null,
        amount: "",
      });
      setNewPest({
        pestId: "",
        count: "",
      });
    };

    resetDeviceState();
  }, [deviceData, orderId, deviceId]);

  useEffect(() => {
    if (deviceData) {
      try {
        const parsedDevice = JSON.parse(deviceData);
        setDevice(parsedDevice);

        const initialAnswers =
          parsedDevice.questions?.map((question: Question) => ({
            questionId: question.id,
            response: "",
          })) || [];
        setAnswers(initialAnswers);
      } catch (error) {
        console.error("Error parsing device data:", error);
      }
    }

    if (productsData) {
      try {
        const parsedProducts = JSON.parse(productsData);
        setAvailableProducts(parsedProducts);
      } catch (error) {
        console.error("Error parsing products data:", error);
        setAvailablePests([]);
      }
    }

    if (pestsData) {
      try {
        const parsedPests = JSON.parse(pestsData);
        setAvailablePests(parsedPests);
      } catch (error) {
        console.error("Error parsing pests data:", error);
        setAvailablePests([]);
      }
    }
  }, [deviceData, productsData, pestsData]);

  useEffect(() => {
    const loadReport = async () => {
      if (!orderId || !device) return;

      try {
        const reports = (await loadFromJsonFile("reports")) || [];
        const existingReport = reports.find(
          (r: Report) => r.order_id === Number(orderId)
        );

        if (existingReport) {
          setCurrentReport(existingReport);

          const deviceReview = existingReport.reviews?.find(
            (r: Review) => r.device_id === device.id
          );

          if (deviceReview) {
            setAnswers((prevAnswers) =>
              prevAnswers.map((answer) => {
                const existingAnswer = deviceReview.answers.find(
                  (a: AnswerInterface) => a.question_id === answer.questionId
                );
                return existingAnswer
                  ? { ...answer, response: existingAnswer.response }
                  : answer;
              })
            );

            if (deviceReview.products) {
              setProducts(deviceReview.products);
            }

            if (deviceReview.pests) {
              setPests(deviceReview.pests);
            }

            if (deviceReview.image) {
              setCapturedImage(deviceReview.image);
              setImgBase64(deviceReview.image);
            }

            if (deviceReview.observations) {
              setObservations(deviceReview.observations);
            }
          } else {
            setProducts([]);
            setPests([]);
            setCapturedImage(null);
            setImgBase64(null);
            setObservations("");
          }
        } else {
          setProducts([]);
          setPests([]);
          setCapturedImage(null);
          setImgBase64(null);
          setObservations("");
        }
      } catch (error) {
        console.error("Error loading report:", error);
        await saveToJsonFile("reports", []);
      }
    };

    loadReport();
  }, [orderId, device]);

  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          const loadedReports = (await loadFromJsonFile("reports")) || [];
          setReports(loadedReports);

          const report: Report = loadedReports.find(
            (r: Report) => r.order_id === Number(orderId)
          );

          const review: Review | undefined = currentReport?.reviews.find(
            (rv) => rv.device_id == Number(deviceId)
          );

          setCurrentReview(review || null);
        } catch (error) {
          console.error("Error loading data:", error);
        }
      };

      loadData();
    }, [orderId, deviceId])
  );

  const handleAutoReview = async () => {
    try {
      const loadedReports = (await loadFromJsonFile("reports")) || [];
      const loadedOrders: Order[] = (await loadFromJsonFile("orders")) || [];
      const reportIndex = loadedReports.findIndex(
        (r: Report) => r.order_id === Number(orderId)
      );

      const order = loadedOrders.find((o: Order) => o.id == Number(orderId));
      const service = order?.services.find(
        (s: Service) => s.id == Number(serviceId)
      );

      const devicesToAutoReview =
        service?.devices
          .filter(
            (d: Device) => d.control_point.id === device?.control_point.id
          )
          .map((d: Device) => d.id) || [];

      const currentDeviceReview =
        reportIndex >= 0
          ? loadedReports[reportIndex].reviews?.find(
              (r: Review) => r.device_id === Number(deviceId)
            )
          : null;

      const now = new Date().toISOString();
      let updatedReports = [...loadedReports];

      const answersToReplicate = currentDeviceReview?.answers || [];
      const pestsToReplicate = currentDeviceReview?.pests || [];
      const productsToReplicate = currentDeviceReview?.products || [];
      const observationsToReplicate = currentDeviceReview?.observations || "";

      const updatedReviews: Review[] = [];

      if (reportIndex >= 0) {
        const existingReviews = updatedReports[reportIndex].reviews || [];

        existingReviews.forEach((review: any) => {
          if (devicesToAutoReview.includes(review.device_id)) {
            updatedReviews.push({
              ...review,
              is_checked: true,
              is_scanned: false,
              answers: [...answersToReplicate],
              pests: [...pestsToReplicate],
              products: [...productsToReplicate],
              observations: observationsToReplicate,
            });
          } else {
            updatedReviews.push(review);
          }
        });
      }

      devicesToAutoReview.forEach((deviceId) => {
        if (!updatedReviews.some((r) => r.device_id === deviceId)) {
          updatedReviews.push({
            device_id: deviceId,
            is_checked: true,
            is_scanned: false,
            pests: [...pestsToReplicate],
            products: [...productsToReplicate],
            answers: [...answersToReplicate],
            image: null,
          });
        }
      });

      if (reportIndex >= 0) {
        updatedReports[reportIndex] = {
          ...updatedReports[reportIndex],
          reviews: updatedReviews,
          end_time: now,
          completed_date: now,
        };
      } else {
        updatedReports.push({
          order_id: Number(orderId),
          user_id: 1,
          start_time: now,
          end_time: now,
          completed_date: now,
          notes: "",
          customer_signature: null,
          reviews: updatedReviews,
          products: [...productsToReplicate],
          pests: [...pestsToReplicate],
        });
      }

      await saveToJsonFile("reports", updatedReports);
      setReports(updatedReports);

      const updatedCurrentReview = updatedReviews.find(
        (r) => r.device_id === Number(deviceId)
      );
      setCurrentReview(updatedCurrentReview || null);

      Alert.alert(
        "Éxito",
        `Configuración replicada a ${devicesToAutoReview.length} dispositivo(s) similar(es)`
      );
    } catch (error) {
      console.error("Error en autorevisado:", error);
      Alert.alert("Error", "No se pudo completar el autorevisado");
    }
  };

  const handleSelectAnswer = (questionId: number, response: string) => {
    if(locked) {
      console.log('No se peude');
      return;
    }

    setAnswers((prevAnswers) =>
      prevAnswers.map((answer) =>
        answer.questionId === questionId ? { ...answer, response } : answer
      )
    );
  };

  const handleObservationsChange = (text: string) => {
    if (text.length <= 500) {
      setObservations(text);
    }
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

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const addPest = () => {
    if (!newPest.pestId || !newPest.count) {
      Alert.alert(
        "Error",
        "Por favor seleccione una plaga e ingrese la cantidad"
      );
      return;
    }

    const pest: PestReview = {
      pest_id: Number(newPest.pestId),
      service_id: Number(serviceId),
      count: newPest.count,
    };

    setPests([...pests, pest]);
    setNewPest({
      pestId: "",
      count: "",
    });
  };

  const removePest = (index: number) => {
    setPests(pests.filter((_, i) => i !== index));
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

  const handleSubmit = async () => {
    setIsSubmitting(true);

    if (!device || !orderId) {
      Alert.alert("Error", "Datos incompletos");
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const deviceReview: Review = {
        device_id: device.id,
        answers: answers.map((answer) => ({
          question_id: answer.questionId,
          response: answer.response,
        })),
        products: products,
        pests: pests,
        image: imgBase64,
        is_checked: true,
        is_scanned: false,
        observations: observations,
      };

      const updatedReport: Report = {
        order_id: Number(orderId),
        user_id: 1,
        start_time: currentReport?.start_time || now,
        end_time: now,
        completed_date: now,
        notes: currentReport?.notes || null,
        customer_signature: currentReport?.customer_signature || null,
        signature_name: currentReport?.signature_name || null,
        reviews: currentReport?.reviews
          ? [
              ...currentReport.reviews.filter((r) => r.device_id !== device.id),
              deviceReview,
            ]
          : [deviceReview],
        products: currentReport?.products || [],
        pests: currentReport?.pests || [],
        is_finalized: false,
        is_synchronized: false,
      };

      const success = await saveReport(updatedReport);

      if (success) {
        Alert.alert("Éxito", "Toda la información ha sido guardada");
        router.push({
          pathname: "/service-details",
          params: { orderId, serviceId, serviceName },
        });
      } else {
        Alert.alert("Error", "No se pudo guardar el reporte");
      }
    } catch (error) {
      console.error("Error submitting:", error);
      Alert.alert("Error", "Ocurrió un problema al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFinalizedOrder = () => {
    return currentReport?.is_finalized ?? false;
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <ThemedText style={styles.message}>
          Necesitamos tu permiso para usar la cámara
        </ThemedText>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <ThemedText style={styles.permissionButtonText}>
            Conceder permiso
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Cargando dispositivo...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: "/service-details",
              params: { orderId, serviceId, serviceName },
            });
          }}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors[colorScheme ?? "light"].text}
          />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>
          {device.control_point.name} | {device.control_point.code} -{" "}
          {device.nplan}
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Información del dispositivo */}
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
              <ThemedText style={styles.sectionTitle}>
                Información del Dispositivo
              </ThemedText>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={16} color="#64748b" />
                <ThemedText style={styles.infoLabel}>Área:</ThemedText>
                <ThemedText style={styles.infoText}>
                  {device.area.name}
                </ThemedText>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="map-outline" size={16} color="#64748b" />
                <ThemedText style={styles.infoLabel}>Plano:</ThemedText>
                <ThemedText style={styles.infoText}>
                  {device.floorplan.name}
                </ThemedText>
              </View>

              <View style={styles.infoItem}>
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color="#64748b"
                />
                <ThemedText style={styles.infoLabel}>Servicio:</ThemedText>
                <ThemedText style={styles.infoText}>
                  {device.floorplan.service_name}
                </ThemedText>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Sección de preguntas */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="list-outline" size={20} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.sectionTitle}>Cuestionario</ThemedText>
            </View>

            {device.questions.map((question, index) => (
              <View key={question.id} style={styles.questionContainer}>
                <ThemedText style={styles.questionText}>
                  {index + 1}. {question.question}
                </ThemedText>

                {question.options && question.options.length > 0 ? (
                  <View style={styles.optionsContainer}>
                    {question.options.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionButton,
                          answers.find((a) => a.questionId === question.id)
                            ?.response === option
                            ? styles.selectedOption
                            : null,
                        ]}
                        onPress={() => handleSelectAnswer(question.id, option)}
                      >
                        <ThemedText
                          style={[
                            styles.optionText,
                            answers.find((a) => a.questionId === question.id)
                              ?.response === option
                              ? styles.selectedOptionText
                              : null,
                          ]}
                        >
                          {option}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    style={styles.textInput}
                    placeholder="Escribe tu respuesta aquí..."
                    value={
                      answers.find((a) => a.questionId === question.id)
                        ?.response || ""
                    }
                    onChangeText={(text) =>
                      handleSelectAnswer(question.id, text)
                    }
                    multiline
                  />
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Sección de Productos */}
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

            {availableProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="flask-outline" size={48} color="#C4C4C4" />
                <ThemedText style={styles.emptyText}>
                  No hay productos disponibles
                </ThemedText>
              </View>
            ) : (
              <>
                {products.map((product, index) => {
                  const productInfo = availableProducts.find(
                    (p) => p.id === product.product_id
                  );
                  const lotInfo = productInfo?.lots?.find(
                    (l) => l.id === product.lot_id
                  );
                  const methodInfo =
                    availableApplicationMethods.find(
                      (m) => m.id === product.app_method_id
                    ) ||
                    productInfo?.application_methods?.find(
                      (m) => m.id === product.app_method_id
                    );

                  return (
                    <View key={index} style={styles.productItem}>
                      <View style={styles.productInfo}>
                        <ThemedText style={styles.productName}>
                          {productInfo?.name}
                        </ThemedText>
                        <View style={styles.productDetails}>
                          <ThemedText style={styles.quantityText}>
                            {product.amount} {productInfo?.metric}
                          </ThemedText>
                          {lotInfo && (
                            <View style={styles.detailBadge}>
                              <Ionicons
                                name="barcode-outline"
                                size={12}
                                color="#3B82F6"
                              />
                              <ThemedText style={styles.detailText}>
                                {lotInfo.registration_number}
                              </ThemedText>
                            </View>
                          )}
                          {methodInfo && (
                            <View style={styles.detailBadge}>
                              <Ionicons
                                name="settings-outline"
                                size={12}
                                color="#3B82F6"
                              />
                              <ThemedText style={styles.detailText}>
                                {methodInfo.name}
                              </ThemedText>
                            </View>
                          )}
                          {!methodInfo && product.app_method_id === null && (
                            <View style={styles.detailBadge}>
                              <Ionicons
                                name="warning-outline"
                                size={12}
                                color="#F59E0B"
                              />
                              <ThemedText style={styles.detailText}>
                                Sin método específico
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeProduct(index)}
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
                })}

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
                        key={product.id}
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
                            key={lot.id}
                            label={lot.registration_number}
                            value={lot.id}
                          />
                        ))}
                      </Picker>

                      {selectedProduct.product.application_methods &&
                      selectedProduct.product.application_methods.length > 0 ? (
                        <Picker
                          selectedValue={
                            selectedProduct.selectedMethod?.id || ""
                          }
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
                                key={method.id}
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
                      (!selectedProduct.product || !selectedProduct.amount || locked) &&
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
              </>
            )}
          </Card.Content>
        </Card>

        {/* Sección de Plagas */}
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

            {pests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bug-outline" size={48} color="#C4C4C4" />
                <ThemedText style={styles.emptyText}>
                  No se han detectado plagas
                </ThemedText>
              </View>
            ) : (
              pests.map((pest, index) => {
                const pestInfo = availablePests.find(
                  (p) => p.id === pest.pest_id
                );
                return (
                  <View key={index} style={styles.pestItem}>
                    <View style={styles.pestInfo}>
                      <ThemedText style={styles.pestName}>
                        {pestInfo?.name}
                      </ThemedText>
                      <ThemedText style={styles.pestCount}>
                        Conteo: {pest.count}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={() => removePest(index)}
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
            )}

            <View style={styles.addSection}>
              <ThemedText style={styles.addSectionTitle}>
                Agregar Plaga
              </ThemedText>

              <Picker
                selectedValue={newPest.pestId}
                onValueChange={(itemValue) =>
                  setNewPest({ ...newPest, pestId: itemValue })
                }
                style={styles.picker}
              >
                <Picker.Item label="Seleccione una plaga" value="" />
                {availablePests.map((pest) => (
                  <Picker.Item
                    key={pest.id}
                    label={pest.name}
                    value={pest.id.toString()}
                  />
                ))}
              </Picker>

              <TextInput
                style={styles.input}
                placeholder="Conteo"
                value={newPest.count}
                onChangeText={(text) => setNewPest({ ...newPest, count: text })}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[
                  styles.addButton,
                  (!newPest.pestId || !newPest.count || locked) &&
                    styles.addButtonDisabled,
                ]}
                onPress={addPest}
                disabled={!newPest.pestId || !newPest.count || locked}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addButtonText}>
                  Agregar Plaga
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Sección de Observaciones */}
        <Card style={styles.card}>
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
                Observaciones del Dispositivo
              </ThemedText>
            </View>

            <TextInput
              style={styles.observationsInput}
              placeholder="Escribe aquí cualquier observación adicional sobre este dispositivo..."
              value={observations}
              onChangeText={handleObservationsChange}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <ThemedText style={styles.observationsHint}>
              Caracteres: {observations.length}/500
            </ThemedText>
          </Card.Content>
        </Card>

        {/* Imagen Capturada */}
        {capturedImage && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="image-outline" size={20} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.sectionTitle}>
                  Imagen del Dispositivo
                </ThemedText>
              </View>

              <Image
                source={{ uri: capturedImage }}
                style={styles.capturedImage}
              />

              <View style={styles.imageActions}>
                <TouchableOpacity
                  style={[styles.imageButton, styles.retakeButton]}
                  onPress={() => setCameraVisible(true)}
                >
                  <Ionicons name="camera-reverse" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.imageButtonText}>
                    Volver a tomar
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.imageButton, styles.deleteImageButton]}
                  onPress={() => {
                    setCapturedImage(null);
                    if (currentReview) {
                      setCurrentReview({ ...currentReview, image: null });
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.imageButtonText}>
                    Eliminar
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Botones de Acción */}
        {!currentReport?.is_finalized && (
          <View style={styles.actionsContainer}>
            {!capturedImage && (
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setCameraVisible(true)}
              >
                <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.cameraButtonText}>
                  Tomar Foto
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#FFFFFF"
              />
              <ThemedText style={styles.submitButtonText}>
                {isSubmitting ? "Guardando..." : "Guardar Todo"}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.autoReviewButton}
              onPress={handleAutoReview}
            >
              <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
              <ThemedText style={styles.autoReviewButtonText}>
                Replicar a Similares
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Modal de Cámara */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={cameraVisible}
          onRequestClose={() => setCameraVisible(false)}
        >
          <View style={styles.cameraContainer}>
            <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
              <View style={styles.cameraButtons}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <Ionicons name="camera" size={30} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.flipButton}
                  onPress={toggleCameraFacing}
                >
                  <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeCameraButton}
                  onPress={() => setCameraVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        </Modal>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    padding: 5,
  },
  observationsInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top",
  },
  observationsHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    minWidth: 60,
  },
  infoText: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F9FAFB",
  },
  selectedOption: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  optionText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  selectedOptionText: {
    color: "#FFFFFF",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 14,
  },
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
    color: "#3B82F6",
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
  pestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
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
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },
  picker: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3B82F6",
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
  capturedImage: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  imageActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: "#3B82F6",
  },
  deleteImageButton: {
    backgroundColor: "#EF4444",
  },
  imageButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  actionsContainer: {
    gap: 12,
  },
  autoReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  autoReviewButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  cameraButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  finalizedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  finalizedText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraButtons: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  captureButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  flipButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  closeCameraButton: {
    backgroundColor: "rgba(239, 68, 68, 0.7)",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
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
