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
import { checkConnectivityAndSync } from "../utils/offlineManager"
import { PRODUTOS, TANQUEDIESEL, BENS, IMPLEMENTOS } from "./assets"
import NetInfo from "@react-native-community/netinfo"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"

export default function HomeScreen() {
  const [apontamentos, setApontamentos] = useState([])
  const [abastecimentos, setAbastecimentos] = useState([]) // New state for abastecimentos
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
  })
  const [listModalVisible, setListModalVisible] = useState(false)
  const [listModalType, setListModalType] = useState("")
  const [listModalData, setListModalData] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [dateFilter, setDateFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)

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

  useEffect(() => {
    if (!userPropriedade || !userRole || !userId) return
    setIsLoading(true)
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
      const apontamentosListener = onValue(apontamentosQuery, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          const apontamentosArray = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...value,
          }))

          sortApontamentos(apontamentosArray)

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
          }))
          setAbastecimentos(sortByTimestamp(abastecimentosArray))
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
      setIsLoading(false)
    }
  }, [userPropriedade, userRole, userId])

  useEffect(() => {
    if (userRole === "manager" && userPropriedade) {
      const usersRef = ref(database, `propriedades/${userPropriedade}/users`)
      onValue(usersRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          const usersArray = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...value,
          }))
          setPropertyUsers(usersArray)
        }
      })
    }
  }, [userRole, userPropriedade])

  useEffect(() => {
    if (!userPropriedade) return

    const usersRef = ref(database, `propriedades/${userPropriedade}/users`)
    return onValue(usersRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const usersMapping = {}
        Object.entries(data).forEach(([key, value]) => {
          usersMapping[key] = value.nome
        })
        setUsersMap(usersMapping)
      }
    })
  }, [userPropriedade])

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
      <TouchableOpacity onPress={() => handleShowDetails(item)} style={styles.apontamentoItem} key={item.id}>
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
      setListModalData(BENS)
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

  const saveOfflineData = async (data) => {
    try {
      const offlineData = await AsyncStorage.getItem("offlineData")
      const parsedData = offlineData ? JSON.parse(offlineData) : []
      parsedData.push(data)
      await AsyncStorage.setItem("offlineData", JSON.stringify(parsedData))
    } catch (error) {
      console.error("Erro ao salvar dados offline:", error)
    }
  }

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
      const abastecimentoInfo = {
        ...abastecimentoData,
        produto: PRODUTOS.find((p) => p.id === abastecimentoData.produto)?.name || abastecimentoData.produto,
        tanqueDiesel:
          TANQUEDIESEL.find((t) => t.id === abastecimentoData.tanqueDiesel)?.name || abastecimentoData.tanqueDiesel,
        bem: BENS.find((b) => b.id === abastecimentoData.bem)?.name || abastecimentoData.bem,
        timestamp: Date.now(),
        userId: userId, // This ensures the logged-in user's ID is stored
        propriedade: userPropriedade,
        localId: localId,
        status: "pending",
        tipo: "abastecimento",
      }

      const netInfo = await NetInfo.fetch()
      if (netInfo.isConnected) {
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
        })
      } else {
        // Salvar offline para sincronização posterior
        await saveOfflineData(abastecimentoInfo)
        Alert.alert("Modo Offline", "Dados salvos localmente e serão sincronizados quando houver conexão.")
        setAbastecimentoModalVisible(false)
        setAbastecimentoData({
          produto: "",
          quantidade: "",
          horimetro: "",
          tanqueDiesel: "",
          bem: "",
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
                Selecione {listModalType === "produto" ? "o Combustível" : "o Tanque"}
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

  const renderFilterModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {userRole === "manager" && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>Filtrar por usuário:</Text>
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
              )}

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Ordenar por:</Text>
                <Picker
                  selectedValue={sortOrder}
                  onValueChange={(itemValue) => setSortOrder(itemValue)}
                  style={styles.filterPicker}
                >
                  <Picker.Item label="Mais recente" value="desc" />
                  <Picker.Item label="Mais antigo" value="asc" />
                </Picker>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Filtrar por data:</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => {
                    // Implementar seletor de data aqui
                  }}
                >
                  <Text>{dateFilter ? dateFilter.toLocaleDateString() : "Selecionar data"}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Filtrar por tipo:</Text>
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
            </ScrollView>

            <TouchableOpacity
              style={styles.applyFilterButton}
              onPress={() => {
                // Aplicar filtros
                setFilterModalVisible(false)
              }}
            >
              <Text style={styles.applyFilterButtonText}>Aplicar Filtros</Text>
            </TouchableOpacity>
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
        return itemDate.toDateString() === dateFilter.toDateString()
      })
    }

    if (typeFilter) {
      filtered = filtered.filter((item) => {
        if (typeFilter === "mecanizada") return !item.tipo || item.tipo !== "abastecimento"
        return item.tipo === typeFilter
      })
    }

    return sortByTimestamp(filtered)
  }, [apontamentos, abastecimentos, userRole, filtroUsuario, dateFilter, typeFilter])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2a9d8f" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Opening")} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#2a9d8f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Apontamentos</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        {userRole === "admin" ? (
          <>
            <TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate("AdminPanel")}>
              <Icon name="settings-outline" size={28} color="white" />
              <Text style={styles.adminButtonText}>Admin Panel</Text>
            </TouchableOpacity>
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

            <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
              <Icon name="filter-outline" size={24} color="white" />
              <Text style={styles.filterButtonText}>FILTRAR</Text>
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
              <Text style={styles.modalTitle}>Detalhes do Apontamento</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedApontamento && (
              <ScrollView style={styles.detailsContainer}>
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

            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
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

            <ScrollView style={styles.abastecimentoForm}>
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
                <Text>{BENS.find((b) => b.id === abastecimentoData.bem)?.name || "Selecione a Máquina"}</Text>
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
    borderLeftColor: 8,
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
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3498db",
    padding: 16,
    borderRadius: 25,
    marginBottom: 20,
  },
  filterButtonText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  filterPicker: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  datePickerButton: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
  },
  applyFilterButton: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
  },
  applyFilterButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
})
