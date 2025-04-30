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
import { useNavigation } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Icon from "react-native-vector-icons/Ionicons"
import { auth, database } from "../config/firebaseConfig"
import { signOut } from "firebase/auth"
import { ref, onValue, off, push, set as dbSet } from "firebase/database"
import NetInfo from "@react-native-community/netinfo"
import { PRODUTOS, TANQUEDIESEL, VEICULOS } from "./assets"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"

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
  })
  const [listModalVisible, setListModalVisible] = useState(false)
  const [listModalType, setListModalType] = useState("")
  const [listModalData, setListModalData] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [usersMap, setUsersMap] = useState({})
  const navigation = useNavigation()

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

  useEffect(() => {
    if (!userPropriedade) return

    setIsLoading(true)

    // Carregar abastecimentos
    const abastecimentosRef = ref(database, `propriedades/${userPropriedade}/abastecimentoVeiculos`)
    const abastecimentosListener = onValue(abastecimentosRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const abastecimentosArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
          tipo: "abastecimento",
        }))
        // Filtrar apenas abastecimentos de veículos (não de máquinas)
        const veiculosAbastecimentos = abastecimentosArray.filter(
          (item) => !item.tipoEquipamento || item.tipoEquipamento === "veiculo",
        )
        setAbastecimentos(veiculosAbastecimentos)
      } else {
        setAbastecimentos([])
      }
      setIsLoading(false)
    })

    // Carregar percursos
    const percursosRef = ref(database, `propriedades/${userPropriedade}/percursos`)
    const percursosListener = onValue(percursosRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const percursosArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
          tipo: "percurso",
        }))
        setPercursos(percursosArray)
      } else {
        setPercursos([])
      }
      setIsLoading(false)
    })

    return () => {
      off(abastecimentosRef, "value", abastecimentosListener)
      off(percursosRef, "value", percursosListener)
    }
  }, [userPropriedade])

  // Combinar e ordenar abastecimentos e percursos por timestamp
  useEffect(() => {
    const combined = [...abastecimentos, ...percursos].sort((a, b) => b.timestamp - a.timestamp)
    setCombinedData(combined)
  }, [abastecimentos, percursos])

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
    setListModalData(type === "produto" ? PRODUTOS : TANQUEDIESEL)
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
      <Text>{listModalType === "veiculo" ? `${item.modelo} (${item.placa})` : item.name}</Text>
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
      const offlineData = await AsyncStorage.getItem("offlineAbastecimentos")
      const parsedData = offlineData ? JSON.parse(offlineData) : []
      parsedData.push(data)
      await AsyncStorage.setItem("offlineAbastecimentos", JSON.stringify(parsedData))
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
      !abastecimentoData.placa
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
        timestamp: Date.now(),
        userId: userId,
        propriedade: userPropriedade,
        localId: localId,
        status: "pending",
        tipo: "abastecimento",
        veiculo: VEICULOS.find((v) => v.id === abastecimentoData.placa)?.modelo || "",
        placa: VEICULOS.find((v) => v.id === abastecimentoData.placa)?.placa || abastecimentoData.placa,
        tipoEquipamento: "veiculo", // Marcando explicitamente como veículo
      }

      const netInfo = await NetInfo.fetch()
      if (netInfo.isConnected) {
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
          placa: "",
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
            />
          </View>
        </SafeAreaView>
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
          <Icon name="arrow-back" size={24} color="#2a9d8f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Veículos</Text>
        <View style={{ width: 24 }} />
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
              data={combinedData}
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
              <Text style={styles.modalTitle}>
                Detalhes do {selectedApontamento?.tipo === "abastecimento" ? "Abastecimento" : "Percurso"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedApontamento && (
              <ScrollView style={styles.detailsContainer}>
                {selectedApontamento.tipo === "abastecimento"
                  ? renderAbastecimentoDetails(selectedApontamento)
                  : renderPercursoDetails(selectedApontamento)}
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
              <Text style={[styles.modalTitle, { color: "#FF8C00" }]}>Novo Abastecimento</Text>
              <TouchableOpacity onPress={() => setAbastecimentoModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.abastecimentoForm}>
              <Text style={styles.label}>Veículo</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  setListModalType("veiculo")
                  setListModalData(VEICULOS)
                  setSearchQuery("")
                  setListModalVisible(true)
                }}
                accessibilityLabel="Selecionar Veículo"
              >
                <Text>
                  {VEICULOS.find((v) => v.id === abastecimentoData.placa)?.modelo
                    ? `${VEICULOS.find((v) => v.id === abastecimentoData.placa)?.modelo} (${VEICULOS.find((v) => v.id === abastecimentoData.placa)?.placa})`
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
    color: "#2a9d8f",
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
})
