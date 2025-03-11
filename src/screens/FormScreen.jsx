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
import { X, Trash2, ChevronDown } from "lucide-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { saveOfflineData, checkConnectivityAndSync } from "../utils/offlineManager"
import { BENS, IMPLEMENTOS, ATIVIDADES, PRODUTOS, DIRECIONADOR, TANQUEDIESEL, CULTURA } from "./assets"
import { auth } from "../config/firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"

const USER_TOKEN_KEY = "@user_token"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const OFFLINE_STORAGE_KEY = "@offline_apontamentos"

const initialFormData = {
  fichaControle: "",
  data: "",
  direcionador: "",
  cultura: "",
  atividade: "",
  observacao: "",
}

export default function FormScreen() {
  const [formData, setFormData] = useState(initialFormData)
  // Add the following state variables after the abastecimentoData state declaration
  const [operacaoMecanizadaModalVisible, setOperacaoMecanizadaModalVisible] = useState(false)
  const [operacaoMecanizadaData, setOperacaoMecanizadaData] = useState({
    bem: "",
    implemento: "",
    horaInicial: "",
    horaFinal: "",
  })
  const [selectedOperacoesMecanizadas, setSelectedOperacoesMecanizadas] = useState([])
  const [isDatePickerVisible, setDatePickerVisible] = useState(false)
  const [bens, setBens] = useState([])
  const [bensImplementos, setBensImplementos] = useState([])
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

  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

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
    if (!isAuthInitialized || !isAuthenticated) {
      return
    }

    const fetchData = async (path, setterFunction) => {
      try {
        const dbRef = ref(database, path)
        onValue(
          dbRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val()
              setterFunction(data || {})
            }
          },
          (error) => {
            console.error(`Error fetching ${path}:`, error)
            if (isMounted.current) {
              setError(`Failed to load ${path}. Please try again.`)
            }
          },
        )
      } catch (error) {
        console.error(`Error setting up listener for ${path}:`, error)
        if (isMounted.current) {
          setError(`Failed to set up listener for ${path}. Please try again.`)
        }
      }
    }

    Promise.all([
      fetchData("bens-implementos", (data) => {
        setBens(data || {})
        setBensImplementos(data || {})
      }),
    ])
      .then(() => {
        if (isMounted.current) {
          setIsLoading(false)
        }
      })
      .catch((error) => {
        console.error("Error in Promise.all:", error)
        if (isMounted.current) {
          setError("Failed to load all data. Please try again.")
          setIsLoading(false)
        }
      })
  }, [isAuthInitialized, isAuthenticated])

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

  // Add these handler functions after the handleAbastecimentoChange function
  const handleOperacaoMecanizadaChange = useCallback((name, value) => {
    setOperacaoMecanizadaData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const addSelectedOperacaoMecanizada = useCallback((operacao) => {
    // Calculate total hours
    const horaInicial = Number.parseFloat(operacao.horaInicial) || 0
    const horaFinal = Number.parseFloat(operacao.horaFinal) || 0
    const totalHoras = horaFinal > horaInicial ? (horaFinal - horaInicial).toFixed(2) : 0

    setSelectedOperacoesMecanizadas((prev) => [...prev, { ...operacao, id: Date.now(), totalHoras }])
    setOperacaoMecanizadaData({
      bem: "",
      implemento: "",
      horaInicial: "",
      horaFinal: "",
    })
  }, [])

  const removeSelectedOperacaoMecanizada = useCallback((id) => {
    setSelectedOperacoesMecanizadas((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const sendDataToFirebase = useCallback(
    async (apontamentoData) => {
      const apontamentosRef = ref(database, `propriedades/${userPropriedade}/apontamentos`)
      const existingEntryQuery = query(apontamentosRef, orderByChild("localId"), equalTo(apontamentoData.localId))
      const existingEntrySnapshot = await get(existingEntryQuery)

      if (!existingEntrySnapshot.exists()) {
        const newEntryRef = push(apontamentosRef)
        await set(newEntryRef, apontamentoData)
        console.log("Apontamento enviado com sucesso:", apontamentoData.localId)
        return true
      } else {
        console.log("Apontamento já existe, ignorando:", apontamentoData.localId)
        return false
      }
    },
    [userPropriedade],
  )

  const handleSubmit = useCallback(async () => {
    if (isFormValid()) {
      try {
        const localId = Date.now().toString()
        // Modify the handleSubmit function to include operacoesMecanizadas in the apontamentoData
        const apontamentoData = {
          ...formData,
          atividade: ATIVIDADES.find((a) => a.id === formData.atividade)?.name || formData.atividade,
          direcionador: DIRECIONADOR.find((d) => d.id === formData.direcionador)?.name || formData.direcionador,
          cultura: CULTURA.find((c) => c.id === formData.cultura)?.name || formData.cultura,
          timestamp: Date.now(),
          operacoesMecanizadas: selectedOperacoesMecanizadas.map((op) => ({
            ...op,
            bem: BENS.find((b) => b.id === op.bem)?.name || op.bem,
            implemento: IMPLEMENTOS.find((i) => i.id === op.implemento)?.name || op.implemento,
          })),
          userId: userId,
          propriedade: userPropriedade,
          localId: localId,
          status: "pending",
        }

        const netInfo = await NetInfo.fetch()
        if (netInfo.isConnected) {
          const sent = await sendDataToFirebase(apontamentoData)
          if (sent) {
            Alert.alert("Sucesso", "Dados enviados com sucesso!")
            resetForm()
          } else {
            Alert.alert("Atenção", "Este apontamento já foi enviado anteriormente.")
          }
        } else {
          // Check if we already have this localId saved offline
          const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            await saveOfflineData(apontamentoData)
            Alert.alert("Modo Offline", "Dados salvos localmente e serão sincronizados quando houver conexão.")
            resetForm()
          } else {
            Alert.alert("Atenção", "Este apontamento já foi salvo localmente.")
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
            const apontamentoData = {
              ...formData,
              atividade: ATIVIDADES.find((a) => a.id === formData.atividade)?.name || formData.atividade,
              direcionador: DIRECIONADOR.find((d) => d.id === formData.direcionador)?.name || formData.direcionador,
              cultura: CULTURA.find((c) => c.id === formData.cultura)?.name || formData.cultura,
              timestamp: Date.now(),
              operacoesMecanizadas: selectedOperacoesMecanizadas.map((op) => ({
                ...op,
                bem: BENS.find((b) => b.id === op.bem)?.name || op.bem,
                implemento: IMPLEMENTOS.find((i) => i.id === op.implemento)?.name || op.implemento,
              })),
              userId: userId,
              propriedade: userPropriedade,
              localId: localId,
              status: "pending",
            }
            await saveOfflineData(apontamentoData)
          }
        } catch (saveError) {
          console.error("Error saving offline data after submission error:", saveError)
        }
      }
    } else {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios!")
    }
  }, [formData, userId, userPropriedade, sendDataToFirebase, isFormValid, resetForm, selectedOperacoesMecanizadas])

  const isFormValid = useCallback(() => {
    const requiredFields = ["fichaControle", "data", "atividade"]
    return requiredFields.every((field) => formData[field] && formData[field].trim() !== "")
  }, [formData])

  // Also update the resetForm function to reset the operacoesMecanizadas state
  const resetForm = useCallback(() => {
    setFormData(initialFormData)
    setOperacaoMecanizadaData({
      bem: "",
      implemento: "",
      horaInicial: "",
      horaFinal: "",
    })
    setSelectedOperacoesMecanizadas([])
  }, [])

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

  const renderModal = useCallback(
    (visible, setVisible, title, content) => (
      <Modal visible={visible} transparent={true} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { flex: 1, textAlign: "center" }]}>{title}</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={[styles.closeButton, { position: "absolute", right: 0 }]}
                accessibilityLabel="Fechar modal"
                accessibilityHint="Toque para fechar o modal"
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
              {content}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    ),
    [],
  )

  const renderSelectedItems = useCallback(
    (items, removeFunction, type) => (
      <View>
        {items.map((item) => (
          <View key={item.id} style={styles.selectedItem}>
            <Text>
              {type === "produto"
                ? `${PRODUTOS.find((p) => p.id === item.produto)?.name} - ${TANQUEDIESEL.find((t) => t.id === item.tanqueDiesel)?.name || ""}`
                : PRODUTOS.find((p) => p.id === item.produto)?.name}
            </Text>
            <TouchableOpacity onPress={() => removeFunction(item.id)}>
              <Trash2 size={20} color="#FF0000" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    ),
    [],
  )

  const Separator = useCallback(() => <View style={styles.separator} />, [])

  // Add the openListModal function to include bem and implemento types
  const openListModal = useCallback((type) => {
    setListModalType(type)
    setListModalData(
      type === "produto"
        ? PRODUTOS
        : type === "tanqueDiesel"
          ? TANQUEDIESEL
          : type === "direcionador"
            ? DIRECIONADOR
            : type === "cultura"
              ? CULTURA
              : type === "bem"
                ? BENS
                : type === "implemento"
                  ? IMPLEMENTOS
                  : ATIVIDADES,
    )
    setSearchQuery("")
    setListModalVisible(true)
  }, [])

  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  // Update the renderListItem function to handle bem and implemento selections
  const renderListItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          if (listModalType === "atividade") {
            handleChange(listModalType, item.id)
          } else if (listModalType === "produto" || listModalType === "tanqueDiesel") {
            handleOperacaoMecanizadaChange(listModalType, item.id)
          } else if (listModalType === "bem" || listModalType === "implemento") {
            handleOperacaoMecanizadaChange(listModalType, item.id)
          } else if (listModalType === "direcionador" || listModalType === "cultura") {
            handleChange(listModalType, item.id)
          }
          setListModalVisible(false)
        }}
      >
        <Text>{item.name}</Text>
      </TouchableOpacity>
    ),
    [listModalType, handleChange, handleOperacaoMecanizadaChange],
  )

  // Update the renderListModal function to include bem and implemento types
  const renderListModal = useCallback(() => {
    return (
      <Modal visible={isListModalVisible} transparent={true} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { flex: 1, textAlign: "center" }]}>
                Selecione{" "}
                {listModalType === "produto"
                  ? "o Produto"
                  : listModalType === "tanqueDiesel"
                    ? "o Tanque de Diesel"
                    : listModalType === "direcionador"
                      ? "o Direcionador"
                      : listModalType === "cultura"
                        ? "a Cultura"
                        : listModalType === "bem"
                          ? "o Bem"
                          : listModalType === "implemento"
                            ? "o Implemento"
                            : "a Atividade"}
              </Text>
              <TouchableOpacity
                onPress={() => setListModalVisible(false)}
                style={[styles.closeButton, { position: "absolute", right: 0 }]}
              >
                <X size={24} color="#000" />
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
        <ActivityIndicator size="large" color="#2a9d8f" />
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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {renderInputField("Ficha de Controle", "fichaControle", formData.fichaControle, handleChange)}
        <Separator />
        {renderDatePickerField("Data", "data")}
        <Separator />
        <Text style={styles.label}>Direcionador</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("direcionador")}
          accessibilityLabel="Selecionar Direcionador"
        >
          <Text>{DIRECIONADOR.find((d) => d.id === formData.direcionador)?.name || "Selecione o Direcionador"}</Text>
          <ChevronDown size={20} color="#2a9d8f" />
        </TouchableOpacity>
        <Separator />
        <Text style={styles.label}>Cultura</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("cultura")}
          accessibilityLabel="Selecionar Cultura"
        >
          <Text>{CULTURA.find((c) => c.id === formData.cultura)?.name || "Selecione a Cultura"}</Text>
          <ChevronDown size={20} color="#2a9d8f" />
        </TouchableOpacity>
        <Separator />
        <Text style={styles.label}>Atividade</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("atividade")}
          accessibilityLabel="Selecionar Atividade"
        >
          <Text>{ATIVIDADES.find((a) => a.id === formData.atividade)?.name || "Selecione a Atividade"}</Text>
          <ChevronDown size={20} color="#2a9d8f" />
        </TouchableOpacity>
        <Separator />
        {/* Now add the Operações Mecanizadas section in the return statement */}
        <Text style={styles.label}>Operações Mecanizadas</Text>
        <TouchableOpacity
          style={styles.modalButton}
          onPress={() => setOperacaoMecanizadaModalVisible(true)}
          accessibilityLabel="Lançar Operações Mecanizadas"
          accessibilityHint="Toque para abrir o formulário de lançamento de operações mecanizadas"
        >
          <Text style={styles.buttonText}>Lançar Operações Mecanizadas</Text>
        </TouchableOpacity>
        <Separator />
        {renderInputField("Observação", "observacao", formData.observacao, handleChange)}
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
      {/* Finally, add the modal for Operações Mecanizadas */}
      {renderModal(
        operacaoMecanizadaModalVisible,
        setOperacaoMecanizadaModalVisible,
        "Lançar Operações Mecanizadas",
        <>
          <Text style={styles.label}>Bem</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => openListModal("bem")}
            accessibilityLabel="Selecionar Bem"
          >
            <Text>{BENS.find((b) => b.id === operacaoMecanizadaData.bem)?.name || "Selecione o Bem"}</Text>
            <ChevronDown size={20} color="#2a9d8f" />
          </TouchableOpacity>
          <Text style={styles.label}>Implemento</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => openListModal("implemento")}
            accessibilityLabel="Selecionar Implemento"
          >
            <Text>
              {IMPLEMENTOS.find((i) => i.id === operacaoMecanizadaData.implemento)?.name || "Selecione o Implemento"}
            </Text>
            <ChevronDown size={20} color="#2a9d8f" />
          </TouchableOpacity>
          {renderInputField(
            "Hora Máquina Inicial",
            "horaInicial",
            operacaoMecanizadaData.horaInicial,
            handleOperacaoMecanizadaChange,
            "numeric",
          )}
          {renderInputField(
            "Hora Máquina Final",
            "horaFinal",
            operacaoMecanizadaData.horaFinal,
            handleOperacaoMecanizadaChange,
            "numeric",
          )}
          {operacaoMecanizadaData.horaInicial && operacaoMecanizadaData.horaFinal && (
            <View style={styles.calculatedHours}>
              <Text style={styles.label}>Total de Horas:</Text>
              <Text style={styles.hoursValue}>
                {Number.parseFloat(operacaoMecanizadaData.horaFinal) >
                Number.parseFloat(operacaoMecanizadaData.horaInicial)
                  ? (
                      Number.parseFloat(operacaoMecanizadaData.horaFinal) -
                      Number.parseFloat(operacaoMecanizadaData.horaInicial)
                    ).toFixed(2)
                  : "0.00"}
              </Text>
            </View>
          )}
          {selectedOperacoesMecanizadas.length > 0 && (
            <View style={styles.selectedItemsContainer}>
              <Text style={[styles.label, { marginTop: 16 }]}>Operações Adicionadas:</Text>
              {selectedOperacoesMecanizadas.map((item) => (
                <View key={item.id} style={styles.selectedItem}>
                  <View>
                    <Text style={styles.selectedItemTitle}>{BENS.find((b) => b.id === item.bem)?.name}</Text>
                    <Text style={styles.selectedItemSubtitle}>
                      {IMPLEMENTOS.find((i) => i.id === item.implemento)?.name}
                    </Text>
                    <Text>
                      Horas: {item.horaInicial} - {item.horaFinal} = {item.totalHoras}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeSelectedOperacaoMecanizada(item.id)}>
                    <Trash2 size={20} color="#FF0000" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.button,
              (!operacaoMecanizadaData.bem ||
                !operacaoMecanizadaData.implemento ||
                !operacaoMecanizadaData.horaInicial ||
                !operacaoMecanizadaData.horaFinal ||
                Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                  Number.parseFloat(operacaoMecanizadaData.horaInicial)) &&
                styles.disabledButton,
            ]}
            onPress={() => {
              if (
                operacaoMecanizadaData.bem &&
                operacaoMecanizadaData.implemento &&
                operacaoMecanizadaData.horaInicial &&
                operacaoMecanizadaData.horaFinal &&
                Number.parseFloat(operacaoMecanizadaData.horaFinal) >
                  Number.parseFloat(operacaoMecanizadaData.horaInicial)
              ) {
                addSelectedOperacaoMecanizada(operacaoMecanizadaData)
                setOperacaoMecanizadaModalVisible(false)
              }
            }}
            disabled={
              !operacaoMecanizadaData.bem ||
              !operacaoMecanizadaData.implemento ||
              !operacaoMecanizadaData.horaInicial ||
              !operacaoMecanizadaData.horaFinal ||
              Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                Number.parseFloat(operacaoMecanizadaData.horaInicial)
            }
            accessibilityLabel="Adicionar operação mecanizada"
            accessibilityHint="Toque para adicionar a operação mecanizada e fechar o modal"
          >
            <Text style={styles.buttonText}>Adicionar Operação</Text>
          </TouchableOpacity>
        </>,
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: "#2a9d8f",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  input: {
    height: 50,
    borderColor: "#2a9d8f",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#F5F5F5",
    fontSize: 16,
    color: "#333333",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  disabledInput: {
    backgroundColor: "#F5F5F5",
    color: "#666666",
  },
  datePickerText: {
    fontSize: 16,
    color: "#333333",
    paddingVertical: 12,
  },
  modalButton: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2a9d8f",
  },
  buttonEnviar: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  buttonText: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "500",
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
    color: "#333333",
  },
  closeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: "#E5E5E5",
  },
  selectedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
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
    borderColor: "#2a9d8f",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#333333",
  },
  flatList: {
    marginTop: 10,
    marginBottom: 10,
  },
  calculatedHours: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  hoursValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2a9d8f",
  },
  selectedItemsContainer: {
    marginBottom: 16,
  },
  selectedItemTitle: {
    fontWeight: "bold",
  },
  selectedItemSubtitle: {
    color: "#666",
    marginBottom: 4,
  },
})

