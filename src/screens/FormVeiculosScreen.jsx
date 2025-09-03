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
import { ref, push, set, query, orderByChild, equalTo, get, onValue, off } from "firebase/database"
import { ChevronDown } from "lucide-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import {
  saveOfflineData,
  checkConnectivityAndSync,
  cacheFirebaseData,
  getCachedData,
  CACHE_KEYS,
} from "../utils/offlineManager"
import { auth } from "../config/firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"
import Icon from "react-native-vector-icons/Ionicons"
import { useNavigation, useRoute } from "@react-navigation/native"


const COLORS = {
  background: "#f0f0f0",
  text: "#333333",
  textLight: "#777777",
  vehicle: {
    primary: "#0F505B",
  },
}

const USER_TOKEN_KEY = "@user_token"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const OFFLINE_PERCURSOS_KEY = "@offline_percursos"

const initialFormData = {
  placa: "",
  placaId: "",
  veiculo: "",
  data: "",
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
  const [isConnected, setIsConnected] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date()) 

  const navigation = useNavigation()
  const route = useRoute()
  const isMounted = useRef(true)

  const isFormValid = useCallback(() => {
    const requiredFields = ["placaId", "data", "kmAtual", "objetivo"]
    return requiredFields.every((field) => formData[field] && formData[field].trim() !== "")
  }, [formData])

  const resetForm = useCallback(() => {
    setFormData(initialFormData)
    setSelectedDate(new Date()) 
  }, [])

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])


  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected)
      if (state.isConnected) {
        checkConnectivityAndSync()
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {

    if (route.params?.veiculo) {
      const veiculo = route.params.veiculo
      setFormData((prev) => ({
        ...prev,
        placaId: veiculo.id,
        placa: veiculo.placa, 
        veiculo: `${veiculo.modelo} (${veiculo.placa})`, 
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

    setIsLoading(true)

    const loadVeiculos = async () => {
      try {
        if (isConnected) {
          const veiculosRef = ref(database, `propriedades/${userPropriedade}/veiculos`)

          const veiculosListener = onValue(
            veiculosRef,
            (snapshot) => {
              if (isMounted.current) {
                const data = snapshot.val()
                if (data) {
                  const veiculosArray = Object.entries(data).map(([key, value]) => ({
                    id: key,
                    modelo: value.modelo,
                    placa: value.placa,
                  }))
                  setVeiculos(veiculosArray)

             
                  cacheFirebaseData(veiculosArray, CACHE_KEYS.VEICULOS)
                } else {
                  setVeiculos([])
                }
                setIsLoading(false)
              }
            },
            (error) => {
              console.error("Error fetching vehicles:", error)
              setError("Erro ao carregar veículos. Por favor, tente novamente.")
              loadCachedVeiculos()
            },
          )

          return () => {
            off(veiculosRef, "value", veiculosListener)
          }
        } else {
       
          loadCachedVeiculos()
        }
      } catch (error) {
        console.error("Erro ao configurar listener para veículos:", error)
        loadCachedVeiculos()
      }
    }

    const loadCachedVeiculos = async () => {
      try {
        const cachedVeiculos = await getCachedData(CACHE_KEYS.VEICULOS)
        if (cachedVeiculos) {
          setVeiculos(cachedVeiculos)
          console.log("Veículos carregados do cache")
        } else {
          setVeiculos([])
          console.log("Nenhum veículo em cache")
        }
        setIsLoading(false)
      } catch (error) {
        console.error("Erro ao carregar veículos do cache:", error)
        setIsLoading(false)
        setError("Erro ao carregar veículos. Por favor, tente novamente.")
      }
    }

    loadVeiculos()
  }, [isAuthInitialized, isAuthenticated, userPropriedade, isConnected])

  useEffect(() => {
    const syncInterval = setInterval(async () => {
      if (!isSyncing && isConnected) {
        setIsSyncing(true)
        try {
          await checkConnectivityAndSync()
        } finally {
          setIsSyncing(false)
        }
      }
    }, 300000) 

    return () => clearInterval(syncInterval)
  }, [isSyncing, isConnected])

  const handleDateConfirm = useCallback((date) => {
    try {
      if (!date) {
        console.warn("Data selecionada é nula ou indefinida")
        setDatePickerVisible(false)
        return
      }
      
      const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${date.getFullYear()}`
      
      setFormData((prev) => ({ ...prev, data: formattedDate }))
      setSelectedDate(date)
      setDatePickerVisible(false)
    } catch (error) {
      console.error("Erro ao confirmar data:", error)
  
      setDatePickerVisible(false)
    }
  }, [])

  const handleChange = useCallback((name, value) => setFormData((prev) => ({ ...prev, [name]: value })), [])

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
        const kmAtual = Number.parseFloat(formData.kmAtual)

  
        let timestamp = Date.now()
        if (formData.data) {
          const [day, month, year] = formData.data.split("/")
          const dateObj = new Date(year, month - 1, day)
          timestamp = dateObj.getTime()
        }

        const percursoData = {
          ...formData,
          kmAtual: kmAtual.toFixed(1),
          timestamp: timestamp,
          userId: userId,
          propriedade: userPropriedade,
          localId: localId,
          status: "pending",
        }

        if (isConnected) {
          const sent = await sendDataToFirebase(percursoData)
          if (sent) {
            Alert.alert("Sucesso", "Dados enviados com sucesso!")
            resetForm()
            navigation.goBack()
          } else {
            Alert.alert("Atenção", "Este percurso já foi enviado anteriormente.")
          }
        } else {
      
          const existingData = await AsyncStorage.getItem(OFFLINE_PERCURSOS_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            await saveOfflineData(percursoData, OFFLINE_PERCURSOS_KEY)
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
    
          const localId = Date.now().toString()
          const existingData = await AsyncStorage.getItem(OFFLINE_PERCURSOS_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            const kmAtual = Number.parseFloat(formData.kmAtual)

    
            let timestamp = Date.now()
            if (formData.data) {
              const [day, month, year] = formData.data.split("/")
              const dateObj = new Date(year, month - 1, day)
              timestamp = dateObj.getTime()
            }

            const percursoData = {
              ...formData,
              kmAtual: kmAtual.toFixed(1),
              timestamp: timestamp,
              userId: userId,
              propriedade: userPropriedade,
              localId: localId,
              status: "pending",
            }
            await saveOfflineData(percursoData, OFFLINE_PERCURSOS_KEY)
          }
        } catch (saveError) {
          console.error("Error saving offline data after submission error:", saveError)
        }
      }
    } else {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios!")
    }
  }, [formData, userId, userPropriedade, sendDataToFirebase, isFormValid, resetForm, navigation, isConnected])

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
        setListModalData(veiculos.map((v) => ({ id: v.id, name: `${v.modelo} (${v.placa})` })))
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
       
            const selectedVehicle = veiculos.find((v) => v.id === item.id)
            if (selectedVehicle) {
      
              handleChange("placaId", item.id)
              handleChange("placa", selectedVehicle.placa)
              handleChange("veiculo", item.name)
            }
          }
          setListModalVisible(false)
        }}
      >
        <Text>{item.name}</Text>
      </TouchableOpacity>
    ),
    [listModalType, handleChange, veiculos],
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
              showsVerticalScrollIndicator={false}
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
          <Text>{formData.veiculo || "Selecione o Veículo"}</Text>
          <ChevronDown size={20} color={COLORS.vehicle.primary} />
        </TouchableOpacity>
        <Separator />

        {renderDatePickerField("Data", "data")}
        <Separator />

        {renderInputField("KM Atual", "kmAtual", formData.kmAtual, handleChange, "numeric")}
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

      {/* Componente DateTimePickerModal com tratamento de erro */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
        date={selectedDate || new Date()} 
        maximumDate={new Date()} 
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
})