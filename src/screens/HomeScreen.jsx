"use client"

import { useState, useEffect, useMemo } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from "react-native"
import { Picker } from "@react-native-picker/picker"
import { useNavigation } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Icon from "react-native-vector-icons/Ionicons"
import { database, auth } from "../config/firebaseConfig"
import { ref, onValue, off, query, orderByChild, equalTo, push, set as dbSet } from "firebase/database"
import { signOut } from "firebase/auth"
import {
  checkConnectivityAndSync,
  saveOfflineData,
  cacheFirebaseData,
  getCachedData,
  CACHE_KEYS,
} from "../utils/offlineManager"
import { PRODUTOS, TANQUEDIESEL, IMPLEMENTOS } from "./assets"
import NetInfo from "@react-native-community/netinfo"
import DateTimePicker from "@react-native-community/datetimepicker"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const OFFLINE_ABASTECIMENTOS_KEY = "@offline_abastecimentos"

export default function HomeScreen() {
  const [apontamentos, setApontamentos] = useState([])
  const [abastecimentos, setAbastecimentos] = useState([])
  const [responsaveis, setResponsaveis] = useState([])
  const [sortOrder, setSortOrder] = useState("desc")
  const [isLoading, setIsLoading] = useState(false)
  const [userRole, setUserRole] = useState("")
  const [userPropriedade, setUserPropriedade] = useState("")
  const [propertyUsers, setPropertyUsers] = useState([])
  const [filtroUsuario, setFiltroUsuario] = useState(null)
  const [userId, setUserId] = useState(null)
  const navigation = useNavigation()
  const [usersMap, setUsersMap] = useState({})
  const [selectedApontamento, setSelectedApontamento] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [abastecimentoModalVisible, setAbastecimentoModalVisible] = useState(false)
  const [abastecimentoData, setAbastecimentoData] = useState({
    produto: "",
    quantidade: "",
    horimetro: "",
    tanqueDiesel: "",
    bem: "",
    observacao: "",
  })
  const [listModalVisible, setListModalVisible] = useState(false)
  const [listModalType, setListModalType] = useState("")
  const [listModalData, setListModalData] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [dateFilter, setDateFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [maquinas, setMaquinas] = useState([])
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    const loadUserData = async () => {
      const role = await AsyncStorage.getItem(USER_ROLE_KEY)
      const propriedade = await AsyncStorage.getItem(USER_PROPRIEDADE_KEY)
      const id = await AsyncStorage.getItem(USER_TOKEN_KEY)
      setUserRole(role)
      setUserPropriedade(propriedade)
      setUserId(id)
      await checkConnectivityAndSync()
    }
    loadUserData()
  }, [])

  // Monitorar o estado da conexão
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected)
      if (state.isConnected) {
        checkConnectivityAndSync()
      }
    })

    return () => unsubscribe()
  }, [])

  // Carregar máquinas do Firebase ou do cache
  useEffect(() => {
    if (!userPropriedade) return

    const loadMaquinarios = async () => {
      try {
        if (isConnected) {
          const maquinariosRef = ref(database, `propriedades/${userPropriedade}/maquinarios`)

          const maquinariosListener = onValue(maquinariosRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
              const maquinasArray = Object.entries(data).map(([key, value]) => ({
                id: value.id || key,
                name: `${value.id} - ${value.nome}`,
                rawName: value.nome || "Máquina sem nome",
              }))
              setMaquinas(maquinasArray)

              // Salvar em cache para uso offline
              cacheFirebaseData(maquinasArray, CACHE_KEYS.MAQUINARIOS)
            } else {
              setMaquinas([])
            }
          })

          return () => {
            off(maquinariosRef, "value", maquinariosListener)
          }
        } else {
          // Carregar do cache se estiver offline
          const cachedMaquinarios = await getCachedData(CACHE_KEYS.MAQUINARIOS)
          if (cachedMaquinarios) {
            setMaquinas(cachedMaquinarios)
            console.log("Maquinários carregados do cache")
          } else {
            setMaquinas([])
          }
        }
      } catch (error) {
        console.error("Erro ao configurar listener para maquinários:", error)
        const cachedMaquinarios = await getCachedData(CACHE_KEYS.MAQUINARIOS)
        if (cachedMaquinarios) {
          setMaquinas(cachedMaquinarios)
        }
      }
    }

    loadMaquinarios()
  }, [userPropriedade, isConnected])

  // Carregar apontamentos e abastecimentos
  useEffect(() => {
    if (!userPropriedade || !userRole || !userId) return
    setIsLoading(true)

    const loadData = async () => {
      try {
        // Fetch apontamentos
        const apontamentosRef = ref(database, `propriedades/${userPropriedade}/apontamentos`)
        let apontamentosQuery

        if (userRole === "user") {
          apontamentosQuery = query(apontamentosRef, orderByChild("userId"), equalTo(userId))
        } else if (userRole === "manager") {
          apontamentosQuery = apontamentosRef
        }

        // Fetch abastecimentos
        const abastecimentosRef = ref(database, `propriedades/${userPropriedade}/abastecimentos`)
        let abastecimentosQuery

        if (userRole === "user") {
          abastecimentosQuery = query(abastecimentosRef, orderByChild("userId"), equalTo(userId))
        } else if (userRole === "manager") {
          abastecimentosQuery = abastecimentosRef
        }

        if (userRole === "user" || userRole === "manager") {
          if (isConnected) {
            // Carregar do Firebase se estiver conectado
            const apontamentosListener = onValue(apontamentosQuery, (snapshot) => {
              const data = snapshot.val()
              if (data) {
                const apontamentosArray = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  ...value,
                }))

                sortApontamentos(apontamentosArray)

                // Salvar em cache para uso offline
                cacheFirebaseData(apontamentosArray, "cached_apontamentos")

                const uniqueResponsaveis = [...new Set(apontamentosArray.map((item) => item.responsavel))]
                setResponsaveis(uniqueResponsaveis)
              } else {
                setApontamentos([])
                setResponsaveis([])
              }
            })

            const abastecimentosListener = onValue(abastecimentosQuery, (snapshot) => {
              const data = snapshot.val()
              if (data) {
                const abastecimentosArray = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  ...value,
                  tipo: "abastecimento",
                }))
                setAbastecimentos(sortByTimestamp(abastecimentosArray))

                // Salvar em cache para uso offline
                cacheFirebaseData(abastecimentosArray, "cached_abastecimentos")
              } else {
                setAbastecimentos([])
              }
              setIsLoading(false)
            })

            return () => {
              off(apontamentosRef, "value", apontamentosListener)
              off(abastecimentosRef, "value", abastecimentosListener)
            }
          } else {
            // Carregar do cache se estiver offline
            loadCachedData()
          }
        } else {
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Erro ao configurar listeners:", error)
        loadCachedData()
      }
    }

    const loadCachedData = async () => {
      try {
        const cachedApontamentos = await getCachedData("cached_apontamentos")
        const cachedAbastecimentos = await getCachedData("cached_abastecimentos")

        if (cachedApontamentos) {
          setApontamentos(cachedApontamentos)
          const uniqueResponsaveis = [...new Set(cachedApontamentos.map((item) => item.responsavel))]
          setResponsaveis(uniqueResponsaveis)
          console.log("Apontamentos carregados do cache")
        }

        if (cachedAbastecimentos) {
          setAbastecimentos(cachedAbastecimentos)
          console.log("Abastecimentos carregados do cache")
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Erro ao carregar dados do cache:", error)
        setIsLoading(false)
      }
    }

    loadData()
  }, [userPropriedade, userRole, userId, isConnected])

  // Carregar usuários da propriedade para o filtro (para gerentes)
  useEffect(() => {
    if (userRole === "manager" && userPropriedade) {
      const loadUsers = async () => {
        try {
          if (isConnected) {
            const usersRef = ref(database, `propriedades/${userPropriedade}/users`)
            onValue(usersRef, (snapshot) => {
              const data = snapshot.val()
              if (data) {
                const usersArray = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  ...value,
                }))
                setPropertyUsers(usersArray)

                // Salvar em cache para uso offline
                cacheFirebaseData(usersArray, CACHE_KEYS.USERS)
              }
            })
          } else {
            // Carregar do cache se estiver offline
            const cachedUsers = await getCachedData(CACHE_KEYS.USERS)
            if (cachedUsers) {
              setPropertyUsers(cachedUsers)
            }
          }
        } catch (error) {
          console.error("Erro ao carregar usuários:", error)
          const cachedUsers = await getCachedData(CACHE_KEYS.USERS)
          if (cachedUsers) {
            setPropertyUsers(cachedUsers)
          }
        }
      }

      loadUsers()
    }
  }, [userRole, userPropriedade, isConnected])

  // Carregar mapa de usuários
  useEffect(() => {
    if (!userPropriedade) return

    const loadUsersMap = async () => {
      try {
        if (isConnected) {
          const usersRef = ref(database, `propriedades/${userPropriedade}/users`)
          return onValue(usersRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
              const usersMapping = {}
              Object.entries(data).forEach(([key, value]) => {
                usersMapping[key] = value.nome
              })
              setUsersMap(usersMapping)

              // Salvar em cache para uso offline
              cacheFirebaseData(usersMapping, "cached_users_map")
            }
          })
        } else {
          // Carregar do cache se estiver offline
          const cachedUsersMap = await getCachedData("cached_users_map")
          if (cachedUsersMap) {
            setUsersMap(cachedUsersMap)
          }
        }
      } catch (error) {
        console.error("Erro ao carregar mapa de usuários:", error)
        const cachedUsersMap = await getCachedData("cached_users_map")
        if (cachedUsersMap) {
          setUsersMap(cachedUsersMap)
        }
      }
    }

    loadUsersMap()
  }, [userPropriedade, isConnected])

  const sortApontamentos = (apontamentosArray) => {
    const sortedApontamentos = [...apontamentosArray].sort((a, b) => {
      const dateA = new Date(a.data.split("/").reverse().join("-"))
      const dateB = new Date(b.data.split("/").reverse().join("-"))
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB
    })
    setApontamentos(sortedApontamentos)
  }

  const sortByTimestamp = (array) => {
    return [...array].sort((a, b) => {
      return sortOrder === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    })
  }

  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === "desc" ? "asc" : "desc"
    setSortOrder(newSortOrder)
    sortApontamentos(apontamentos)
  }

  const filteredApontamentos = useMemo(() => {
    let filtered = apontamentos
    if (userRole === "manager" && filtroUsuario) {
      filtered = filtered.filter((item) => item.userId === filtroUsuario)
    }
    return filtered
  }, [apontamentos, userRole, filtroUsuario])

  const handleShowDetails = (item) => {
    setSelectedApontamento(item)
    setModalVisible(true)
  }

  const renderApontamento = ({ item }) => {
    if (item.tipo === "abastecimento") {
      return (
        <TouchableOpacity
          onPress={() => handleShowDetails(item)}
          style={[styles.apontamentoItem, styles.abastecimentoItem]}
          key={item.id}
        >
          <View style={styles.apontamentoHeader}>
            <Text style={[styles.fichaControle, { color: "#e67e22" }]}>Abastecimento</Text>
            <Text style={styles.data}>{new Date(item.timestamp).toLocaleDateString("pt-BR")}</Text>
          </View>
          <Text style={styles.responsavel}>{usersMap[item.userId] || "Não especificado"}</Text>
          <Text style={styles.direcionador}>Combustível: {item.produto}</Text>
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity
        onPress={() => handleShowDetails(item)}
        style={[styles.apontamentoItem, styles.horamaquinaItem]}
        key={item.id}
      >
        <View style={styles.apontamentoHeader}>
          <Text style={styles.fichaControle}>Ficha de Controle: {item.fichaControle}</Text>
          <Text style={styles.data}>{item.data}</Text>
        </View>
        <Text style={styles.responsavel}>{usersMap[item.userId] || item.responsavel}</Text>
        <Text style={styles.direcionador}>Direcionador: {item.direcionador}</Text>
      </TouchableOpacity>
    )
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      await AsyncStorage.removeItem(USER_TOKEN_KEY)
      navigation.replace("Login")
    } catch (error) {
      console.error("Logout error:", error)
      Alert.alert("Erro ao sair", "Ocorreu um erro ao tentar sair. Por favor, tente novamente.")
    }
  }

  const renderDetailItem = (label, value) => (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value || "-"}</Text>
    </View>
  )

  const renderOperacoesMecanizadas = (operacoes) => {
    if (!operacoes || Object.keys(operacoes).length === 0) return null

    return (
      <View style={styles.operacoesContainer}>
        <Text style={styles.operacoesTitle}>Operações Mecanizadas</Text>
        {Object.entries(operacoes).map(([key, op]) => (
          <View key={key} style={styles.operacaoItem}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Bem:</Text>
              <Text style={styles.detailValue}>{op.bem || "-"}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Implemento:</Text>
              <Text style={styles.detailValue}>{op.implemento || "-"}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Hora Inicial:</Text>
              <Text style={styles.detailValue}>{op.horaInicial || "-"}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Hora Final:</Text>
              <Text style={styles.detailValue}>{op.horaFinal || "-"}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Total Horas:</Text>
              <Text style={styles.detailValue}>{op.totalHoras || "-"}</Text>
            </View>
          </View>
        ))}
      </View>
    )
  }

  const renderAbastecimentoDetails = (abastecimento) => {
    return (
      <View style={styles.abastecimentoContainer}>
        <Text style={styles.abastecimentoTitle}>Detalhes do Abastecimento</Text>
        {renderDetailItem("Tanque", abastecimento.tanqueDiesel)}
        {renderDetailItem("Combustível", abastecimento.produto)}
        {renderDetailItem("Quantidade", `${abastecimento.quantidade} L`)}
        {renderDetailItem("Horímetro", abastecimento.horimetro)}
        {renderDetailItem("Máquina", abastecimento.bem || "-")}
        {renderDetailItem("Implemento", abastecimento.implemento || "-")}
        {renderDetailItem("Responsável", usersMap[abastecimento.userId] || "Não especificado")}
        {renderDetailItem("Data", new Date(abastecimento.timestamp).toLocaleString("pt-BR"))}
        {renderDetailItem("Status", abastecimento.status)}
        {abastecimento.observacao && renderDetailItem("Observação", abastecimento.observacao)}
      </View>
    )
  }

  const handleAbastecimentoChange = (name, value) => {
    setAbastecimentoData((prev) => ({ ...prev, [name]: value }))
  }

  const openListModal = (type) => {
    setListModalType(type)
    if (type === "produto") {
      setListModalData(PRODUTOS)
    } else if (type === "tanqueDiesel") {
      setListModalData(TANQUEDIESEL)
    } else if (type === "bem") {
      setListModalData(maquinas)
    } else if (type === "implemento") {
      setListModalData(IMPLEMENTOS)
    }
    setSearchQuery("")
    setListModalVisible(true)
  }

  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  const renderListItem = ({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => {
        handleAbastecimentoChange(listModalType, item.id)
        setListModalVisible(false)
      }}
    >
      <Text>{item.name}</Text>
    </TouchableOpacity>
  )

  const Separator = () => <View style={styles.separator} />

  const renderInputField = (label, name, value, onChange, keyboardType = "default", editable = true) => (
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
  )

  const handleSubmitAbastecimento = async () => {
    if (
      !abastecimentoData.produto ||
      !abastecimentoData.quantidade ||
      !abastecimentoData.tanqueDiesel ||
      !abastecimentoData.horimetro ||
      !abastecimentoData.bem
    ) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios!")
      return
    }

    try {
      const localId = Date.now().toString()
      const selectedMaquina = maquinas.find((b) => b.id === abastecimentoData.bem)

      const abastecimentoInfo = {
        ...abastecimentoData,
        produto: PRODUTOS.find((p) => p.id === abastecimentoData.produto)?.name || abastecimentoData.produto,
        tanqueDiesel:
          TANQUEDIESEL.find((t) => t.id === abastecimentoData.tanqueDiesel)?.name || abastecimentoData.tanqueDiesel,
        bem: selectedMaquina ? selectedMaquina.name : abastecimentoData.bem,
        timestamp: Date.now(),
        userId: userId,
        propriedade: userPropriedade,
        localId: localId,
        status: "pending",
        tipo: "abastecimento",
      }

      if (isConnected) {
        const abastecimentosRef = ref(database, `propriedades/${userPropriedade}/abastecimentos`)
        const newEntryRef = push(abastecimentosRef)
        await dbSet(newEntryRef, abastecimentoInfo)
        Alert.alert("Sucesso", "Abastecimento enviado com sucesso!")
        setAbastecimentoModalVisible(false)
        setAbastecimentoData({
          produto: "",
          quantidade: "",
          horimetro: "",
          tanqueDiesel: "",
          bem: "",
          observacao: "",
        })
      } else {
        // Salvar offline para sincronização posterior
        await saveOfflineData(abastecimentoInfo, OFFLINE_ABASTECIMENTOS_KEY)

        // Adicionar ao estado local para exibição imediata
        setAbastecimentos((prev) => [
          {
            id: `local-${localId}`,
            ...abastecimentoInfo,
          },
          ...prev,
        ])

        Alert.alert("Modo Offline", "Dados salvos localmente e serão sincronizados quando houver conexão.")
        setAbastecimentoModalVisible(false)
        setAbastecimentoData({
          produto: "",
          quantidade: "",
          horimetro: "",
          tanqueDiesel: "",
          bem: "",
          observacao: "",
        })
      }
    } catch (error) {
      console.error("Erro ao enviar abastecimento:", error)
      Alert.alert("Erro", "Ocorreu um erro ao enviar os dados. Tente novamente.")
    }
  }

  const renderListModal = () => {
    return (
      <Modal visible={listModalVisible} transparent={true} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { flex: 1, textAlign: "center" }]}>
                Selecione{" "}
                {listModalType === "produto"
                  ? "o Combustível"
                  : listModalType === "tanqueDiesel"
                    ? "o Tanque"
                    : listModalType === "bem"
                      ? "a Máquina"
                      : "o Implemento"}
              </Text>
              <TouchableOpacity onPress={() => setListModalVisible(false)} style={{ position: "absolute", right: 0 }}>
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
  }

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setDateFilter(selectedDate)
    }
  }

  const clearFilters = () => {
    setDateFilter(null)
    setTypeFilter(null)
    setFiltroUsuario(null)
  }

  const renderFilterModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filtros</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Icon name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScrollView} showsVerticalScrollIndicator={false}>
              {userRole === "manager" && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>Usuário</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filtroUsuario}
                      onValueChange={(itemValue) => setFiltroUsuario(itemValue)}
                      style={styles.filterPicker}
                    >
                      <Picker.Item label="Todos os usuários" value={null} />
                      {propertyUsers.map((user) => (
                        <Picker.Item key={user.id} label={user.nome} value={user.id} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Ordenação</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={sortOrder}
                    onValueChange={(itemValue) => setSortOrder(itemValue)}
                    style={styles.filterPicker}
                  >
                    <Picker.Item label="Mais recente" value="desc" />
                    <Picker.Item label="Mais antigo" value="asc" />
                  </Picker>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Data</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.datePickerText}>
                    {dateFilter ? dateFilter.toLocaleDateString("pt-BR") : "Selecionar data"}
                  </Text>
                  <Icon name="calendar" size={18} color="#2a9d8f" />
                </TouchableOpacity>
                {dateFilter && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setDateFilter(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearDateButtonText}>Limpar data</Text>
                    <Icon name="close-circle-outline" size={16} color="#e74c3c" />
                  </TouchableOpacity>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={dateFilter || new Date()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                  />
                )}
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Tipo</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={typeFilter}
                    onValueChange={(itemValue) => setTypeFilter(itemValue)}
                    style={styles.filterPicker}
                  >
                    <Picker.Item label="Todos" value={null} />
                    <Picker.Item label="Mecanizadas" value="mecanizada" />
                    <Picker.Item label="Abastecimento" value="abastecimento" />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterButtonsContainer}>
              <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilters} activeOpacity={0.7}>
                <Icon name="trash-outline" size={18} color="white" style={{ marginRight: 5 }} />
                <Text style={styles.clearFilterButtonText}>Limpar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyFilterButton}
                onPress={() => setFilterModalVisible(false)}
                activeOpacity={0.7}
              >
                <Icon name="checkmark-outline" size={18} color="white" style={{ marginRight: 5 }} />
                <Text style={styles.applyFilterButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  const filteredData = useMemo(() => {
    let filtered = [...apontamentos, ...abastecimentos]

    if (userRole === "manager" && filtroUsuario) {
      filtered = filtered.filter((item) => item.userId === filtroUsuario)
    }

    if (dateFilter) {
      filtered = filtered.filter((item) => {
        const itemDate = item.data ? new Date(item.data.split("/").reverse().join("-")) : new Date(item.timestamp)

        const filterDate = new Date(dateFilter)

        return (
          itemDate.getDate() === filterDate.getDate() &&
          itemDate.getMonth() === filterDate.getMonth() &&
          itemDate.getFullYear() === filterDate.getFullYear()
        )
      })
    }

    if (typeFilter) {
      filtered = filtered.filter((item) => {
        if (typeFilter === "mecanizada") return !item.tipo || item.tipo !== "abastecimento"
        return item.tipo === typeFilter
      })
    }

    return sortByTimestamp(filtered)
  }, [apontamentos, abastecimentos, userRole, filtroUsuario, dateFilter, typeFilter, sortOrder])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2a9d8f" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Opening")} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#2a9d8f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Apontamentos</Text>
        <TouchableOpacity
          style={styles.filterButtonSmall}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
        >
          <Icon name="funnel-outline" size={20} color="#2a9d8f" />
          {(dateFilter || typeFilter || filtroUsuario) && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {userRole === "admin" ? (
          <>
            <TouchableOpacity style={styles.novoButton} onPress={() => navigation.navigate("Formulario")}>
              <Icon name="add-circle-outline" size={24} color="white" />
              <Text style={styles.novoButtonText}>APONTAMENTO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.novoButton, { backgroundColor: "#e67e22", marginTop: 10 }]}
              onPress={() => setAbastecimentoModalVisible(true)}
            >
              <Icon name="water-outline" size={24} color="white" />
              <Text style={styles.novoButtonText}>ABASTECIMENTO</Text>
            </TouchableOpacity>

            {renderFilterModal()}

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2a9d8f" />
              </View>
            ) : (
              <FlatList
                data={filteredData}
                renderItem={renderApontamento}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.apontamentosList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
                  </View>
                }
              />
            )}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.novoButton} onPress={() => navigation.navigate("Formulario")}>
              <Icon name="add-circle-outline" size={24} color="white" />
              <Text style={styles.novoButtonText}>APONTAMENTO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.novoButton, { backgroundColor: "#e67e22", marginTop: 10 }]}
              onPress={() => setAbastecimentoModalVisible(true)}
            >
              <Icon name="water-outline" size={24} color="white" />
              <Text style={styles.novoButtonText}>ABASTECIMENTO</Text>
            </TouchableOpacity>

            {renderFilterModal()}

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2a9d8f" />
              </View>
            ) : (
              <FlatList
                data={filteredData}
                renderItem={renderApontamento}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.apontamentosList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
                  </View>
                }
              />
            )}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.sairButton} onPress={handleLogout}>
        <Icon name="log-out-outline" size={24} color="#E74C3C" />
        <Text style={styles.sairButtonText}>SAIR</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: selectedApontamento?.tipo === "abastecimento" ? "#FF8C00" : "#2a9d8f" },
                ]}
              >
                Detalhes do {selectedApontamento?.tipo === "abastecimento" ? "Abastecimento" : "Apontamento"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedApontamento && (
              <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
                {selectedApontamento.tipo === "abastecimento" ? (
                  renderAbastecimentoDetails(selectedApontamento)
                ) : (
                  <>
                    {renderDetailItem("Ficha de Controle", selectedApontamento.fichaControle)}
                    {renderDetailItem("Data", selectedApontamento.data)}
                    {renderDetailItem(
                      "Responsável",
                      usersMap[selectedApontamento.userId] || selectedApontamento.responsavel,
                    )}
                    {renderDetailItem("Direcionador", selectedApontamento.direcionador)}
                    {renderDetailItem("Atividade", selectedApontamento.atividade)}
                    {renderDetailItem("Cultura", selectedApontamento.cultura)}
                    {renderDetailItem("Propriedade", selectedApontamento.propriedade)}
                    {renderDetailItem("Status", selectedApontamento.status)}
                    {renderDetailItem("Observação", selectedApontamento.observacao)}
                    {selectedApontamento.validado !== undefined &&
                      renderDetailItem("Validado", selectedApontamento.validado ? "Sim" : "Não")}

                    {selectedApontamento.operacoesMecanizadas &&
                      renderOperacoesMecanizadas(selectedApontamento.operacoesMecanizadas)}
                  </>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: selectedApontamento?.tipo === "abastecimento" ? "#FF8C00" : "#2a9d8f" },
              ]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        transparent={true}
        visible={abastecimentoModalVisible}
        onRequestClose={() => setAbastecimentoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: "#e67e22" }]}>Novo Abastecimento</Text>
              <TouchableOpacity onPress={() => setAbastecimentoModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.abastecimentoForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Combustível</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => openListModal("produto")}
                accessibilityLabel="Selecionar Combustível"
              >
                <Text>
                  {PRODUTOS.find((p) => p.id === abastecimentoData.produto)?.name || "Selecione o Combustível"}
                </Text>
                <Icon name="chevron-down" size={20} color="#e67e22" />
              </TouchableOpacity>

              <Text style={styles.label}>Tanque</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => openListModal("tanqueDiesel")}
                accessibilityLabel="Selecionar Tanque"
              >
                <Text>
                  {TANQUEDIESEL.find((t) => t.id === abastecimentoData.tanqueDiesel)?.name || "Selecione o Tanque"}
                </Text>
                <Icon name="chevron-down" size={20} color="#e67e22" />
              </TouchableOpacity>

              <Text style={styles.label}>Máquina</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => openListModal("bem")}
                accessibilityLabel="Selecionar Máquina"
              >
                <Text>{maquinas.find((b) => b.id === abastecimentoData.bem)?.name || "Selecione a Máquina"}</Text>
                <Icon name="chevron-down" size={20} color="#e67e22" />
              </TouchableOpacity>

              {renderInputField(
                "Quantidade (L)",
                "quantidade",
                abastecimentoData.quantidade,
                handleAbastecimentoChange,
                "numeric",
              )}

              {renderInputField(
                "Horímetro",
                "horimetro",
                abastecimentoData.horimetro,
                handleAbastecimentoChange,
                "numeric",
              )}

              {renderInputField(
                "Observação",
                "observacao",
                abastecimentoData.observacao,
                handleAbastecimentoChange,
                "default",
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: "#e67e22" }]}
              onPress={handleSubmitAbastecimento}
            >
              <Text style={styles.closeButtonText}>Enviar Abastecimento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderListModal()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 12,
    paddingTop: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#2a9d8f",
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    padding: 8,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  novoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 25,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  novoButtonText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
  orderContainer: {
    marginBottom: 20,
  },
  orderLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  sortButtonText: {
    color: "#2a9d8f",
    fontSize: 16,
    fontWeight: "600",
  },
  filtroContainer: {
    marginBottom: 20,
  },
  filtroLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
  },
  pickerContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  apontamentosList: {
    paddingBottom: 20,
  },
  apontamentoItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    // Adicionar feedback visual ao toque
    activeOpacity: 0.7,
  },
  apontamentoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  responsavel: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  data: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  fichaControle: {
    fontSize: 16,
    color: "#2a9d8f",
    fontWeight: "bold",
  },
  direcionador: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
  sairButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    backgroundColor: "white",
  },
  sairButtonText: {
    color: "#E74C3C",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 25,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  adminButtonText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2a9d8f",
  },
  detailsContainer: {
    maxHeight: 400,
  },
  detailItem: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  detailLabel: {
    width: "40%",
    fontSize: 14,
    fontWeight: "bold",
    color: "#555",
  },
  detailValue: {
    width: "60%",
    fontSize: 14,
    color: "#333",
  },
  closeButton: {
    backgroundColor: "#2a9d8f",
    padding: 12,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 15,
  },
  closeButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  operacoesContainer: {
    marginTop: 15,
    borderTopWidth: 2,
    borderTopColor: "#2a9d8f",
    paddingTop: 15,
  },
  operacoesTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2a9d8f",
    marginBottom: 10,
  },
  operacaoItem: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
  },
  input: {
    height: 50,
    borderColor: "#e67e22",
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
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: "#e67e22",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  abastecimentoForm: {
    maxHeight: 400,
    marginBottom: 15,
  },
  searchInput: {
    height: 40,
    borderColor: "#e67e22",
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
  listItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    marginVertical: 4,
  },
  separator: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginVertical: 8,
    marginHorizontal: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    width: "80%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333333",
  },
  abastecimentoItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#e67e22",
  },
  horamaquinaItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
  },
  abastecimentoDetails: {
    marginTop: 8,
  },
  abastecimentoText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  abastecimentoLabel: {
    fontWeight: "600",
    color: "#666",
  },
  abastecimentoContainer: {
    marginTop: 15,
    borderTopWidth: 2,
    borderTopColor: "#e67e22",
    paddingTop: 15,
  },
  abastecimentoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#e67e22",
    marginBottom: 10,
  },
  filterButtonSmall: {
    backgroundColor: "white",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  filterBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e74c3c",
  },
  filterModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "90%",
    maxHeight: "80%",
    padding: 0,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: "hidden",
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2a9d8f",
  },
  filterScrollView: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
    color: "#555",
  },
  pickerContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  filterPicker: {
    height: 50,
  },
  datePickerButton: {
    backgroundColor: "#f8f8f8",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  datePickerText: {
    color: "#333",
  },
  clearDateButton: {
    marginTop: 10,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  clearDateButtonText: {
    color: "#e74c3c",
    fontWeight: "500",
    marginRight: 5,
  },
  filterButtonsContainer: {
    flexDirection: "row",
  },
})
