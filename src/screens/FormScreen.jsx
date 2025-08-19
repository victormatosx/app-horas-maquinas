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
import { ref, push, set, onValue, query, orderByChild, equalTo, get, update } from "firebase/database"
import { X, Trash2, ChevronDown, Check } from "lucide-react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { saveOfflineData, checkConnectivityAndSync } from "../utils/offlineManager"
import { PRODUTOS, TANQUEDIESEL, CULTURA } from "./assets"
import { auth } from "../config/firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"

const USER_TOKEN_KEY = "@user_token"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const OFFLINE_STORAGE_KEY = "@offline_apontamentos"
const PREVIOUS_HORIMETROS_KEY = "@previous_horimetros"
const CACHED_MAQUINARIOS_KEY = "@cached_maquinarios"
const CACHED_IMPLEMENTOS_KEY = "@cached_implementos"
const CACHED_DIRECIONADORES_KEY = "@cached_direcionadores"
const CACHED_HORIMETROS_KEY = "@cached_horimetros"
const CACHED_ATIVIDADES_KEY = "@cached_atividades"
const FICHA_CONTROLE_KEY = "@ficha_controle_numero"

const initialFormData = {
  fichaControle: "",
  data: "",
  direcionador: "",
  direcionadores: [],
  cultura: "",
  atividade: "",
  observacao: "",
}

export default function FormScreen({ navigation }) {
  const [formData, setFormData] = useState(initialFormData)
  const [operacaoMecanizadaModalVisible, setOperacaoMecanizadaModalVisible] = useState(false)
  const [operacaoMecanizadaData, setOperacaoMecanizadaData] = useState({
    bem: "",
    implemento: "",
    implementos: [],
    horaFinal: "",
  })
  const [previousHorimetros, setPreviousHorimetros] = useState({})
  const [selectedOperacoesMecanizadas, setSelectedOperacoesMecanizadas] = useState([])
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
  const [isHorimetrosLoading, setIsHorimetrosLoading] = useState(true)

  // Inicializar arrays como arrays vazios para evitar erros de undefined
  const [direcionadores, setDirecionadores] = useState([])
  const [maquinarios, setMaquinarios] = useState([])
  const [implementos, setImplementos] = useState([])
  const [atividades, setAtividades] = useState([])

  const [fichaControleNumero, setFichaControleNumero] = useState(40000)
  const [selectedDirecionadores, setSelectedDirecionadores] = useState([])
  const [selectedImplementos, setSelectedImplementos] = useState([])

  // NEW: Estado para seleção múltipla temporária no modal
  const [tempSelectedDirecionadores, setTempSelectedDirecionadores] = useState([])
  const [tempSelectedImplementos, setTempSelectedImplementos] = useState([])

  const isMounted = useRef(true)

  // UPDATED: Enhanced form validation to include all required fields except "observacao"
  const isFormValid = useCallback(() => {
    const requiredFields = ["fichaControle", "data", "atividade"]
    const basicFieldsValid = requiredFields.every((field) => formData[field] && formData[field].trim() !== "")

    // Check if at least one direcionador is selected
    const direcionadorValid = Array.isArray(selectedDirecionadores) && selectedDirecionadores.length > 0

    // Check if at least one mechanized operation is added
    const operacoesMecanizadasValid =
      Array.isArray(selectedOperacoesMecanizadas) && selectedOperacoesMecanizadas.length > 0

    return basicFieldsValid && direcionadorValid && operacoesMecanizadasValid
  }, [formData, selectedDirecionadores, selectedOperacoesMecanizadas])

  const resetForm = useCallback(() => {
    const novoNumero = fichaControleNumero + 1
    setFichaControleNumero(novoNumero)

    AsyncStorage.setItem(FICHA_CONTROLE_KEY, novoNumero.toString()).catch((error) =>
      console.error("Erro ao salvar número da ficha:", error),
    )

    setFormData(initialFormData)
    setSelectedDirecionadores([])

    setOperacaoMecanizadaData({
      bem: "",
      implemento: "",
      implementos: [],
      horaFinal: "",
    })
    setSelectedImplementos([])
    setSelectedOperacoesMecanizadas([])
  }, [fichaControleNumero])

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    const carregarNumeroFicha = async () => {
      try {
        const numeroSalvo = await AsyncStorage.getItem(FICHA_CONTROLE_KEY)
        if (numeroSalvo) {
          const numero = Number.parseInt(numeroSalvo, 10)
          setFichaControleNumero(numero)
        } else {
          setFichaControleNumero(40000)
        }
      } catch (error) {
        console.error("Erro ao carregar número da ficha:", error)
        setFichaControleNumero(40000)
      }
    }

    carregarNumeroFicha()
  }, [])

  useEffect(() => {
    if (!userPropriedade) return

    const loadAtividadesFromFirebase = () => {
      try {
        const atividadesRef = ref(database, `propriedades/${userPropriedade}/atividades`)

        const unsubscribe = onValue(
          atividadesRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}
              const atividadesArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: value.atividade || "Atividade sem nome",
              }))

              setAtividades(atividadesArray)

              AsyncStorage.setItem(CACHED_ATIVIDADES_KEY, JSON.stringify(atividadesArray)).catch((error) =>
                console.error("Erro ao salvar atividades no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar atividades do Firebase:", error)
            loadCachedAtividades()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para atividades:", error)
        loadCachedAtividades()
      }
    }

    const loadCachedAtividades = async () => {
      try {
        const cachedData = await AsyncStorage.getItem(CACHED_ATIVIDADES_KEY)
        if (cachedData) {
          const atividadesArray = JSON.parse(cachedData)
          setAtividades(atividadesArray)
          console.log("Atividades carregadas do cache")
        }
      } catch (error) {
        console.error("Erro ao carregar atividades do cache:", error)
      }
    }

    const unsubscribe = loadAtividadesFromFirebase()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userPropriedade])

  useEffect(() => {
    if (!userPropriedade) return

    const loadDirecionadoresFromFirebase = () => {
      try {
        const direcionadoresRef = ref(database, `propriedades/${userPropriedade}/direcionadores`)

        const unsubscribe = onValue(
          direcionadoresRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}
              const direcionadoresArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: value.direcionador || "Direcionador sem nome",
                culturaAssociada: value.culturaAssociada || "",
              }))

              setDirecionadores(direcionadoresArray)

              AsyncStorage.setItem(CACHED_DIRECIONADORES_KEY, JSON.stringify(direcionadoresArray)).catch((error) =>
                console.error("Erro ao salvar direcionadores no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar direcionadores do Firebase:", error)
            loadCachedDirecionadores()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para direcionadores:", error)
        loadCachedDirecionadores()
      }
    }

    const loadCachedDirecionadores = async () => {
      try {
        const cachedData = await AsyncStorage.getItem(CACHED_DIRECIONADORES_KEY)
        if (cachedData) {
          const direcionadoresArray = JSON.parse(cachedData)
          setDirecionadores(direcionadoresArray)
          console.log("Direcionadores carregados do cache")
        }
      } catch (error) {
        console.error("Erro ao carregar direcionadores do cache:", error)
      }
    }

    const unsubscribe = loadDirecionadoresFromFirebase()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userPropriedade])

  useEffect(() => {
    if (!userPropriedade) return

    const loadMaquinariosFromFirebase = () => {
      try {
        const maquinariosRef = ref(database, `propriedades/${userPropriedade}/maquinarios`)

        const unsubscribe = onValue(
          maquinariosRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}
              const maquinariosArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: `${value.id} - ${value.nome}`,
                rawName: value.nome || "Máquina sem nome",
              }))

              setMaquinarios(maquinariosArray)

              AsyncStorage.setItem(CACHED_MAQUINARIOS_KEY, JSON.stringify(maquinariosArray)).catch((error) =>
                console.error("Erro ao salvar maquinários no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar maquinários do Firebase:", error)
            loadCachedMaquinarios()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para maquinários:", error)
        loadCachedMaquinarios()
      }
    }

    const loadCachedMaquinarios = async () => {
      try {
        const cachedData = await AsyncStorage.getItem(CACHED_MAQUINARIOS_KEY)
        if (cachedData) {
          const maquinariosArray = JSON.parse(cachedData)
          setMaquinarios(maquinariosArray)
          console.log("Maquinários carregados do cache")
        }
      } catch (error) {
        console.error("Erro ao carregar maquinários do cache:", error)
      }
    }

    const unsubscribe = loadMaquinariosFromFirebase()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userPropriedade])

  useEffect(() => {
    if (!userPropriedade) return

    const loadImplementosFromFirebase = () => {
      try {
        const implementosRef = ref(database, `propriedades/${userPropriedade}/implementos`)

        const unsubscribe = onValue(
          implementosRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}
              const implementosArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: `${value.id} - ${value.nome}`,
                rawName: value.nome || "Implemento sem nome",
              }))

              setImplementos(implementosArray)

              AsyncStorage.setItem(CACHED_IMPLEMENTOS_KEY, JSON.stringify(implementosArray)).catch((error) =>
                console.error("Erro ao salvar implementos no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar implementos do Firebase:", error)
            loadCachedImplementos()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para implementos:", error)
        loadCachedImplementos()
      }
    }

    const loadCachedImplementos = async () => {
      try {
        const cachedData = await AsyncStorage.getItem(CACHED_IMPLEMENTOS_KEY)
        if (cachedData) {
          const implementosArray = JSON.parse(cachedData)
          setImplementos(implementosArray)
          console.log("Implementos carregados do cache")
        }
      } catch (error) {
        console.error("Erro ao carregar implementos do cache:", error)
      }
    }

    const unsubscribe = loadImplementosFromFirebase()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userPropriedade])

  useEffect(() => {
    if (!userPropriedade) return

    const loadHorimetrosFromFirebase = () => {
      try {
        setIsHorimetrosLoading(true)
        const horimetrosRef = ref(database, `propriedades/${userPropriedade}/horimetros`)

        const unsubscribe = onValue(
          horimetrosRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}
              setPreviousHorimetros(data)

              AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(data)).catch((error) =>
                console.error("Erro ao salvar horímetros no cache:", error),
              )

              AsyncStorage.setItem(CACHED_HORIMETROS_KEY, JSON.stringify(data)).catch((error) =>
                console.error("Erro ao salvar horímetros no cache padrão:", error),
              )

              setIsHorimetrosLoading(false)
            }
          },
          (error) => {
            console.error("Erro ao carregar horímetros do Firebase:", error)
            setIsHorimetrosLoading(false)
            loadLocalHorimetros()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para horímetros:", error)
        setIsHorimetrosLoading(false)
        loadLocalHorimetros()
      }
    }

    const loadLocalHorimetros = async () => {
      try {
        const storedHorimetros = await AsyncStorage.getItem(PREVIOUS_HORIMETROS_KEY)
        if (storedHorimetros) {
          setPreviousHorimetros(JSON.parse(storedHorimetros))
          return
        }

        const cachedHorimetros = await AsyncStorage.getItem(CACHED_HORIMETROS_KEY)
        if (cachedHorimetros) {
          setPreviousHorimetros(JSON.parse(cachedHorimetros))
          console.log("Horímetros carregados do cache padrão")
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

        const netInfo = await NetInfo.fetch()
        if (!netInfo.isConnected) {
          loadCachedData()
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }
    loadUserData()

    return () => unsubscribeAuth()
  }, [])

  const loadCachedData = async () => {
    try {
      const cachedMaquinarios = await AsyncStorage.getItem(CACHED_MAQUINARIOS_KEY)
      if (cachedMaquinarios) {
        setMaquinarios(JSON.parse(cachedMaquinarios))
        console.log("Maquinários carregados do cache")
      }

      const cachedImplementos = await AsyncStorage.getItem(CACHED_IMPLEMENTOS_KEY)
      if (cachedImplementos) {
        setImplementos(JSON.parse(cachedImplementos))
        console.log("Implementos carregados do cache")
      }

      const cachedDirecionadores = await AsyncStorage.getItem(CACHED_DIRECIONADORES_KEY)
      if (cachedDirecionadores) {
        setDirecionadores(JSON.parse(cachedDirecionadores))
        console.log("Direcionadores carregados do cache")
      }

      const cachedAtividades = await AsyncStorage.getItem(CACHED_ATIVIDADES_KEY)
      if (cachedAtividades) {
        setAtividades(JSON.parse(cachedAtividades))
        console.log("Atividades carregadas do cache")
      }

      const cachedHorimetros = await AsyncStorage.getItem(CACHED_HORIMETROS_KEY)
      if (cachedHorimetros) {
        setPreviousHorimetros(JSON.parse(cachedHorimetros))
        console.log("Horímetros carregados do cache")
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Erro ao carregar dados do cache:", error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthInitialized || !isAuthenticated) {
      return
    }
    setIsLoading(false)
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
    }, 300000)

    return () => clearInterval(syncInterval)
  }, [isSyncing])

  const handleDateConfirm = useCallback((date) => {
    const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`
    setFormData((prev) => ({ ...prev, data: formattedDate }))
    setDatePickerVisible(false)
  }, [])

  // UPDATED: Modified to handle single selections for non-direcionador fields
  const handleChange = useCallback((name, value) => {
    if (name === "direcionador") {
      // This is now handled by the multiple selection modal
      return
    }

    if (name === "fichaControle" && !isNaN(Number.parseInt(value, 10))) {
      setFichaControleNumero(Number.parseInt(value, 10))
    }

    return setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleOperacaoMecanizadaChange = useCallback(
    (name, value) => {
      if (name === "implemento") {
        // Verificar se implementos existe e é um array antes de usar find
        if (!Array.isArray(implementos) || implementos.length === 0) {
          console.warn("Implementos não carregados ainda")
          return
        }

        const selectedImplemento = implementos.find((i) => i.id === value)

        // Verificar se selectedImplementos existe e é um array
        if (!Array.isArray(selectedImplementos)) {
          console.warn("selectedImplementos não é um array")
          return
        }

        const isImplementoAlreadySelected = selectedImplementos.some((i) => i.id === value)

        if (!isImplementoAlreadySelected && selectedImplemento) {
          setSelectedImplementos((prev) => [...prev, selectedImplemento])

          setOperacaoMecanizadaData((prev) => ({
            ...prev,
            implemento: value,
            implementos: [...prev.implementos, value],
          }))
        }
        return
      }

      setOperacaoMecanizadaData((prev) => {
        if (name === "bem") {
          return { ...prev, [name]: value, horaFinal: "" }
        }
        return { ...prev, [name]: value }
      })
    },
    [implementos, selectedImplementos],
  )

  const removeImplemento = useCallback((implementoId) => {
    setOperacaoMecanizadaData((prev) => ({
      ...prev,
      implementos: prev.implementos.filter((id) => id !== implementoId),
      implemento:
        prev.implemento === implementoId
          ? prev.implementos.filter((id) => id !== implementoId)[0] || ""
          : prev.implemento,
    }))

    setSelectedImplementos((prev) => prev.filter((i) => i.id !== implementoId))
  }, [])

  const saveHorimetrosToFirebase = async (updatedHorimetros) => {
    if (!userPropriedade) {
      console.error("Propriedade não definida, não é possível salvar horímetros")
      return false
    }

    try {
      const horimetrosRef = ref(database, `propriedades/${userPropriedade}/horimetros`)
      await update(horimetrosRef, updatedHorimetros)

      await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))
      return true
    } catch (error) {
      console.error("Erro ao salvar horímetros no Firebase:", error)

      try {
        await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))
      } catch (localError) {
        console.error("Erro ao salvar horímetros localmente:", localError)
      }
      return false
    }
  }

  const calculateTotalHours = useCallback(() => {
    if (!Array.isArray(selectedOperacoesMecanizadas)) return 0

    return selectedOperacoesMecanizadas.reduce((total, operacao) => {
      const horas = Number.parseFloat(operacao.totalHoras) || 0
      return total + horas
    }, 0)
  }, [selectedOperacoesMecanizadas])

  const addSelectedOperacaoMecanizada = useCallback(
    async (operacao) => {
      if (!operacao.bem || !operacao.horaFinal) {
        Alert.alert("Atenção", "Preencha todos os campos obrigatórios.")
        return
      }

      if (!Array.isArray(selectedImplementos) || selectedImplementos.length === 0) {
        Alert.alert("Atenção", "Selecione pelo menos um implemento.")
        return
      }

      const horaInicial = previousHorimetros[operacao.bem] || "0.00"
      const horaFinal = Number.parseFloat(operacao.horaFinal) || 0
      const horaInicialNum = Number.parseFloat(horaInicial) || 0
      const totalHoras = horaFinal > horaInicialNum ? (horaFinal - horaInicialNum).toFixed(2) : "0.00"

      setSelectedOperacoesMecanizadas((prev) => [
        ...prev,
        {
          ...operacao,
          id: Date.now(),
          horaInicial,
          totalHoras,
          implementos: selectedImplementos.map((i) => ({
            id: i.id,
            name: i.name,
          })),
        },
      ])

      const updated = { ...previousHorimetros, [operacao.bem]: operacao.horaFinal }

      const saved = await saveHorimetrosToFirebase(updated)
      if (saved) {
        setPreviousHorimetros(updated)
      } else {
        setPreviousHorimetros(updated)
        Alert.alert(
          "Atenção",
          "Horímetro salvo apenas localmente. A sincronização com outros dispositivos ocorrerá quando houver conexão.",
        )
      }

      setOperacaoMecanizadaData({
        bem: "",
        implemento: "",
        implementos: [],
        horaFinal: "",
      })
      setSelectedImplementos([])
    },
    [previousHorimetros, userPropriedade, selectedImplementos, calculateTotalHours],
  )

  const removeSelectedOperacaoMecanizada = useCallback(
    async (id) => {
      try {
        if (!Array.isArray(selectedOperacoesMecanizadas)) {
          console.error("selectedOperacoesMecanizadas não é um array")
          return
        }

        const operacaoParaRemover = selectedOperacoesMecanizadas.find((item) => item.id === id)

        if (!operacaoParaRemover || !userPropriedade) {
          console.error("Operação não encontrada ou propriedade não definida")
          return
        }

        setSelectedOperacoesMecanizadas((prev) => prev.filter((item) => item.id !== id))

        const horimetroRef = ref(database, `propriedades/${userPropriedade}/horimetros/${operacaoParaRemover.bem}`)
        const valorAnterior = operacaoParaRemover.horaInicial

        await set(horimetroRef, valorAnterior)

        const updatedHorimetros = {
          ...previousHorimetros,
          [operacaoParaRemover.bem]: valorAnterior,
        }
        setPreviousHorimetros(updatedHorimetros)

        await AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(updatedHorimetros))

        console.log(`Horímetro para o bem ${operacaoParaRemover.bem} restaurado para ${valorAnterior}`)
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

  const removeDirecionador = useCallback((direcionadorId) => {
    setFormData((prev) => ({
      ...prev,
      direcionadores: prev.direcionadores.filter((id) => id !== direcionadorId),
      direcionador:
        prev.direcionador === direcionadorId
          ? prev.direcionadores.filter((id) => id !== direcionadorId)[0] || ""
          : prev.direcionador,
    }))

    setSelectedDirecionadores((prev) => prev.filter((d) => d.id !== direcionadorId))
  }, [])

  // NEW: Functions for multiple selection handling
  const toggleTempDirecionadorSelection = useCallback((direcionador) => {
    setTempSelectedDirecionadores((prev) => {
      const isSelected = prev.some((d) => d.id === direcionador.id)
      if (isSelected) {
        return prev.filter((d) => d.id !== direcionador.id)
      } else {
        return [...prev, direcionador]
      }
    })
  }, [])

  const toggleTempImplementoSelection = useCallback((implemento) => {
    setTempSelectedImplementos((prev) => {
      const isSelected = prev.some((i) => i.id === implemento.id)
      if (isSelected) {
        return prev.filter((i) => i.id !== implemento.id)
      } else {
        return [...prev, implemento]
      }
    })
  }, [])

  const confirmDirecionadorSelection = useCallback(() => {
    if (tempSelectedDirecionadores.length === 0) {
      Alert.alert("Atenção", "Selecione pelo menos um direcionador.")
      return
    }

    // Filter out already selected direcionadores to avoid duplicates
    const newDirecionadores = tempSelectedDirecionadores.filter(
      (tempDir) => !selectedDirecionadores.some((selectedDir) => selectedDir.id === tempDir.id),
    )

    if (newDirecionadores.length === 0) {
      Alert.alert("Atenção", "Todos os direcionadores selecionados já foram adicionados.")
      setTempSelectedDirecionadores([])
      setListModalVisible(false)
      return
    }

    // Add new direcionadores to the selected list
    setSelectedDirecionadores((prev) => [...prev, ...newDirecionadores])

    // Update form data
    setFormData((prev) => ({
      ...prev,
      direcionadores: [...prev.direcionadores, ...newDirecionadores.map((d) => d.id)],
      cultura:
        prev.direcionadores.length === 0 && newDirecionadores[0]?.culturaAssociada
          ? CULTURA?.find((c) => c.name.toLowerCase() === newDirecionadores[0].culturaAssociada.toLowerCase())?.id ||
            prev.cultura
          : prev.cultura,
    }))

    // Clear temporary selection and close modal
    setTempSelectedDirecionadores([])
    setListModalVisible(false)
  }, [tempSelectedDirecionadores, selectedDirecionadores])

  const confirmImplementoSelection = useCallback(() => {
    if (tempSelectedImplementos.length === 0) {
      Alert.alert("Atenção", "Selecione pelo menos um implemento.")
      return
    }

    // Filter out already selected implementos to avoid duplicates
    const newImplementos = tempSelectedImplementos.filter(
      (tempImpl) => !selectedImplementos.some((selectedImpl) => selectedImpl.id === tempImpl.id),
    )

    if (newImplementos.length === 0) {
      Alert.alert("Atenção", "Todos os implementos selecionados já foram adicionados.")
      setTempSelectedImplementos([])
      setListModalVisible(false)
      return
    }

    // Add new implementos to the selected list
    setSelectedImplementos((prev) => [...prev, ...newImplementos])

    // Update operacao mecanizada data
    setOperacaoMecanizadaData((prev) => ({
      ...prev,
      implementos: [...prev.implementos, ...newImplementos.map((i) => i.id)],
    }))

    // Clear temporary selection and close modal
    setTempSelectedImplementos([])
    setListModalVisible(false)
  }, [tempSelectedImplementos, selectedImplementos])

  // UPDATED: Enhanced form submission validation with detailed error messages
  const handleSubmit = useCallback(async () => {
    // Check all required fields and provide specific error messages
    const missingFields = []

    if (!formData.fichaControle || formData.fichaControle.trim() === "") {
      missingFields.push("Ficha de Controle")
    }

    if (!formData.data || formData.data.trim() === "") {
      missingFields.push("Data")
    }

    if (!Array.isArray(selectedDirecionadores) || selectedDirecionadores.length === 0) {
      missingFields.push("Direcionadores")
    }

    if (!formData.atividade || formData.atividade.trim() === "") {
      missingFields.push("Atividade")
    }

    if (!Array.isArray(selectedOperacoesMecanizadas) || selectedOperacoesMecanizadas.length === 0) {
      missingFields.push("Operações Mecanizadas")
    }

    if (missingFields.length > 0) {
      Alert.alert(
        "Campos Obrigatórios",
        `Os seguintes campos são obrigatórios e devem ser preenchidos:\n\n• ${missingFields.join("\n• ")}`,
      )
      return
    }

    if (isFormValid()) {
      try {
        const localId = Date.now().toString()

        // Verificar se selectedDirecionadores é um array
        const direcionadoresSelecionados = Array.isArray(selectedDirecionadores)
          ? selectedDirecionadores.map((d) => ({
              id: d.id,
              name: d.name,
              culturaAssociada: d.culturaAssociada,
            }))
          : []

        const primaryDirecionador = direcionadoresSelecionados.length > 0 ? direcionadoresSelecionados[0] : null

        let timestamp = Date.now()
        if (formData.data) {
          const [day, month, year] = formData.data.split("/")
          const dateObj = new Date(year, month - 1, day)
          timestamp = dateObj.getTime()
        }

        // Verificar se atividades é um array antes de usar find
        const selectedAtividade = Array.isArray(atividades) ? atividades.find((a) => a.id === formData.atividade) : null

        const apontamentoData = {
          ...formData,
          atividade: selectedAtividade?.name || formData.atividade,
          direcionador: primaryDirecionador?.name || formData.direcionador,
          direcionadores: direcionadoresSelecionados,
          cultura:
            primaryDirecionador?.culturaAssociada ||
            (Array.isArray(CULTURA) ? CULTURA.find((c) => c.id === formData.cultura)?.name : null) ||
            formData.cultura,
          timestamp: timestamp,
          operacoesMecanizadas: Array.isArray(selectedOperacoesMecanizadas)
            ? selectedOperacoesMecanizadas.map((op) => ({
                ...op,
                bem: Array.isArray(maquinarios) ? maquinarios.find((b) => b.id === op.bem)?.name || op.bem : op.bem,
              }))
            : [],
          userId: userId,
          propriedade: userPropriedade,
          localId: localId,
          status: "pending",
        }

        const netInfo = await NetInfo.fetch()
        if (netInfo.isConnected) {
          const sent = await sendDataToFirebase(apontamentoData)
          if (sent) {
            Alert.alert("Sucesso", "Dados enviados com sucesso!", [
              {
                text: "OK",
                onPress: () => {
                  resetForm()
                  if (navigation) {
                    navigation.navigate("Home")
                  }
                },
              },
            ])
          } else {
            Alert.alert("Atenção", "Este apontamento já foi enviado anteriormente.")
          }
        } else {
          const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            await saveOfflineData(apontamentoData)
            Alert.alert("Modo Offline", "Dados salvos localmente e serão sincronizados quando houver conexão.", [
              {
                text: "OK",
                onPress: () => {
                  resetForm()
                  if (navigation) {
                    navigation.navigate("Home")
                  }
                },
              },
            ])
          } else {
            Alert.alert("Atenção", "Este apontamento já foi salvo localmente.")
          }
        }
      } catch (error) {
        console.error("Error submitting form:", error)
        Alert.alert("Erro", "Ocorreu um erro ao enviar os dados. Os dados foram salvos localmente.")

        try {
          const localId = Date.now().toString()
          const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            const direcionadoresSelecionados = Array.isArray(selectedDirecionadores)
              ? selectedDirecionadores.map((d) => ({
                  id: d.id,
                  name: d.name,
                  culturaAssociada: d.culturaAssociada,
                }))
              : []

            const primaryDirecionador = direcionadoresSelecionados.length > 0 ? direcionadoresSelecionados[0] : null

            let timestamp = Date.now()
            if (formData.data) {
              const [day, month, year] = formData.data.split("/")
              const dateObj = new Date(year, month - 1, day)
              timestamp = dateObj.getTime()
            }

            const selectedAtividade = Array.isArray(atividades)
              ? atividades.find((a) => a.id === formData.atividade)
              : null

            const apontamentoData = {
              ...formData,
              atividade: selectedAtividade?.name || formData.atividade,
              direcionador: primaryDirecionador?.name || formData.direcionador,
              direcionadores: direcionadoresSelecionados,
              cultura:
                primaryDirecionador?.culturaAssociada ||
                (Array.isArray(CULTURA) ? CULTURA.find((c) => c.id === formData.cultura)?.name : null) ||
                formData.cultura,
              timestamp: timestamp,
              operacoesMecanizadas: Array.isArray(selectedOperacoesMecanizadas)
                ? selectedOperacoesMecanizadas.map((op) => ({
                    ...op,
                    bem: Array.isArray(maquinarios) ? maquinarios.find((b) => b.id === op.bem)?.name || op.bem : op.bem,
                  }))
                : [],
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
    }
  }, [
    formData,
    userId,
    userPropriedade,
    sendDataToFirebase,
    isFormValid,
    resetForm,
    selectedOperacoesMecanizadas,
    direcionadores,
    maquinarios,
    selectedDirecionadores,
    navigation,
    atividades,
  ])

  // UPDATED: Enhanced renderListItem to handle multiple selection
  const renderListItem = useCallback(
    ({ item }) => {
      const isMultipleSelection = listModalType === "direcionador" || listModalType === "implemento"

      if (isMultipleSelection) {
        const isSelected =
          listModalType === "direcionador"
            ? tempSelectedDirecionadores.some((d) => d.id === item.id)
            : tempSelectedImplementos.some((i) => i.id === item.id)

        const isAlreadyAdded =
          listModalType === "direcionador"
            ? selectedDirecionadores.some((d) => d.id === item.id)
            : selectedImplementos.some((i) => i.id === item.id)

        return (
          <TouchableOpacity
            style={[
              styles.listItem,
              isSelected && styles.selectedListItem,
              isAlreadyAdded && styles.alreadyAddedListItem,
            ]}
            onPress={() => {
              if (isAlreadyAdded) {
                Alert.alert(
                  "Atenção",
                  `Este ${listModalType === "direcionador" ? "direcionador" : "implemento"} já foi adicionado.`,
                )
                return
              }

              if (listModalType === "direcionador") {
                toggleTempDirecionadorSelection(item)
              } else {
                toggleTempImplementoSelection(item)
              }
            }}
            disabled={isAlreadyAdded}
          >
            <View style={styles.listItemContent}>
              <View style={styles.listItemText}>
                <Text style={[styles.listItemName, isAlreadyAdded && styles.alreadyAddedText]}>{item.name}</Text>
                {item.culturaAssociada && <Text style={styles.listItemSubtitle}>Cultura: {item.culturaAssociada}</Text>}
                {isAlreadyAdded && <Text style={styles.alreadyAddedLabel}>Já adicionado</Text>}
              </View>
              <View style={styles.checkboxContainer}>
                {isSelected && !isAlreadyAdded && (
                  <View style={styles.checkbox}>
                    <Check size={16} color="#FFFFFF" />
                  </View>
                )}
                {!isSelected && !isAlreadyAdded && <View style={styles.checkboxEmpty} />}
              </View>
            </View>
          </TouchableOpacity>
        )
      }

      // Single selection for other types
      return (
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => {
            if (listModalType === "atividade") {
              handleChange(listModalType, item.id)
            } else if (listModalType === "produto" || listModalType === "tanqueDiesel") {
              handleOperacaoMecanizadaChange(listModalType, item.id)
            } else if (listModalType === "bem") {
              handleOperacaoMecanizadaChange(listModalType, item.id)
              setSelectedImplementos([])
              setOperacaoMecanizadaData((prev) => ({
                ...prev,
                implemento: "",
                implementos: [],
              }))
            }
            setListModalVisible(false)
          }}
        >
          <Text>{item.name}</Text>
        </TouchableOpacity>
      )
    },
    [
      listModalType,
      handleChange,
      handleOperacaoMecanizadaChange,
      tempSelectedDirecionadores,
      tempSelectedImplementos,
      selectedDirecionadores,
      selectedImplementos,
      toggleTempDirecionadorSelection,
      toggleTempImplementoSelection,
    ],
  )

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
        {Array.isArray(items) &&
          items.map((item) => (
            <View key={item.id} style={styles.selectedItem}>
              <Text>
                {type === "produto"
                  ? `${Array.isArray(PRODUTOS) ? PRODUTOS.find((p) => p.id === item.produto)?.name : ""} - ${Array.isArray(TANQUEDIESEL) ? TANQUEDIESEL.find((t) => t.id === item.tanqueDiesel)?.name || "" : ""}`
                  : Array.isArray(PRODUTOS)
                    ? PRODUTOS.find((p) => p.id === item.produto)?.name
                    : ""}
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

  // UPDATED: Modified to handle multiple selection initialization
  const openListModal = useCallback(
    (type) => {
      setListModalType(type)

      if (type === "direcionador") {
        setListModalData(Array.isArray(direcionadores) ? direcionadores : [])
        setTempSelectedDirecionadores([]) // Reset temporary selection
      } else if (type === "bem") {
        setListModalData(Array.isArray(maquinarios) ? maquinarios : [])
      } else if (type === "implemento") {
        setListModalData(Array.isArray(implementos) ? implementos : [])
        setTempSelectedImplementos([]) // Reset temporary selection
      } else if (type === "atividade") {
        setListModalData(Array.isArray(atividades) ? atividades : [])
      } else {
        setListModalData(
          type === "produto"
            ? Array.isArray(PRODUTOS)
              ? PRODUTOS
              : []
            : Array.isArray(TANQUEDIESEL)
              ? TANQUEDIESEL
              : [],
        )
      }

      setSearchQuery("")
      setListModalVisible(true)
    },
    [direcionadores, maquinarios, implementos, atividades],
  )

  const filteredListData = useMemo(() => {
    if (!searchQuery || !Array.isArray(listModalData)) return listModalData
    return listModalData.filter((item) => item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  // UPDATED: Enhanced renderListModal with multiple selection support
  const renderListModal = useCallback(() => {
    const isMultipleSelection = listModalType === "direcionador" || listModalType === "implemento"
    const selectedCount =
      listModalType === "direcionador"
        ? tempSelectedDirecionadores.length
        : listModalType === "implemento"
          ? tempSelectedImplementos.length
          : 0

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
                      ? "os Direcionadores"
                      : listModalType === "bem"
                        ? "o Bem"
                        : listModalType === "implemento"
                          ? "os Implementos"
                          : "a Atividade"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (isMultipleSelection) {
                    setTempSelectedDirecionadores([])
                    setTempSelectedImplementos([])
                  }
                  setListModalVisible(false)
                }}
                style={[styles.closeButton, { position: "absolute", right: 0 }]}
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {isMultipleSelection && selectedCount > 0 && (
              <View style={styles.selectionCounter}>
                <Text style={styles.selectionCounterText}>
                  {selectedCount} {listModalType === "direcionador" ? "direcionador(es)" : "implemento(s)"}{" "}
                  selecionado(s)
                </Text>
              </View>
            )}

            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              style={styles.flatList}
              data={Array.isArray(filteredListData) ? filteredListData : []}
              renderItem={renderListItem}
              keyExtractor={(item, index) => `${listModalType}-${item.id}-${index}`}
              ItemSeparatorComponent={Separator}
              showsVerticalScrollIndicator={false}
            />

            {isMultipleSelection && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.confirmButton, selectedCount === 0 && styles.disabledButton]}
                  onPress={listModalType === "direcionador" ? confirmDirecionadorSelection : confirmImplementoSelection}
                  disabled={selectedCount === 0}
                >
                  <Text style={styles.confirmButtonText}>
                    Confirmar Seleção {selectedCount > 0 && `(${selectedCount})`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    )
  }, [
    isListModalVisible,
    listModalType,
    filteredListData,
    renderListItem,
    searchQuery,
    Separator,
    tempSelectedDirecionadores,
    tempSelectedImplementos,
    confirmDirecionadorSelection,
    confirmImplementoSelection,
  ])

  if (!isAuthInitialized || isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2a9d8f" />
        <Text>Carregando...</Text>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
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
        {renderInputField(
          "Ficha de Controle (número da máquina) *",
          "fichaControle",
          formData.fichaControle,
          handleChange,
        )}
        <Separator />
        {renderDatePickerField("Data *", "data")}
        <Separator />
        <Text style={styles.label}>Direcionadores *</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("direcionador")}
          accessibilityLabel="Selecionar Direcionador"
        >
          <Text>
            {Array.isArray(selectedDirecionadores) && selectedDirecionadores.length > 0
              ? `${selectedDirecionadores.length} direcionador(es) selecionado(s)`
              : "Selecione um ou mais direcionadores"}
          </Text>
          <ChevronDown size={20} color="#2a9d8f" />
        </TouchableOpacity>

        {Array.isArray(selectedDirecionadores) && selectedDirecionadores.length > 0 && (
          <View style={styles.selectedDirecionadoresContainer}>
            {selectedDirecionadores.map((direcionador) => (
              <View key={direcionador.id} style={styles.selectedItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedItemTitle}>{direcionador.name}</Text>
                  {direcionador.culturaAssociada && (
                    <Text style={styles.selectedItemSubtitle}>Cultura: {direcionador.culturaAssociada}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => removeDirecionador(direcionador.id)}>
                  <Trash2 size={20} color="#FF0000" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Separator />
        <Text style={styles.label}>Cultura</Text>
        <View style={[styles.input, styles.disabledInput]}>
          <Text>
            {Array.isArray(selectedDirecionadores) && selectedDirecionadores.length > 0
              ? (() => {
                  const culturas = selectedDirecionadores
                    .map((d) => d.culturaAssociada)
                    .filter((cultura) => cultura && cultura.trim() !== "")

                  const culturasUnicas = [...new Set(culturas)]

                  return culturasUnicas.length > 0 ? culturasUnicas.join(", ") : "Não definida"
                })()
              : "Será definida pelo direcionador"}
          </Text>
        </View>
        <Separator />
        <Text style={styles.label}>Atividade *</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("atividade")}
          accessibilityLabel="Selecionar Atividade"
        >
          <Text>
            {Array.isArray(atividades)
              ? atividades.find((a) => a.id === formData.atividade)?.name || "Selecione a Atividade"
              : "Selecione a Atividade"}
          </Text>
          <ChevronDown size={20} color="#2a9d8f" />
        </TouchableOpacity>
        <Separator />
        <TouchableOpacity
          style={styles.modalButton}
          onPress={() => setOperacaoMecanizadaModalVisible(true)}
          accessibilityLabel="Lançar Operações Mecanizadas"
          accessibilityHint="Toque para abrir o formulário de lançamento de operações mecanizadas"
        >
          <Text style={styles.buttonText}>
            {Array.isArray(selectedOperacoesMecanizadas) && selectedOperacoesMecanizadas.length > 0
              ? `${selectedOperacoesMecanizadas.length} operação(ões) adicionada(s)`
              : "Lançar Operações Mecanizadas"}
          </Text>
        </TouchableOpacity>

        {Array.isArray(selectedOperacoesMecanizadas) && selectedOperacoesMecanizadas.length > 0 && (
          <View style={styles.totalHoursIndicator}>
            <Text
              style={[
                styles.totalHoursText,
                calculateTotalHours() > 10 ? styles.totalHoursExceeded : styles.totalHoursNormal,
              ]}
            >
              {calculateTotalHours() > 10
                ? "Limite excedido"
                : `Total de Horas: ${calculateTotalHours().toFixed(2)}/10.00h`}
            </Text>
          </View>
        )}

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
            <Text>
              {Array.isArray(maquinarios)
                ? maquinarios.find((b) => b.id === operacaoMecanizadaData.bem)?.name || "Selecione o Bem"
                : "Selecione o Bem"}
            </Text>
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

          <Text style={styles.label}>Implementos</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => openListModal("implemento")}
            accessibilityLabel="Selecionar Implemento"
          >
            <Text>
              {Array.isArray(selectedImplementos) && selectedImplementos.length > 0
                ? `${selectedImplementos.length} implemento(s) selecionado(s)`
                : "Selecione um ou mais implementos"}
            </Text>
            <ChevronDown size={20} color="#2a9d8f" />
          </TouchableOpacity>

          {Array.isArray(selectedImplementos) && selectedImplementos.length > 0 && (
            <View style={styles.selectedImplementosContainer}>
              {selectedImplementos.map((implemento) => (
                <View key={implemento.id} style={styles.selectedItem}>
                  <Text style={styles.selectedItemTitle}>{implemento.name}</Text>
                  <TouchableOpacity onPress={() => removeImplemento(implemento.id)}>
                    <Trash2 size={20} color="#FF0000" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

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

          {Array.isArray(selectedOperacoesMecanizadas) && selectedOperacoesMecanizadas.length > 0 && (
            <View style={styles.selectedItemsContainer}>
              <Text style={[styles.label, { marginTop: 16 }]}>Operações Adicionadas:</Text>
              {selectedOperacoesMecanizadas.map((item) => (
                <View key={item.id} style={styles.selectedItem}>
                  <View>
                    <Text style={styles.selectedItemTitle}>
                      {Array.isArray(maquinarios)
                        ? maquinarios.find((b) => b.id === item.bem)?.name || item.bem
                        : item.bem}
                    </Text>
                    <Text style={styles.selectedItemSubtitle}>
                      Implementos:{" "}
                      {item.implementos && Array.isArray(item.implementos)
                        ? item.implementos.map((imp) => imp.name).join(", ")
                        : Array.isArray(implementos)
                          ? implementos.find((i) => i.id === item.implemento)?.name || ""
                          : ""}
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
                !Array.isArray(selectedImplementos) ||
                selectedImplementos.length === 0 ||
                !operacaoMecanizadaData.horaFinal ||
                Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                  Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00") ||
                (() => {
                  const horaAnterior = Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")
                  const horaAtual = Number.parseFloat(operacaoMecanizadaData.horaFinal || "0")
                  const horasOperacao = horaAtual > horaAnterior ? horaAtual - horaAnterior : 0
                  const totalAtual = calculateTotalHours()
                  const novoTotal = totalAtual + horasOperacao
                  return novoTotal > 10
                })()) &&
                styles.disabledButton,
            ]}
            onPress={() => {
              if (
                operacaoMecanizadaData.bem &&
                Array.isArray(selectedImplementos) &&
                selectedImplementos.length > 0 &&
                operacaoMecanizadaData.horaFinal
              ) {
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
              } else if (!Array.isArray(selectedImplementos) || selectedImplementos.length === 0) {
                Alert.alert("Atenção", "Selecione pelo menos um implemento.")
              }
            }}
            disabled={
              !operacaoMecanizadaData.bem ||
              !Array.isArray(selectedImplementos) ||
              selectedImplementos.length === 0 ||
              !operacaoMecanizadaData.horaFinal ||
              Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00") ||
              (() => {
                const horaAnterior = Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")
                const horaAtual = Number.parseFloat(operacaoMecanizadaData.horaFinal || "0")
                const horasOperacao = horaAtual > horaAnterior ? horaAtual - horaAnterior : 0
                const totalAtual = calculateTotalHours()
                const novoTotal = totalAtual + horasOperacao
                return novoTotal > 10
              })()
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
  selectedListItem: {
    backgroundColor: "#E8F5F3",
    borderColor: "#2a9d8f",
    borderWidth: 1,
  },
  alreadyAddedListItem: {
    backgroundColor: "#F5F5F5",
    opacity: 0.6,
  },
  listItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listItemText: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    color: "#333333",
  },
  listItemSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 4,
  },
  alreadyAddedText: {
    color: "#999999",
  },
  alreadyAddedLabel: {
    fontSize: 12,
    color: "#999999",
    fontStyle: "italic",
    marginTop: 2,
  },
  checkboxContainer: {
    marginLeft: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#2a9d8f",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#2a9d8f",
    backgroundColor: "transparent",
  },
  selectionCounter: {
    backgroundColor: "#E8F5F3",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  selectionCounterText: {
    color: "#2a9d8f",
    fontSize: 14,
    fontWeight: "600",
  },
  modalFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  confirmButton: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
  selectedDirecionadoresContainer: {
    marginBottom: 16,
  },
  selectedImplementosContainer: {
    marginBottom: 16,
  },
  totalHoursIndicator: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2a9d8f",
  },
  totalHoursText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  totalHoursNormal: {
    color: "#2a9d8f",
  },
  totalHoursExceeded: {
    color: "#e74c3c",
  },
  limitWarning: {
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#f8f9fa",
  },
  warningTextNormal: {
    color: "#27ae60",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  warningTextAlert: {
    color: "#f39c12",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  warningTextError: {
    color: "#e74c3c",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
})
