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
import { ref, push, set, onValue, query, orderByChild, equalTo, get, update, remove } from "firebase/database"
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
const PREVIOUS_HORIMETROS_KEY = "@previous_horimetros"

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
  const [operacaoMecanizadaModalVisible, setOperacaoMecanizadaModalVisible] = useState(false)
  const [operacaoMecanizadaData, setOperacaoMecanizadaData] = useState({
    bem: "",
    implemento: "",
    horaFinal: "",
  })
  const [previousHorimetros, setPreviousHorimetros] = useState({})
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
  const [isHorimetrosLoading, setIsHorimetrosLoading] = useState(true)

  const isMounted = useRef(true)

  const isFormValid = useCallback(() => {
    const requiredFields = ["fichaControle", "data", "atividade"]
    return requiredFields.every((field) => formData[field] && formData[field].trim() !== "")
  }, [formData])

  const resetForm = useCallback(() => {
    setFormData(initialFormData)
    setOperacaoMecanizadaData({
      bem: "",
      implemento: "",
      horaFinal: "",
    })
    setSelectedOperacoesMecanizadas([])
  }, [])

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Carregar horímetros do Firebase em vez do AsyncStorage
  useEffect(() => {
    if (!userPropriedade) return

    const loadHorimetrosFromFirebase = () => {
      try {
        setIsHorimetrosLoading(true)
        const horimetrosRef = ref(database, `propriedades/${userPropriedade}/horimetros`)

        // Configurar listener para atualizações em tempo real
        const unsubscribe = onValue(
          horimetrosRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}
              setPreviousHorimetros(data)
              setIsHorimetrosLoading(false)
            }
          },
          (error) => {
            console.error("Erro ao carregar horímetros do Firebase:", error)
            setIsHorimetrosLoading(false)

            // Fallback para dados locais em caso de erro
            loadLocalHorimetros()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para horímetros:", error)
        setIsHorimetrosLoading(false)

        // Fallback para dados locais em caso de erro
        loadLocalHorimetros()
      }
    }

    const loadLocalHorimetros = async () => {
      try {
        const storedHorimetros = await AsyncStorage.getItem(PREVIOUS_HORIMETROS_KEY)
        if (storedHorimetros) {
          setPreviousHorimetros(JSON.parse(storedHorimetros))
        }
      } catch (error) {
        console.error("Erro ao carregar horímetros locais:", error)
      }
    }

    const unsubscribe = loadHorimetrosFromFirebase()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userPropriedade])

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

  const handleChange = useCallback((name, value) => {
    if (name === "direcionador") {
      const selectedDirecionador = DIRECIONADOR.find((d) => d.id === value)
      let cultura = ""

      if (selectedDirecionador) {
        const direcionadorName = selectedDirecionador.name.toLowerCase()
        if (direcionadorName.includes("alh")) {
          cultura = "alho"
        } else if (direcionadorName.includes("ceb")) {
          cultura = "cebola"
        } else if (direcionadorName.includes("sorgo")) {
          cultura = "sorgo"
        }
      }

      return setFormData((prev) => ({ ...prev, [name]: value, cultura }))
    }

    return setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleOperacaoMecanizadaChange = useCallback(
    (name, value) => {
      setOperacaoMecanizadaData((prev) => {
        // Se o campo alterado for "bem", resetamos o horaFinal
        if (name === "bem") {
          return { ...prev, [name]: value, horaFinal: "" }
        }

        // Não validamos mais aqui, apenas atualizamos o valor
        return { ...prev, [name]: value }
      })
    },
    [previousHorimetros],
  )

  // Função para salvar os horímetros atualizados no Firebase
  const saveHorimetrosToFirebase = async (updatedHorimetros) => {
    if (!userPropriedade) {
      console.error("Propriedade não definida, não é possível salvar horímetros")
      return false
    }

    try {
      const horimetrosRef = ref(database, `propriedades/${userPropriedade}/horimetros`)
      await update(horimetrosRef, updatedHorimetros)

      // Também salva localmente como backup
      await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))
      return true
    } catch (error) {
      console.error("Erro ao salvar horímetros no Firebase:", error)

      // Em caso de falha, salva apenas localmente
      try {
        await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))
      } catch (localError) {
        console.error("Erro ao salvar horímetros localmente:", localError)
      }
      return false
    }
  }

  const addSelectedOperacaoMecanizada = useCallback(
    async (operacao) => {
      // Obter o horímetro anterior para este bem
      const horaInicial = previousHorimetros[operacao.bem] || "0.00"

      // Calcular total de horas
      const horaFinal = Number.parseFloat(operacao.horaFinal) || 0
      const horaInicialNum = Number.parseFloat(horaInicial) || 0
      const totalHoras = horaFinal > horaInicialNum ? (horaFinal - horaInicialNum).toFixed(2) : "0.00"

      // Adicionar à lista de operações selecionadas
      setSelectedOperacoesMecanizadas((prev) => [
        ...prev,
        {
          ...operacao,
          id: Date.now(),
          horaInicial,
          totalHoras,
        },
      ])

      // Atualizar o horímetro anterior para este bem
      const updated = { ...previousHorimetros, [operacao.bem]: operacao.horaFinal }

      // Salvar no Firebase e atualizar o estado local
      const saved = await saveHorimetrosToFirebase(updated)
      if (saved) {
        setPreviousHorimetros(updated)
      } else {
        // Se falhar ao salvar no Firebase, pelo menos atualiza localmente
        setPreviousHorimetros(updated)
        Alert.alert(
          "Atenção",
          "Horímetro salvo apenas localmente. A sincronização com outros dispositivos ocorrerá quando houver conexão.",
        )
      }

      // Resetar o formulário de operação mecanizada
      setOperacaoMecanizadaData({
        bem: "",
        implemento: "",
        horaFinal: "",
      })
    },
    [previousHorimetros, userPropriedade],
  )

  // Função simplificada para remover horímetros do Firebase
  const removeSelectedOperacaoMecanizada = useCallback(
    async (id) => {
      try {
        // Encontrar a operação que será removida
        const operacaoParaRemover = selectedOperacoesMecanizadas.find((item) => item.id === id)

        if (!operacaoParaRemover || !userPropriedade) {
          console.error("Operação não encontrada ou propriedade não definida")
          return
        }

        // Remover da lista local primeiro
        setSelectedOperacoesMecanizadas((prev) => prev.filter((item) => item.id !== id))

        // Verificar se existem outras operações para o mesmo bem
        const outrasOperacoesDoMesmoBem = selectedOperacoesMecanizadas.filter(
          (item) => item.id !== id && item.bem === operacaoParaRemover.bem,
        )

        // Referência para o nó específico do horímetro no Firebase
        const horimetroRef = ref(database, `propriedades/${userPropriedade}/horimetros/${operacaoParaRemover.bem}`)

        if (outrasOperacoesDoMesmoBem.length === 0) {
          // Se não houver outras operações, remover o horímetro completamente
          await remove(horimetroRef)

          // Atualizar o estado local
          const updatedHorimetros = { ...previousHorimetros }
          delete updatedHorimetros[operacaoParaRemover.bem]
          setPreviousHorimetros(updatedHorimetros)

          // Atualizar o AsyncStorage
          await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))

          console.log(`Horímetro para o bem ${operacaoParaRemover.bem} removido com sucesso`)
        } else {
          // Se houver outras operações, encontrar o valor anterior
          // Usamos o horaInicial da operação que está sendo removida como valor a restaurar
          const valorAnterior = operacaoParaRemover.horaInicial

          // Atualizar o Firebase com o valor anterior
          await set(horimetroRef, valorAnterior)

          // Atualizar o estado local
          const updatedHorimetros = {
            ...previousHorimetros,
            [operacaoParaRemover.bem]: valorAnterior,
          }
          setPreviousHorimetros(updatedHorimetros)

          // Atualizar o AsyncStorage
          await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))

          console.log(`Horímetro para o bem ${operacaoParaRemover.bem} restaurado para ${valorAnterior}`)
        }
      } catch (error) {
        console.error("Erro ao remover/atualizar horímetro:", error)
        Alert.alert("Erro", "Não foi possível remover o horímetro. Tente novamente.")
      }
    },
    [selectedOperacoesMecanizadas, userPropriedade, previousHorimetros],
  )

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

  const openListModal = useCallback((type) => {
    setListModalType(type)
    setListModalData(
      type === "produto"
        ? PRODUTOS
        : type === "tanqueDiesel"
          ? TANQUEDIESEL
          : type === "direcionador"
            ? DIRECIONADOR
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
          } else if (listModalType === "direcionador") {
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
        <View style={[styles.input, styles.disabledInput]}>
          <Text>{CULTURA.find((c) => c.id === formData.cultura)?.name || "Será definida pelo direcionador"}</Text>
        </View>
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

          {operacaoMecanizadaData.bem && (
            <View style={styles.horimetroAnteriorContainer}>
              <Text style={styles.label}>Horímetro Anterior</Text>
              <View style={styles.horimetroAnteriorValue}>
                <Text style={styles.horimetroText}>{previousHorimetros[operacaoMecanizadaData.bem] || "0.00"}</Text>
              </View>
            </View>
          )}

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
            "Horímetro Atual",
            "horaFinal",
            operacaoMecanizadaData.horaFinal,
            handleOperacaoMecanizadaChange,
            "numeric",
          )}

          {operacaoMecanizadaData.bem && operacaoMecanizadaData.horaFinal && (
            <View style={styles.calculatedHours}>
              <Text style={styles.label}>Total de Horas:</Text>
              <Text style={styles.hoursValue}>
                {(() => {
                  const horaAnterior = Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")
                  const horaAtual = Number.parseFloat(operacaoMecanizadaData.horaFinal)
                  return horaAtual > horaAnterior ? (horaAtual - horaAnterior).toFixed(2) : "0.00"
                })()}
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
                      Horas: {item.horaInicial} → {item.horaFinal} = {item.totalHoras}
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
                !operacaoMecanizadaData.horaFinal ||
                Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                  Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")) &&
                styles.disabledButton,
            ]}
            onPress={() => {
              if (operacaoMecanizadaData.bem && operacaoMecanizadaData.implemento && operacaoMecanizadaData.horaFinal) {
                const horaAnterior = Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")
                const horaAtual = Number.parseFloat(operacaoMecanizadaData.horaFinal)

                if (horaAtual <= horaAnterior) {
                  Alert.alert(
                    "Valor inválido",
                    "O horímetro atual não pode ser menor ou igual ao horímetro anterior. Por favor, insira um valor maior.",
                    [{ text: "OK" }],
                  )
                } else {
                  addSelectedOperacaoMecanizada(operacaoMecanizadaData)
                  setOperacaoMecanizadaModalVisible(false)
                }
              }
            }}
            disabled={
              !operacaoMecanizadaData.bem ||
              !operacaoMecanizadaData.implemento ||
              !operacaoMecanizadaData.horaFinal ||
              Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    paddingTop: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitle: {
    color: "#2a9d8f",
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    padding: 8,
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
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#333333",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  disabledInput: {
    backgroundColor: "#F0F8F7",
    color: "#2a9d8f",
    borderStyle: "dashed",
  },
  datePickerText: {
    fontSize: 16,
    color: "#333333",
    paddingVertical: 12,
  },
  modalButton: {
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#F0F8F7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2a9d8f",
  },
  hoursValue: {
    fontSize: 18,
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
  horimetroAnteriorContainer: {
    marginBottom: 16,
  },
  horimetroAnteriorValue: {
    backgroundColor: "#F0F8F7",
    borderWidth: 1,
    borderColor: "#2a9d8f",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    height: 50,
    justifyContent: "center",
  },
  horimetroText: {
    fontSize: 16,
    color: "#2a9d8f",
    fontWeight: "bold",
  },
})
