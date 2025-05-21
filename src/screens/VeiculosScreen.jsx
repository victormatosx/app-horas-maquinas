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
import { auth, database } from "../config/firebaseConfig"
import { signOut } from "firebase/auth"
import { ref, onValue, off, push, set as dbSet, query, orderByChild, equalTo } from "firebase/database"
import NetInfo from "@react-native-community/netinfo"
import { PRODUTOS, TANQUEDIESEL } from "./assets"
import DateTimePicker from "@react-native-community/datetimepicker"
import {
  saveOfflineData,
  checkConnectivityAndSync,
  cacheFirebaseData,
  getCachedData,
  CACHE_KEYS,
} from "../utils/offlineManager"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const OFFLINE_ABASTECIMENTOS_KEY = "@offline_abastecimentos"

export default function VeiculosScreen() {
  const [abastecimentos, setAbastecimentos] = useState([])
  const [percursos, setPercursos] = useState([])
  const [combinedData, setCombinedData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState("")
  const [userPropriedade, setUserPropriedade] = useState("")
  const [userId, setUserId] = useState(null)
  const [selectedApontamento, setSelectedApontamento] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [abastecimentoModalVisible, setAbastecimentoModalVisible] = useState(false)
  const [abastecimentoData, setAbastecimentoData] = useState({
    produto: "",
    quantidade: "",
    horimetro: "",
    tanqueDiesel: "",
    placa: "",
    observacao: "",
  })
  const [listModalVisible, setListModalVisible] = useState(false)
  const [listModalType, setListModalType] = useState("")
  const [listModalData, setListModalData] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [usersMap, setUsersMap] = useState({})
  const [veiculos, setVeiculos] = useState([])
  const [isConnected, setIsConnected] = useState(true)
  const navigation = useNavigation()

  // Filtro states
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [dateFilter, setDateFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)
  const [sortOrder, setSortOrder] = useState("desc")
  const [filtroUsuario, setFiltroUsuario] = useState(null)
  const [propertyUsers, setPropertyUsers] = useState([])
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    const loadUserData = async () => {
      const role = await AsyncStorage.getItem(USER_ROLE_KEY)
      const propriedade = await AsyncStorage.getItem(USER_PROPRIEDADE_KEY)
      const id = await AsyncStorage.getItem(USER_TOKEN_KEY)
      setUserRole(role)
      setUserPropriedade(propriedade)
      setUserId(id)
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

  // Carregar veículos do Firebase ou do cache
  useEffect(() => {
    if (!userPropriedade) return

    const loadVeiculos = async () => {
      setIsLoading(true)

      try {
        const veiculosRef = ref(database, `propriedades/${userPropriedade}/veiculos`)

        // Tentar carregar do Firebase primeiro
        if (isConnected) {
          const veiculosListener = onValue(
            veiculosRef,
            (snapshot) => {
              const data = snapshot.val()
              if (data) {
                const veiculosArray = Object.entries(data).map(([key, value]) => ({
                  id: key,
                  modelo: value.modelo,
                  placa: value.placa,
                }))
                setVeiculos(veiculosArray)

                // Salvar em cache para uso offline
                cacheFirebaseData(veiculosArray, CACHE_KEYS.VEICULOS)
              } else {
                setVeiculos([])
              }
              setIsLoading(false)
            },
            (error) => {
              console.error("Erro ao carregar veículos do Firebase:", error)
              loadCachedVeiculos()
            },
          )

          return () => {
            off(veiculosRef, "value", veiculosListener)
          }
        } else {
          // Se estiver offline, carregar do cache
          loadCachedVeiculos()
        }
      } catch (error) {
        console.error("Erro ao configurar listener para veículos:", error)
        loadCachedVeiculos()
      }
    }

    const loadCachedVeiculos = async () => {
      const cachedVeiculos = await getCachedData(CACHE_KEYS.VEICULOS)
      if (cachedVeiculos) {
        setVeiculos(cachedVeiculos)
        console.log("Veículos carregados do cache")
      } else {
        setVeiculos([])
        console.log("Nenhum veículo em cache")
      }
      setIsLoading(false)
    }

    loadVeiculos()
  }, [userPropriedade, isConnected])

  // Carregar abastecimentos e percursos do Firebase ou do cache
  useEffect(() => {
    if (!userPropriedade || !userRole || !userId) return

    setIsLoading(true)

    const loadData = async () => {
      try {
        // Carregar abastecimentos
        const abastecimentosRef = ref(database, `propriedades/${userPropriedade}/abastecimentoVeiculos`)
        let abastecimentosQuery

        if (userRole === "user") {
          abastecimentosQuery = query(abastecimentosRef, orderByChild("userId"), equalTo(userId))
        } else if (userRole === "manager") {
          abastecimentosQuery = abastecimentosRef
        }

        // Carregar percursos
        const percursosRef = ref(database, `propriedades/${userPropriedade}/percursos`)
        let percursosQuery

        if (userRole === "user") {
          percursosQuery = query(percursosRef, orderByChild("userId"), equalTo(userId))
        } else if (userRole === "manager") {
          percursosQuery = percursosRef
        }

        if (userRole === "user" || userRole === "manager") {
          if (isConnected) {
            // Carregar do Firebase se estiver conectado
            const abastecimentosListener = onValue(
              abastecimentosQuery,
              (snapshot) => {
                const data = snapshot.val()
                if (data) {
                  const abastecimentosArray = Object.entries(data).map(([key, value]) => ({
                    id: key,
                    ...value,
                    tipo: "abastecimento",
                  }))
                  // Filtrar apenas abastecimentos de veículos
                  const veiculosAbastecimentos = abastecimentosArray.filter(
                    (item) => !item.tipoEquipamento || item.tipoEquipamento === "veiculo",
                  )
                  setAbastecimentos(veiculosAbastecimentos)

                  // Salvar em cache para uso offline
                  cacheFirebaseData(veiculosAbastecimentos, "cached_abastecimentos_veiculos")
                } else {
                  setAbastecimentos([])
                }
                setIsLoading(false)
              },
              (error) => {
                console.error("Erro ao carregar abastecimentos:", error)
                loadCachedData()
              },
            )

            const percursosListener = onValue(
              percursosQuery,
              (snapshot) => {
                const data = snapshot.val()
                if (data) {
                  const percursosArray = Object.entries(data).map(([key, value]) => ({
                    id: key,
                    ...value,
                    tipo: "percurso",
                  }))
                  setPercursos(percursosArray)

                  // Salvar em cache para uso offline
                  cacheFirebaseData(percursosArray, "cached_percursos")
                } else {
                  setPercursos([])
                }
                setIsLoading(false)
              },
              (error) => {
                console.error("Erro ao carregar percursos:", error)
                loadCachedData()
              },
            )

            return () => {
              off(abastecimentosQuery, "value", abastecimentosListener)
              off(percursosQuery, "value", percursosListener)
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
        const cachedAbastecimentos = await getCachedData("cached_abastecimentos_veiculos")
        const cachedPercursos = await getCachedData("cached_percursos")

        if (cachedAbastecimentos) {
          setAbastecimentos(cachedAbastecimentos)
          console.log("Abastecimentos carregados do cache")
        }

        if (cachedPercursos) {
          setPercursos(cachedPercursos)
          console.log("Percursos carregados do cache")
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

  // Combinar e ordenar abastecimentos e percursos por timestamp
  useEffect(() => {
    const combined = [...abastecimentos, ...percursos].sort((a, b) => b.timestamp - a.timestamp)
    setCombinedData(combined)
  }, [abastecimentos, percursos])

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

  const handleShowDetails = (item) => {
    setSelectedApontamento(item)
    setModalVisible(true)
  }

  // Função para ordenar por timestamp
  const sortByTimestamp = (array) => {
    return [...array].sort((a, b) => {
      return sortOrder === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    })
  }

  // Função para lidar com a mudança de data no DatePicker
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setDateFilter(selectedDate)
    }
  }

  // Função para limpar todos os filtros
  const clearFilters = () => {
    setDateFilter(null)
    setTypeFilter(null)
    setFiltroUsuario(null)
  }

  // Dados filtrados com base nos critérios selecionados
  const filteredData = useMemo(() => {
    let filtered = [...combinedData]

    if (userRole === "manager" && filtroUsuario) {
      filtered = filtered.filter((item) => item.userId === filtroUsuario)
    }

    if (dateFilter) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.timestamp)
        const filterDate = new Date(dateFilter)

        return (
          itemDate.getDate() === filterDate.getDate() &&
          itemDate.getMonth() === filterDate.getMonth() &&
          itemDate.getFullYear() === filterDate.getFullYear()
        )
      })
    }

    if (typeFilter) {
      filtered = filtered.filter((item) => item.tipo === typeFilter)
    }

    return sortByTimestamp(filtered)
  }, [combinedData, userRole, filtroUsuario, dateFilter, typeFilter, sortOrder])

  const renderApontamento = ({ item }) => {
    if (item.tipo === "abastecimento") {
      return (
        <TouchableOpacity
          onPress={() => handleShowDetails(item)}
          style={[styles.apontamentoItem, styles.abastecimentoItem]}
          key={item.id}
        >
          <View style={styles.apontamentoHeader}>
            <Text style={[styles.placa, { color: "#FF8C00" }]}>Abastecimento</Text>
            <Text style={styles.data}>{new Date(item.timestamp).toLocaleDateString("pt-BR")}</Text>
          </View>
          <Text style={styles.modelo}>{usersMap[item.userId] || "Não especificado"}</Text>
          <Text style={styles.tipo}>Combustível: {item.produto}</Text>
          <Text style={styles.kmAtual}>Veículo: {item.veiculo || item.placa || "Não especificado"}</Text>
        </TouchableOpacity>
      )
    } else {
      return (
        <TouchableOpacity
          onPress={() => handleShowDetails(item)}
          style={[styles.apontamentoItem, styles.percursoItem]}
          key={item.id}
        >
          <View style={styles.apontamentoHeader}>
            <Text style={[styles.placa, { color: "#2a9d8f" }]}>Percurso</Text>
            <Text style={styles.data}>{new Date(item.timestamp).toLocaleDateString("pt-BR")}</Text>
          </View>
          <Text style={styles.modelo}>{usersMap[item.userId] || "Não especificado"}</Text>
          <Text style={styles.tipo}>Veículo: {item.veiculo || item.placa || "Não especificado"}</Text>
          {item.kmInicial && item.kmFinal && (
            <Text style={styles.kmAtual}>
              KM: {item.kmInicial} → {item.kmFinal} ({Number.parseInt(item.kmFinal) - Number.parseInt(item.kmInicial)}{" "}
              km)
            </Text>
          )}
        </TouchableOpacity>
      )
    }
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

  const handleAbastecimentoChange = (name, value) => {
    setAbastecimentoData((prev) => ({ ...prev, [name]: value }))
  }

  const openListModal = (type) => {
    setListModalType(type)
    if (type === "produto") {
      setListModalData(PRODUTOS)
    } else if (type === "tanqueDiesel") {
      setListModalData(TANQUEDIESEL)
    } else if (type === "veiculo") {
      setListModalData(veiculos) // Usar os veículos carregados do Firebase
    }
    setSearchQuery("")
    setListModalVisible(true)
  }

  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    if (listModalType === "veiculo") {
      return listModalData.filter(
        (item) =>
          item.modelo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.placa?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery, listModalType])

  const renderListItem = ({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => {
        if (listModalType === "veiculo") {
          handleAbastecimentoChange("placa", item.id)
        } else {
          handleAbastecimentoChange(listModalType, item.id)
        }
        setListModalVisible(false)
      }}
    >
      <Text>{listModalType === "veiculo" ? `${item.modelo} (${item.placa})` : item.name}</Text>
    </TouchableOpacity>
  )

  const Separator = () => <View style={styles.separator} />

  const renderInputField = (
    label,
    name,
    value,
    onChange,
    keyboardType = "default",
    editable = true,
    multiline = false,
  ) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.disabledInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={(text) => onChange(name, text)}
        placeholder={label}
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
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
      !abastecimentoData.placa
    ) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios!")
      return
    }

    try {
      const localId = Date.now().toString()
      const selectedVeiculo = veiculos.find((v) => v.id === abastecimentoData.placa)

      const abastecimentoInfo = {
        ...abastecimentoData,
        produto: PRODUTOS.find((p) => p.id === abastecimentoData.produto)?.name || abastecimentoData.produto,
        tanqueDiesel:
          TANQUEDIESEL.find((t) => t.id === abastecimentoData.tanqueDiesel)?.name || abastecimentoData.tanqueDiesel,
        timestamp: Date.now(),
        userId: userId,
        propriedade: userPropriedade,
        localId: localId,
        status: "pending",
        tipo: "abastecimento",
        veiculo: selectedVeiculo?.modelo || "",
        placa: selectedVeiculo?.placa || abastecimentoData.placa,
        tipoEquipamento: "veiculo", // Marcando explicitamente como veículo
      }

      if (isConnected) {
        // Alterado para usar o nó abastecimentoVeiculos
        const abastecimentosRef = ref(database, `propriedades/${userPropriedade}/abastecimentoVeiculos`)
        const newEntryRef = push(abastecimentosRef)
        await dbSet(newEntryRef, abastecimentoInfo)
        Alert.alert("Sucesso", "Abastecimento enviado com sucesso!")
        setAbastecimentoModalVisible(false)
        setAbastecimentoData({
          produto: "",
          quantidade: "",
          horimetro: "",
          tanqueDiesel: "",
          placa: "",
          observacao: "", // Resetando o campo de observação
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
          placa: "",
          observacao: "", // Resetando o campo de observação
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
              <Text style={[styles.modalTitle, { flex: 1, textAlign: "center", color: "#FF8C00" }]}>
                Selecione{" "}
                {listModalType === "produto" ? "o Combustível" : listModalType === "veiculo" ? "o Veículo" : "o Tanque"}
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
              showsVerticalScrollIndicator={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    )
  }

  // Renderizar o modal de filtro
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
                  <Icon name="calendar" size={18} color="#FF8C00" />
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
                    <Picker.Item label="Percursos" value="percurso" />
                    <Picker.Item label="Abastecimentos" value="abastecimento" />
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

  const renderAbastecimentoDetails = (abastecimento) => {
    return (
      <View style={styles.abastecimentoContainer}>
        <Text style={styles.abastecimentoTitle}>Detalhes do Abastecimento</Text>
        {renderDetailItem("Tanque", abastecimento.tanqueDiesel)}
        {renderDetailItem("Combustível", abastecimento.produto)}
        {renderDetailItem("Quantidade", `${abastecimento.quantidade} L`)}
        {renderDetailItem("Horímetro", abastecimento.horimetro)}
        {renderDetailItem("Veículo", abastecimento.veiculo || abastecimento.placa || "-")}
        {renderDetailItem("Responsável", usersMap[abastecimento.userId] || "Não especificado")}
        {renderDetailItem("Data", new Date(abastecimento.timestamp).toLocaleString("pt-BR"))}
        {renderDetailItem("Status", abastecimento.status)}
        {abastecimento.observacao && renderDetailItem("Observação", abastecimento.observacao)}
      </View>
    )
  }

  const renderPercursoDetails = (percurso) => {
    return (
      <View style={styles.percursoContainer}>
        <Text style={styles.percursoTitle}>Detalhes do Percurso</Text>
        {renderDetailItem("Veículo", percurso.veiculo || percurso.placa || "-")}
        {renderDetailItem("KM Inicial", percurso.kmInicial)}
        {renderDetailItem("KM Final", percurso.kmFinal)}
        {percurso.kmInicial &&
          percurso.kmFinal &&
          renderDetailItem(
            "Distância",
            `${Number.parseInt(percurso.kmFinal) - Number.parseInt(percurso.kmInicial)} km`,
          )}
        {renderDetailItem("Responsável", usersMap[percurso.userId] || "Não especificado")}
        {renderDetailItem("Data", new Date(percurso.timestamp).toLocaleString("pt-BR"))}
        {renderDetailItem("Status", percurso.status)}
        {percurso.origem && renderDetailItem("Origem", percurso.origem)}
        {percurso.destino && renderDetailItem("Destino", percurso.destino)}
        {percurso.observacao && renderDetailItem("Observação", percurso.observacao)}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#FF8C00" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Opening")} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#FF8C00" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Veículos</Text>
        <TouchableOpacity
          style={styles.filterButtonSmall}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
        >
          <Icon name="funnel-outline" size={20} color="#FF8C00" />
          {(dateFilter || typeFilter || filtroUsuario) && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8C00" />
          </View>
        ) : (
          <>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.novoButton} onPress={() => navigation.navigate("FormVeiculos")}>
                <Icon name="add-circle-outline" size={24} color="white" />
                <Text style={styles.novoButtonText}>REGISTRAR PERCURSO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.novoButton, { backgroundColor: "#FF8C00", marginTop: 10 }]}
                onPress={() => setAbastecimentoModalVisible(true)}
              >
                <Icon name="water-outline" size={24} color="white" />
                <Text style={styles.novoButtonText}>NOVO ABASTECIMENTO</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredData}
              renderItem={renderApontamento}
              keyExtractor={(item) => `${item.tipo}-${item.id}`}
              contentContainerStyle={styles.apontamentosList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
                </View>
              }
            />
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
                Detalhes do {selectedApontamento?.tipo === "abastecimento" ? "Abastecimento" : "Percurso"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedApontamento && (
              <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
                {selectedApontamento.tipo === "abastecimento"
                  ? renderAbastecimentoDetails(selectedApontamento)
                  : renderPercursoDetails(selectedApontamento)}
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
              <Text style={[styles.modalTitle, { color: "#FF8C00" }]}>Novo Abastecimento</Text>
              <TouchableOpacity onPress={() => setAbastecimentoModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.abastecimentoForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Veículo</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => openListModal("veiculo")}
                accessibilityLabel="Selecionar Veículo"
              >
                <Text>
                  {veiculos.find((v) => v.id === abastecimentoData.placa)?.modelo
                    ? `${veiculos.find((v) => v.id === abastecimentoData.placa)?.modelo} (${veiculos.find((v) => v.id === abastecimentoData.placa)?.placa})`
                    : "Selecione o Veículo"}
                </Text>
                <Icon name="chevron-down" size={20} color="#FF8C00" />
              </TouchableOpacity>

              <Text style={styles.label}>Combustível</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => openListModal("produto")}
                accessibilityLabel="Selecionar Combustível"
              >
                <Text>
                  {PRODUTOS.find((p) => p.id === abastecimentoData.produto)?.name || "Selecione o Combustível"}
                </Text>
                <Icon name="chevron-down" size={20} color="#FF8C00" />
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
                <Icon name="chevron-down" size={20} color="#FF8C00" />
              </TouchableOpacity>

              {renderInputField(
                "Quantidade (L)",
                "quantidade",
                abastecimentoData.quantidade,
                handleAbastecimentoChange,
                "numeric",
              )}

              {renderInputField(
                "Hodômetro (KM)",
                "horimetro",
                abastecimentoData.horimetro,
                handleAbastecimentoChange,
                "numeric",
              )}

              {/* Campo de observação adicionado abaixo do hodômetro */}
              {renderInputField(
                "Observação",
                "observacao",
                abastecimentoData.observacao,
                handleAbastecimentoChange,
                "default",
                true,
                true,
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: "#FF8C00" }]}
              onPress={handleSubmitAbastecimento}
            >
              <Text style={styles.closeButtonText}>Enviar Abastecimento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderListModal()}
      {renderFilterModal()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    paddingTop: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: "#FF8C00",
    fontSize: 20,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
    padding: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  novoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 25,
    marginBottom: 10,
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
  },
  apontamentoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  placa: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modelo: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    marginBottom: 4,
  },
  tipo: {
    fontSize: 14,
    color: "#555",
  },
  kmAtual: {
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
    backgroundColor: "#f5f5f5",
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
    alignItems: "center",
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
    maxHeight: 300,
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
  input: {
    height: 50,
    borderColor: "#FF8C00",
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
  multilineInput: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: "#FF8C00",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  abastecimentoForm: {
    maxHeight: 400,
    marginBottom: 15,
  },
  searchInput: {
    height: 40,
    borderColor: "#FF8C00",
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
  abastecimentoItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF8C00",
  },
  percursoItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
  },
  data: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  abastecimentoContainer: {
    marginTop: 15,
    borderTopWidth: 2,
    borderTopColor: "#FF8C00",
    paddingTop: 15,
  },
  abastecimentoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF8C00",
    marginBottom: 10,
  },
  percursoContainer: {
    marginTop: 15,
    borderTopWidth: 2,
    borderTopColor: "#2a9d8f",
    paddingTop: 15,
  },
  percursoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2a9d8f",
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  // Estilos para o botão de filtro e modal
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
    color: "#FF8C00",
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
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  clearFilterButton: {
    backgroundColor: "#95a5a6",
    padding: 15,
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  clearFilterButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  applyFilterButton: {
    backgroundColor: "#FF8C00",
    padding: 15,
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  applyFilterButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  }
})
