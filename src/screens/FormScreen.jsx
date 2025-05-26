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
import { X, Trash2, ChevronDown } from "lucide-react-native"
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
  direcionador: "", // Mantido para compatibilidade
  direcionadores: [], // Novo array para armazenar múltiplos direcionadores
  cultura: "",
  atividade: "",
  observacao: "",
}

export default function FormScreen({ navigation }) {
  const [formData, setFormData] = useState(initialFormData)
  const [operacaoMecanizadaModalVisible, setOperacaoMecanizadaModalVisible] = useState(false)
  const [operacaoMecanizadaData, setOperacaoMecanizadaData] = useState({
    bem: "",
    implemento: "", // Mantido para compatibilidade
    implementos: [], // Novo array para múltiplos implementos
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
  // Estado para armazenar a lista de direcionadores do Firebase
  const [direcionadores, setDirecionadores] = useState([])
  // Novos estados para armazenar maquinários e implementos do Firebase
  const [maquinarios, setMaquinarios] = useState([])
  const [implementos, setImplementos] = useState([])
  // Novo estado para controlar o número da ficha de controle
  const [fichaControleNumero, setFichaControleNumero] = useState(40000)
  // Adicionar um novo estado para armazenar os direcionadores selecionados
  const [selectedDirecionadores, setSelectedDirecionadores] = useState([])
  // Novo estado para armazenar os implementos selecionados na operação mecanizada atual
  const [selectedImplementos, setSelectedImplementos] = useState([])
  // Novo estado para armazenar as atividades do Firebase
  const [atividades, setAtividades] = useState([])

  const isMounted = useRef(true)

  const isFormValid = useCallback(() => {
    const requiredFields = ["fichaControle", "data", "atividade"]
    return requiredFields.every((field) => formData[field] && formData[field].trim() !== "")
  }, [formData])

  // Modificar o resetForm para limpar também os direcionadores
  const resetForm = useCallback(() => {
    // Incrementar o número da ficha de controle ao resetar o formulário
    const novoNumero = fichaControleNumero + 1
    setFichaControleNumero(novoNumero)

    // Salvar o novo número no AsyncStorage
    AsyncStorage.setItem(FICHA_CONTROLE_KEY, novoNumero.toString()).catch((error) =>
      console.error("Erro ao salvar número da ficha:", error),
    )

    // Resetar o formulário sem preencher automaticamente a ficha de controle
    setFormData(initialFormData)
    setSelectedDirecionadores([]) // Limpar direcionadores selecionados

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

  // Carregar o último número da ficha de controle do AsyncStorage
  useEffect(() => {
    const carregarNumeroFicha = async () => {
      try {
        const numeroSalvo = await AsyncStorage.getItem(FICHA_CONTROLE_KEY)
        if (numeroSalvo) {
          const numero = Number.parseInt(numeroSalvo, 10)
          // Apenas armazenar o último número usado, sem preencher o campo
          setFichaControleNumero(numero)
        } else {
          // Se não existir número salvo, definir o padrão 40000 apenas para controle interno
          setFichaControleNumero(40000)
        }
      } catch (error) {
        console.error("Erro ao carregar número da ficha:", error)
        // Em caso de erro, definir o padrão 40000 apenas para controle interno
        setFichaControleNumero(40000)
      }
    }

    carregarNumeroFicha()
  }, [])

  // Novo useEffect para buscar atividades do Firebase
  useEffect(() => {
    if (!userPropriedade) return

    const loadAtividadesFromFirebase = () => {
      try {
        const atividadesRef = ref(database, `propriedades/${userPropriedade}/atividades`)

        // Configurar listener para atualizações em tempo real
        const unsubscribe = onValue(
          atividadesRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}

              // Transformar os dados do Firebase em um array no formato esperado pelo componente
              const atividadesArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: value.atividade || "Atividade sem nome",
              }))

              setAtividades(atividadesArray)

              // Salvar atividades no cache para uso offline
              AsyncStorage.setItem(CACHED_ATIVIDADES_KEY, JSON.stringify(atividadesArray)).catch((error) =>
                console.error("Erro ao salvar atividades no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar atividades do Firebase:", error)

            // Em caso de erro, tentar carregar do cache
            loadCachedAtividades()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para atividades:", error)

        // Em caso de erro, tentar carregar do cache
        loadCachedAtividades()
      }
    }

    // Função para carregar atividades do cache
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

  // useEffect para buscar direcionadores do Firebase
  useEffect(() => {
    if (!userPropriedade) return

    const loadDirecionadoresFromFirebase = () => {
      try {
        const direcionadoresRef = ref(database, `propriedades/${userPropriedade}/direcionadores`)

        // Configurar listener para atualizações em tempo real
        const unsubscribe = onValue(
          direcionadoresRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}

              // Transformar os dados do Firebase em um array no formato esperado pelo componente
              const direcionadoresArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: value.direcionador || "Direcionador sem nome",
                culturaAssociada: value.culturaAssociada || "",
              }))

              setDirecionadores(direcionadoresArray)

              // Salvar direcionadores no cache para uso offline
              AsyncStorage.setItem(CACHED_DIRECIONADORES_KEY, JSON.stringify(direcionadoresArray)).catch((error) =>
                console.error("Erro ao salvar direcionadores no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar direcionadores do Firebase:", error)

            // Em caso de erro, tentar carregar do cache
            loadCachedDirecionadores()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para direcionadores:", error)

        // Em caso de erro, tentar carregar do cache
        loadCachedDirecionadores()
      }
    }

    // Função para carregar direcionadores do cache
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

  // Novo useEffect para buscar maquinários do Firebase
  useEffect(() => {
    if (!userPropriedade) return

    const loadMaquinariosFromFirebase = () => {
      try {
        const maquinariosRef = ref(database, `propriedades/${userPropriedade}/maquinarios`)

        // Configurar listener para atualizações em tempo real
        const unsubscribe = onValue(
          maquinariosRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}

              // Transformar os dados do Firebase em um array no formato esperado pelo componente
              const maquinariosArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: `${value.id} - ${value.nome}`, // Formato "ID - NOME"
                rawName: value.nome || "Máquina sem nome", // Manter o nome original para uso posterior
              }))

              setMaquinarios(maquinariosArray)

              // Salvar maquinários no cache para uso offline
              AsyncStorage.setItem(CACHED_MAQUINARIOS_KEY, JSON.stringify(maquinariosArray)).catch((error) =>
                console.error("Erro ao salvar maquinários no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar maquinários do Firebase:", error)

            // Em caso de erro, tentar carregar do cache
            loadCachedMaquinarios()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para maquinários:", error)

        // Em caso de erro, tentar carregar do cache
        loadCachedMaquinarios()
      }
    }

    // Função para carregar maquinários do cache
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

  // Novo useEffect para buscar implementos do Firebase
  useEffect(() => {
    if (!userPropriedade) return

    const loadImplementosFromFirebase = () => {
      try {
        const implementosRef = ref(database, `propriedades/${userPropriedade}/implementos`)

        // Configurar listener para atualizações em tempo real
        const unsubscribe = onValue(
          implementosRef,
          (snapshot) => {
            if (isMounted.current) {
              const data = snapshot.val() || {}

              // Transformar os dados do Firebase em um array no formato esperado pelo componente
              const implementosArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: `${value.id} - ${value.nome}`, // Formato "ID - NOME"
                rawName: value.nome || "Implemento sem nome", // Manter o nome original para uso posterior
              }))

              setImplementos(implementosArray)

              // Salvar implementos no cache para uso offline
              AsyncStorage.setItem(CACHED_IMPLEMENTOS_KEY, JSON.stringify(implementosArray)).catch((error) =>
                console.error("Erro ao salvar implementos no cache:", error),
              )
            }
          },
          (error) => {
            console.error("Erro ao carregar implementos do Firebase:", error)

            // Em caso de erro, tentar carregar do cache
            loadCachedImplementos()
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Erro ao configurar listener para implementos:", error)

        // Em caso de erro, tentar carregar do cache
        loadCachedImplementos()
      }
    }

    // Função para carregar implementos do cache
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

              // Salvar horímetros no cache para uso offline
              AsyncStorage.setItem(PREVIOUS_HORIMETROS_KEY, JSON.stringify(data)).catch((error) =>
                console.error("Erro ao salvar horímetros no cache:", error),
              )

              // Também salvar na chave padrão do offlineManager
              AsyncStorage.setItem(CACHED_HORIMETROS_KEY, JSON.stringify(data)).catch((error) =>
                console.error("Erro ao salvar horímetros no cache padrão:", error),
              )

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
        // Tentar carregar primeiro da chave específica
        const storedHorimetros = await AsyncStorage.getItem(PREVIOUS_HORIMETROS_KEY)
        if (storedHorimetros) {
          setPreviousHorimetros(JSON.parse(storedHorimetros))
          return
        }

        // Se não encontrar, tentar da chave padrão do offlineManager
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

        // Verificar conectividade
        const netInfo = await NetInfo.fetch()
        if (!netInfo.isConnected) {
          // Se estiver offline, carregar dados do cache
          loadCachedData()
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }
    loadUserData()

    return () => unsubscribeAuth()
  }, [])

  // Função para carregar todos os dados do cache quando offline
  const loadCachedData = async () => {
    try {
      // Carregar maquinários
      const cachedMaquinarios = await AsyncStorage.getItem(CACHED_MAQUINARIOS_KEY)
      if (cachedMaquinarios) {
        setMaquinarios(JSON.parse(cachedMaquinarios))
        console.log("Maquinários carregados do cache")
      }

      // Carregar implementos
      const cachedImplementos = await AsyncStorage.getItem(CACHED_IMPLEMENTOS_KEY)
      if (cachedImplementos) {
        setImplementos(JSON.parse(cachedImplementos))
        console.log("Implementos carregados do cache")
      }

      // Carregar direcionadores
      const cachedDirecionadores = await AsyncStorage.getItem(CACHED_DIRECIONADORES_KEY)
      if (cachedDirecionadores) {
        setDirecionadores(JSON.parse(cachedDirecionadores))
        console.log("Direcionadores carregados do cache")
      }

      // Carregar atividades
      const cachedAtividades = await AsyncStorage.getItem(CACHED_ATIVIDADES_KEY)
      if (cachedAtividades) {
        setAtividades(JSON.parse(cachedAtividades))
        console.log("Atividades carregadas do cache")
      }

      // Carregar horímetros
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

    // Não precisamos mais buscar bens-implementos, pois agora estamos buscando diretamente do Firebase
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

  // Modificar a função handleChange para o caso do direcionador
  const handleChange = useCallback(
    (name, value) => {
      if (name === "direcionador") {
        // Buscar o direcionador selecionado na lista do Firebase
        const selectedDirecionador = direcionadores.find((d) => d.id === value)

        // Verificar se o direcionador já está selecionado
        const isDirecionadorAlreadySelected = selectedDirecionadores.some((d) => d.id === value)

        if (!isDirecionadorAlreadySelected && selectedDirecionador) {
          // Adicionar à lista de direcionadores selecionados
          setSelectedDirecionadores((prev) => [...prev, selectedDirecionador])

          // Atualizar o formData
          return setFormData((prev) => ({
            ...prev,
            direcionador: value, // Manter para compatibilidade
            direcionadores: [...prev.direcionadores, value], // Adicionar ao array
            // Se for o primeiro direcionador, usar sua cultura associada
            cultura:
              prev.direcionadores.length === 0 && selectedDirecionador.culturaAssociada
                ? CULTURA.find((c) => c.name.toLowerCase() === selectedDirecionador.culturaAssociada.toLowerCase())
                    ?.id || prev.cultura
                : prev.cultura,
          }))
        }

        return // Se já estiver selecionado, não faz nada
      }

      // Se for o campo fichaControle e for um número válido, atualizar o estado fichaControleNumero
      if (name === "fichaControle" && !isNaN(Number.parseInt(value, 10))) {
        setFichaControleNumero(Number.parseInt(value, 10))
      }

      return setFormData((prev) => ({ ...prev, [name]: value }))
    },
    [direcionadores, selectedDirecionadores],
  )

  // Modificar a função handleOperacaoMecanizadaChange para o caso do implemento
  const handleOperacaoMecanizadaChange = useCallback(
    (name, value) => {
      if (name === "implemento") {
        // Buscar o implemento selecionado
        const selectedImplemento = implementos.find((i) => i.id === value)

        // Verificar se o implemento já está selecionado
        const isImplementoAlreadySelected = selectedImplementos.some((i) => i.id === value)

        if (!isImplementoAlreadySelected && selectedImplemento) {
          // Adicionar à lista de implementos selecionados
          setSelectedImplementos((prev) => [...prev, selectedImplemento])

          // Atualizar o operacaoMecanizadaData
          setOperacaoMecanizadaData((prev) => ({
            ...prev,
            implemento: value, // Manter para compatibilidade
            implementos: [...prev.implementos, value], // Adicionar ao array
          }))
        }
        return
      }

      setOperacaoMecanizadaData((prev) => {
        // Se o campo alterado for "bem", resetamos o horaFinal
        if (name === "bem") {
          return { ...prev, [name]: value, horaFinal: "" }
        }

        // Não validamos mais aqui, apenas atualizamos o valor
        return { ...prev, [name]: value }
      })
    },
    [implementos, selectedImplementos],
  )

  // Adicionar função para remover um implemento
  const removeImplemento = useCallback((implementoId) => {
    // Remover do array de IDs no operacaoMecanizadaData
    setOperacaoMecanizadaData((prev) => ({
      ...prev,
      implementos: prev.implementos.filter((id) => id !== implementoId),
      // Se for o implemento principal, atualizar para o próximo da lista ou vazio
      implemento:
        prev.implemento === implementoId
          ? prev.implementos.filter((id) => id !== implementoId)[0] || ""
          : prev.implemento,
    }))

    // Remover da lista de objetos selecionados
    setSelectedImplementos((prev) => prev.filter((i) => i.id !== implementoId))
  }, [])

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

  // Modificar a função addSelectedOperacaoMecanizada para incluir múltiplos implementos
  const addSelectedOperacaoMecanizada = useCallback(
    async (operacao) => {
      // Verificar se há pelo menos um implemento selecionado
      if (selectedImplementos.length === 0) {
        Alert.alert("Atenção", "Selecione pelo menos um implemento.")
        return
      }

      // Obter o horímetro anterior para este bem
      const horaInicial = previousHorimetros[operacao.bem] || "0.00"

      // Calcular total de horas
      const horaFinal = Number.parseFloat(operacao.horaFinal) || 0
      const horaInicialNum = Number.parseFloat(horaInicial) || 0
      const totalHoras = horaFinal > horaInicialNum ? (horaFinal - horaInicialNum).toFixed(2) : "0.00"

      // Adicionar à lista de operações selecionadas com todos os implementos
      setSelectedOperacoesMecanizadas((prev) => [
        ...prev,
        {
          ...operacao,
          id: Date.now(),
          horaInicial,
          totalHoras,
          // Incluir todos os implementos selecionados
          implementos: selectedImplementos.map((i) => ({
            id: i.id,
            name: i.name,
          })),
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
        implementos: [],
        horaFinal: "",
      })
      setSelectedImplementos([])
    },
    [previousHorimetros, userPropriedade, selectedImplementos],
  )

  // Modificar a função removeSelectedOperacaoMecanizada para sempre restaurar o valor anterior
  // em vez de excluir completamente o registro quando não há outras operações

  // Localizar a função removeSelectedOperacaoMecanizada e substituí-la pela versão abaixo:

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

        // Referência para o nó específico do horímetro no Firebase
        const horimetroRef = ref(database, `propriedades/${userPropriedade}/horimetros/${operacaoParaRemover.bem}`)

        // Sempre restaurar o valor anterior, independentemente de haver outras operações
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

  // Adicionar função para remover um direcionador
  const removeDirecionador = useCallback((direcionadorId) => {
    // Remover do array de IDs no formData
    setFormData((prev) => ({
      ...prev,
      direcionadores: prev.direcionadores.filter((id) => id !== direcionadorId),
      // Se for o direcionador principal, atualizar para o próximo da lista ou vazio
      direcionador:
        prev.direcionador === direcionadorId
          ? prev.direcionadores.filter((id) => id !== direcionadorId)[0] || ""
          : prev.direcionador,
    }))

    // Remover da lista de objetos selecionados
    setSelectedDirecionadores((prev) => prev.filter((d) => d.id !== direcionadorId))
  }, [])

  // Modificar o handleSubmit para incluir todos os direcionadores e usar atividades do Firebase
  const handleSubmit = useCallback(async () => {
    if (isFormValid()) {
      try {
        const localId = Date.now().toString()

        // Obter todos os direcionadores selecionados
        const direcionadoresSelecionados = selectedDirecionadores.map((d) => ({
          id: d.id,
          name: d.name,
          culturaAssociada: d.culturaAssociada,
        }))

        // Usar o primeiro direcionador como principal para compatibilidade
        const primaryDirecionador = direcionadoresSelecionados.length > 0 ? direcionadoresSelecionados[0] : null

        // Converter a data do formato DD/MM/YYYY para um timestamp
        let timestamp = Date.now()
        if (formData.data) {
          const [day, month, year] = formData.data.split("/")
          const dateObj = new Date(year, month - 1, day)
          timestamp = dateObj.getTime()
        }

        // Buscar a atividade selecionada do Firebase
        const selectedAtividade = atividades.find((a) => a.id === formData.atividade)

        // Preparar os dados do apontamento
        const apontamentoData = {
          ...formData,
          // Usar o nome da atividade do Firebase
          atividade: selectedAtividade?.name || formData.atividade,
          // Usar o nome do direcionador principal do Firebase para compatibilidade
          direcionador: primaryDirecionador?.name || formData.direcionador,
          // Incluir todos os direcionadores selecionados
          direcionadores: direcionadoresSelecionados,
          // Usar a culturaAssociada do direcionador principal selecionado
          cultura:
            primaryDirecionador?.culturaAssociada ||
            CULTURA.find((c) => c.id === formData.cultura)?.name ||
            formData.cultura,
          timestamp: timestamp,
          operacoesMecanizadas: selectedOperacoesMecanizadas.map((op) => ({
            ...op,
            // Usar os nomes dos maquinários do Firebase
            bem: maquinarios.find((b) => b.id === op.bem)?.name || op.bem,
            // Manter os implementos como estão, pois já estão no formato correto
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
            Alert.alert("Sucesso", "Dados enviados com sucesso!", [
              {
                text: "OK",
                onPress: () => {
                  resetForm()
                  // Navegar para a HomeScreen após o envio bem-sucedido
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
          // Check if we already have this localId saved offline
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
                  // Navegar para a HomeScreen mesmo no modo offline
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
          // Check if we already have this localId saved offline before saving
          const localId = Date.now().toString()
          const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
          const offlineData = existingData ? JSON.parse(existingData) : []
          const isDuplicate = offlineData.some((item) => item.localId === localId)

          if (!isDuplicate) {
            // Obter todos os direcionadores selecionados
            const direcionadoresSelecionados = selectedDirecionadores.map((d) => ({
              id: d.id,
              name: d.name,
              culturaAssociada: d.culturaAssociada,
            }))

            // Usar o primeiro direcionador como principal para compatibilidade
            const primaryDirecionador = direcionadoresSelecionados.length > 0 ? direcionadoresSelecionados[0] : null

            // Converter a data do formato DD/MM/YYYY para um timestamp
            let timestamp = Date.now()
            if (formData.data) {
              const [day, month, year] = formData.data.split("/")
              const dateObj = new Date(year, month - 1, day)
              timestamp = dateObj.getTime()
            }

            // Buscar a atividade selecionada do Firebase
            const selectedAtividade = atividades.find((a) => a.id === formData.atividade)

            const apontamentoData = {
              ...formData,
              // Usar o nome da atividade do Firebase
              atividade: selectedAtividade?.name || formData.atividade,
              // Usar o nome do direcionador principal do Firebase
              direcionador: primaryDirecionador?.name || formData.direcionador,
              // Incluir todos os direcionadores selecionados
              direcionadores: direcionadoresSelecionados,
              // Usar a culturaAssociada do direcionador principal selecionado
              cultura:
                primaryDirecionador?.culturaAssociada ||
                CULTURA.find((c) => c.id === formData.cultura)?.name ||
                formData.cultura,
              timestamp: timestamp,
              operacoesMecanizadas: selectedOperacoesMecanizadas.map((op) => ({
                ...op,
                // Usar os nomes dos maquinários do Firebase
                bem: maquinarios.find((b) => b.id === op.bem)?.name || op.bem,
                // Manter os implementos como estão, pois já estão no formato correto
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
    atividades, // Adicionar atividades às dependências
  ])

  // Modificar o renderListItem para o caso do direcionador e implemento
  const renderListItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          if (listModalType === "atividade") {
            handleChange(listModalType, item.id)
          } else if (listModalType === "produto" || listModalType === "tanqueDiesel") {
            handleOperacaoMecanizadaChange(listModalType, item.id)
          } else if (listModalType === "bem") {
            handleOperacaoMecanizadaChange(listModalType, item.id)
            // Limpar implementos ao selecionar um novo bem
            setSelectedImplementos([])
            setOperacaoMecanizadaData((prev) => ({
              ...prev,
              implemento: "",
              implementos: [],
            }))
          } else if (listModalType === "implemento") {
            // Verificar se já está selecionado
            const isAlreadySelected = selectedImplementos.some((i) => i.id === item.id)
            if (!isAlreadySelected) {
              handleOperacaoMecanizadaChange(listModalType, item.id)
            } else {
              Alert.alert("Atenção", "Este implemento já foi selecionado.")
            }
          } else if (listModalType === "direcionador") {
            // Verificar se já está selecionado
            const isAlreadySelected = selectedDirecionadores.some((d) => d.id === item.id)
            if (!isAlreadySelected) {
              handleChange(listModalType, item.id)
            } else {
              Alert.alert("Atenção", "Este direcionador já foi selecionado.")
            }
          }
          setListModalVisible(false)
        }}
      >
        <Text>{item.name}</Text>
      </TouchableOpacity>
    ),
    [listModalType, handleChange, handleOperacaoMecanizadaChange, selectedDirecionadores, selectedImplementos],
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

  const openListModal = useCallback(
    (type) => {
      setListModalType(type)

      // Selecionar a lista correta com base no tipo
      if (type === "direcionador") {
        setListModalData(direcionadores)
      } else if (type === "bem") {
        setListModalData(maquinarios)
      } else if (type === "implemento") {
        setListModalData(implementos)
      } else if (type === "atividade") {
        // Usar atividades do Firebase em vez do arquivo assets.jsx
        setListModalData(atividades)
      } else {
        setListModalData(type === "produto" ? PRODUTOS : TANQUEDIESEL)
      }

      setSearchQuery("")
      setListModalVisible(true)
    },
    [direcionadores, maquinarios, implementos, atividades], // Adicionar atividades às dependências
  )

  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  // Modificar o renderListItem para o caso do direcionador

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
              keyExtractor={(item, index) => `${listModalType}-${item.id}-${index}`}
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
        <ActivityIndicator size="large" color="#2a9d8f" />
        <Text>Carregando...</Text>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
    // navigation.replace("Login")
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

  // Substituir a seção de direcionador no return do componente
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {renderInputField(
          "Ficha de Controle (número da máquina)",
          "fichaControle",
          formData.fichaControle,
          handleChange,
        )}
        <Separator />
        {renderDatePickerField("Data", "data")}
        <Separator />
        <Text style={styles.label}>Direcionadores</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("direcionador")}
          accessibilityLabel="Selecionar Direcionador"
        >
          <Text>
            {selectedDirecionadores.length > 0
              ? `${selectedDirecionadores.length} direcionador(es) selecionado(s)`
              : "Selecione um ou mais direcionadores"}
          </Text>
          <ChevronDown size={20} color="#2a9d8f" />
        </TouchableOpacity>

        {/* Lista de direcionadores selecionados */}
        {selectedDirecionadores.length > 0 && (
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
        {/* Modificar a exibição da cultura para mostrar todas as culturas dos direcionadores selecionados */}
        <Text style={styles.label}>Cultura</Text>
        <View style={[styles.input, styles.disabledInput]}>
          <Text>
            {selectedDirecionadores.length > 0
              ? (() => {
                  // Coletar todas as culturas únicas dos direcionadores selecionados
                  const culturas = selectedDirecionadores
                    .map((d) => d.culturaAssociada)
                    .filter((cultura) => cultura && cultura.trim() !== "")

                  // Remover duplicatas e juntar com vírgula
                  const culturasUnicas = [...new Set(culturas)]

                  return culturasUnicas.length > 0 ? culturasUnicas.join(", ") : "Não definida"
                })()
              : "Será definida pelo direcionador"}
          </Text>
        </View>
        <Separator />
        <Text style={styles.label}>Atividade</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => openListModal("atividade")}
          accessibilityLabel="Selecionar Atividade"
        >
          <Text>{atividades.find((a) => a.id === formData.atividade)?.name || "Selecione a Atividade"}</Text>
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
            <Text>{maquinarios.find((b) => b.id === operacaoMecanizadaData.bem)?.name || "Selecione o Bem"}</Text>
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
              {selectedImplementos.length > 0
                ? `${selectedImplementos.length} implemento(s) selecionado(s)`
                : "Selecione um ou mais implementos"}
            </Text>
            <ChevronDown size={20} color="#2a9d8f" />
          </TouchableOpacity>

          {/* Lista de implementos selecionados */}
          {selectedImplementos.length > 0 && (
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

          {selectedOperacoesMecanizadas.length > 0 && (
            <View style={styles.selectedItemsContainer}>
              <Text style={[styles.label, { marginTop: 16 }]}>Operações Adicionadas:</Text>
              {selectedOperacoesMecanizadas.map((item) => (
                <View key={item.id} style={styles.selectedItem}>
                  <View>
                    <Text style={styles.selectedItemTitle}>{maquinarios.find((b) => b.id === item.bem)?.name}</Text>
                    {/* Mostrar todos os implementos da operação */}
                    <Text style={styles.selectedItemSubtitle}>
                      Implementos:{" "}
                      {item.implementos
                        ? item.implementos.map((imp) => imp.name).join(", ")
                        : implementos.find((i) => i.id === item.implemento)?.name || ""}
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
                selectedImplementos.length === 0 ||
                !operacaoMecanizadaData.horaFinal ||
                Number.parseFloat(operacaoMecanizadaData.horaFinal) <=
                  Number.parseFloat(previousHorimetros[operacaoMecanizadaData.bem] || "0.00")) &&
                styles.disabledButton,
            ]}
            onPress={() => {
              if (operacaoMecanizadaData.bem && selectedImplementos.length > 0 && operacaoMecanizadaData.horaFinal) {
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
              } else if (selectedImplementos.length === 0) {
                Alert.alert("Atenção", "Selecione pelo menos um implemento.")
              }
            }}
            disabled={
              !operacaoMecanizadaData.bem ||
              selectedImplementos.length === 0 ||
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

// Adicionar novos estilos para os direcionadores selecionados
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
  selectedDirecionadoresContainer: {
    marginBottom: 16,
  },
  selectedImplementosContainer: {
    marginBottom: 16,
  },
})