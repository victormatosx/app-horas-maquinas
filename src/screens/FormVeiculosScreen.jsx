"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from "react-native"
import DateTimePickerModal from "react-native-modal-datetime-picker"
import { database } from "../config/firebaseConfig"
import { ref, push, set, onValue, query, orderByChild, equalTo, get } from "firebase/database"
import { ChevronDown } from "lucide-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { saveOfflineData, checkConnectivityAndSync } from "../utils/offlineManager"
import { auth } from "../config/firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"
import Icon from "react-native-vector-icons/Ionicons"
import { useNavigation, useRoute } from "@react-navigation/native"

// Define colors locally instead of importing from App.jsx
const COLORS = {
  background: "#f0f0f0",
  text: "#333333",
  textLight: "#777777",
  vehicle: {
    primary: "#2a9d8f",
  },
}

const USER_TOKEN_KEY = "@user_token"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const OFFLINE_STORAGE_KEY = "@offline_percursos"

const initialFormData = {
  placa: "",
  data: "",
  kmAnterior: "",
  kmAtual: "",
  objetivo: "",
}

export default function FormVeiculosScreen() {
  const [formData, setFormData] = useState(initialFormData)
  const [isDatePickerVisible, setDatePickerVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState("")
  const [userPropriedade, setUserPropriedade] = useState("")
  const [isListModalVisible, setListModalVisible] = useState(false)
  const [listModalType, setListModalType] = useState("")
  const [listModalData, setListModalData] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isAuthInitialized, setIsAuthInitialized] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [veiculos, setVeiculos] = useState([])

  const navigation = useNavigation()
  const route = useRoute()
  const isMounted = useRef(true)

  const isFormValid = useCallback(() => {
    const requiredFields = ["placa", "data", "kmAnterior", "kmAtual", "objetivo"]
    return requiredFields.every((field) => formData[field] && formData[field].trim() !== "")
  }, [formData])

  const resetForm = useCallback(() => {
    setFormData(initialFormData)
  }, [])

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    // Check if we have a vehicle from route params
    if (route.params?.veiculo) {
      setFormData((prev) => ({
        ...prev,
        placa: route.params.veiculo.placa,
      }))
    }
  }, [route.params])

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user)
      setIsAuthInitialized(true)
    })

    const loadUserData = async () => {
      try {
        const id = await AsyncStorage.getItem(USER_TOKEN_KEY)
        const propriedade = await AsyncStorage.getItem(USER_PROPRIEDADE_KEY)
        setUserId(id)
        setUserPropriedade(propriedade)
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }
    loadUserData()

    return () => unsubscribeAuth()
  }, [])

  useEffect(() => {
    if (!isAuthInitialized || !isAuthenticated || !userPropriedade) {
      return
    }

    // Fetch vehicles
    const veiculosRef = ref(database, `propriedades/${userPropriedade}/veiculos`)
    onValue(veiculosRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const veiculosArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
        }))
        setVeiculos(veiculosArray)
      } else {
        // Mock data if no vehicles exist
        const mockVeiculos = [
          {
            id: "1",
            placa: "ABC-1234",
            modelo: "Toyota Hilux",
          },
          {
            id: "2",
            placa: "DEF-5678",
            modelo: "Ford Ranger",
          },
          {
            id: "3",
            placa: "GHI-9012",
            modelo: "Volkswagen Gol",
          },
          {
            id: "4",
            placa: "JKL-3456",
            modelo: "Fiat Strada",
          },
        ]
        setVeiculos(mockVeiculos)
      }
      setIsLoading(false)
    })
  }, [isAuthInitialized, isAuthenticated, userPropriedade])

  useEffect(() => {
    const syncInterval = setInterval(async () => {
      if (!isSyncing) {
        setIsSyncing(true)
        try {
          await checkConnectivityAndSync()
        } finally {
          setIsSyncing(false)
        }
      }
    }, 300000) // Check every 5 minutes

    return () => clearInterval(syncInterval)
  }, [isSyncing])

  const handleDateConfirm = useCallback((date) => {
    const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`
    setFormData((prev) => ({ ...prev, data: formattedDate }))
    setDatePickerVisible(false)
  }, [])

  const handleChange = useCallback((name, value) => setFormData((prev) => ({ ...prev, [name]: value })), [])

  // Função para formatar a placa no padrão brasileiro
  const formatarPlaca = useCallback((placa) => {
    // Remove todos os caracteres não alfanuméricos
    const placaLimpa = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

    // Verifica se é o formato Mercosul (AAA0A00) ou formato antigo (AAA-0000)
    if (placaLimpa.length <= 3) {
      return placaLimpa
    } else if (placaLimpa.length <= 7) {
      // Verifica se é formato Mercosul (com letra na posição 4)
      const isFormatoMercosul = /^[A-Z]{3}[0-9A-Z][0-9]{2}[0-9A-Z]?$/.test(placaLimpa)

      if (isFormatoMercosul && placaLimpa.length >= 4) {
        // Formato Mercosul: AAA0A00
        return `${placaLimpa.substring(0, 3)}${placaLimpa.length > 3 ? placaLimpa.substring(3, 4) : ""}${
          placaLimpa.length > 4 ? placaLimpa.substring(4, 6) : ""
        }${placaLimpa.length > 6 ? placaLimpa.substring(6, 7) : ""}`
      } else {
        // Formato antigo: AAA-0000
        return `${placaLimpa.substring(0, 3)}${placaLimpa.length > 3 ? "-" + placaLimpa.substring(3) : ""}`
      }
    }
    return placaLimpa
  }, [])

  const handlePlacaChange = useCallback(
    (value) => {
      const placaFormatada = formatarPlaca(value)
      setFormData((prev) => ({ ...prev, placa: placaFormatada }))
    },
    [formatarPlaca],
  )

  const sendDataToFirebase = useCallback(
    async (percursoData) => {
      const percursosRef = ref(database, `propriedades/${userPropriedade}/percursos`)
      const existingEntryQuery = query(percursosRef, orderByChild("localId"), equalTo(percursoData.localId))
      const existingEntrySnapshot = await get(existingEntryQuery)

      if (!existingEntrySnapshot.exists()) {
        const newEntryRef = push(percursosRef)
        await set(newEntryRef, percursoData)
        console.log("Percurso enviado com sucesso:", percursoData.localId)
        return true
      } else {
        console.log("Percurso já existe, ignorando:", percursoData.localId)
        return false
      }
    },
    [userPropriedade],
  )

  const handleSubmit = useCallback(async () => {
    if (isFormValid()) {
      try {
        const localId = Date.now().toString()
        const kmAnterior = Number.parseFloat(formData.kmAnterior)
        const kmAtual = Number.parseFloat(formData.kmAtual)

        if (kmAtual <= kmAnterior) {
          Alert.alert("Erro", "O KM atual deve ser maior que o KM anterior.")
          return
        }

        const percursoData = {
          ...formData,
          kmTotal: (kmAtual - kmAnterior).toFixed(1),
          timestamp: Date.now(),
          userId: userId,
          propriedade: userPropriedade,
          localId: localId,
          status: "pending",
        }

        const netInfo = await NetInfo.fetch()
        if (netInfo.isConnected) {
          const sent = await sendDataToFirebase(percursoData)
          if (sent) {
            Alert.alert("Sucesso", "Dados enviados com sucesso!")
            resetForm()
            navigation.goBack()
          } else {
            Alert.alert("Atenção", "Este percurso já foi enviado anteriormente.")
          }
        } else {
          // Check if we already have this localId saved offline
          const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            await saveOfflineData(percursoData, OFFLINE_STORAGE_KEY)
            Alert.alert("Modo Offline", "Dados salvos localmente e serão sincronizados quando houver conexão.")
            resetForm()
            navigation.goBack()
          } else {
            Alert.alert("Atenção", "Este percurso já foi salvo localmente.")
          }
        }
      } catch (error) {
        console.error("Error submitting form:", error)
        Alert.alert("Erro", "Ocorreu um erro ao enviar os dados. Os dados foram salvos localmente.")

        try {
          // Check if we already have this localId saved offline before saving
          const localId = Date.now().toString()
          const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            const kmAnterior = Number.parseFloat(formData.kmAnterior)
            const kmAtual = Number.parseFloat(formData.kmAtual)

            const percursoData = {
              ...formData,
              kmTotal: (kmAtual - kmAnterior).toFixed(1),
              timestamp: Date.now(),
              userId: userId,
              propriedade: userPropriedade,
              localId: localId,
              status: "pending",
            }
            await saveOfflineData(percursoData, OFFLINE_STORAGE_KEY)
          }
        } catch (saveError) {
          console.error("Error saving offline data after submission error:", saveError)
        }
      }
    } else {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios!")
    }
  }, [formData, userId, userPropriedade, sendDataToFirebase, isFormValid, resetForm, navigation])

  const renderInputField = useCallback(
    (label, name, value, onChange, keyboardType = "default", editable = true) => (
      <View>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, !editable && styles.disabledInput]}
          value={value}
          onChangeText={(text) => onChange(name, text)}
          placeholder={label}
          keyboardType={keyboardType}
          editable={editable}
          accessibilityLabel={label}
        />
      </View>
    ),
    [],
  )

  const renderDatePickerField = useCallback(
    (label, name) => (
      <View>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setDatePickerVisible(true)}
          accessibilityLabel={`Selecionar ${label}`}
          accessibilityHint="Toque para abrir o seletor de data"
        >
          <Text style={styles.datePickerText}>{formData[name] || "Selecione a Data"}</Text>
        </TouchableOpacity>
      </View>
    ),
    [formData],
  )

  const Separator = useCallback(() => <View style={styles.separator} />, [])

  const openListModal = useCallback(
    (type) => {
      setListModalType(type)

      if (type === "placa") {
        setListModalData(veiculos.map((v) => ({ id: v.placa, name: `${v.placa} - ${v.modelo || ""}` })))
      }

      setSearchQuery("")
      setListModalVisible(true)
    },
    [veiculos],
  )

  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  const renderListItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          if (listModalType === "placa") {
            handleChange(listModalType, item.id)
          }
          setListModalVisible(false)
        }}
      >
        <Text>{item.name}</Text>
      </TouchableOpacity>
    ),
    [listModalType, handleChange],
  )

  const renderListModal = useCallback(() => {
    return (
      <Modal visible={isListModalVisible} transparent={true} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { flex: 1, textAlign: "center" }]}>Selecione o Veículo</Text>
              <TouchableOpacity
                onPress={() => setListModalVisible(false)}
                style={[styles.closeButton, { position: "absolute", right: 0 }]}
              >
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              style={styles.flatList}
              data={filteredListData}
              renderItem={renderListItem}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={Separator}
            />
          </View>
        </SafeAreaView>
      </Modal>
    )
  }, [isListModalVisible, listModalType, filteredListData, renderListItem, searchQuery, Separator])

  if (!isAuthInitialized || isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.vehicle.primary} />
        <Text>Carregando...</Text>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
    navigation.replace("Login")
    return null
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>{error}</Text>
        <TouchableOpacity onPress={() => window.location.reload()}>
          <Text>Tentar novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={COLORS.vehicle.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Viagem/Percurso</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Veículo</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("placa")}
          accessibilityLabel="Selecionar Veículo"
        >
          <Text>{formData.placa || "Selecione o Veículo"}</Text>
          <ChevronDown size={20} color={COLORS.vehicle.primary} />
        </TouchableOpacity>
        <Separator />

        {renderDatePickerField("Data", "data")}
        <Separator />

        {renderInputField("KM Anterior", "kmAnterior", formData.kmAnterior, handleChange, "numeric")}
        <Separator />

        {renderInputField("KM Atual", "kmAtual", formData.kmAtual, handleChange, "numeric")}
        <Separator />

        {formData.kmAnterior && formData.kmAtual && (
          <View style={styles.calculatedKm}>
            <Text style={styles.label}>Total de KM:</Text>
            <Text style={styles.kmValue}>
              {Number.parseFloat(formData.kmAtual) > Number.parseFloat(formData.kmAnterior)
                ? (Number.parseFloat(formData.kmAtual) - Number.parseFloat(formData.kmAnterior)).toFixed(1)
                : "0.0"}
            </Text>
          </View>
        )}
        <Separator />

        {renderInputField("Objetivo do Percurso", "objetivo", formData.objetivo, handleChange)}
        <Separator />

        <TouchableOpacity
          style={styles.buttonEnviar}
          onPress={handleSubmit}
          accessibilityLabel="Enviar formulário"
          accessibilityHint="Toque para enviar o formulário preenchido"
        >
          <Text style={styles.buttonTextEnviar}>ENVIAR</Text>
        </TouchableOpacity>
      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
      />

      {renderListModal()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.background,
    padding: 12,
    paddingTop: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitle: {
    color: COLORS.vehicle.primary,
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    padding: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: COLORS.vehicle.primary,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  input: {
    height: 50,
    borderColor: COLORS.vehicle.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: COLORS.text,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  disabledInput: {
    backgroundColor: "#F5F5F5",
    color: COLORS.textLight,
  },
  datePickerText: {
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 12,
  },
  buttonEnviar: {
    backgroundColor: COLORS.vehicle.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  buttonTextEnviar: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
    margin: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  closeButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginVertical: 8,
    marginHorizontal: 20,
  },
  listItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    marginVertical: 4,
  },
  searchInput: {
    height: 40,
    borderColor: COLORS.vehicle.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: COLORS.text,
  },
  flatList: {
    marginTop: 10,
    marginBottom: 10,
  },
  calculatedKm: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  kmValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.vehicle.primary,
  },
})