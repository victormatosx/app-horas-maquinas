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
} from "react-native"
import { Picker } from "@react-native-picker/picker"
import { useNavigation } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Icon from "react-native-vector-icons/Ionicons"
import { database, auth } from "../config/firebaseConfig"
import { ref, onValue, off, query, orderByChild, equalTo } from "firebase/database"
import { signOut } from "firebase/auth"
import { checkConnectivityAndSync } from "../utils/offlineManager"
const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
export default function HomeScreen() {
  const [apontamentos, setApontamentos] = useState([])
  const [responsaveis, setResponsaveis] = useState([])
  const [sortOrder, setSortOrder] = useState("desc")
  const [isLoading, setIsLoading] = useState(false)
  const [userRole, setUserRole] = useState("")
  const [userPropriedade, setUserPropriedade] = useState("")
  const [propertyUsers, setPropertyUsers] = useState([])
  const [filtroUsuario, setFiltroUsuario] = useState(null)
  const [userId, setUserId] = useState(null)
  const navigation = useNavigation()
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
    const apontamentosRef = ref(database, `propriedades/${userPropriedade}/apontamentos`)
    let apontamentosQuery
    if (userRole === "user") {
      apontamentosQuery = query(apontamentosRef, orderByChild("userId"), equalTo(userId))
    } else if (userRole === "manager") {
      apontamentosQuery = apontamentosRef
    }
    if (userRole === "user" || userRole === "manager") {
      const listener = onValue(apontamentosQuery, (snapshot) => {
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
        setIsLoading(false)
      })

      return () => off(apontamentosRef, "value", listener)
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

  const sortApontamentos = (apontamentosArray) => {
    const sortedApontamentos = [...apontamentosArray].sort((a, b) => {
      const dateA = new Date(a.data.split("/").reverse().join("-"))
      const dateB = new Date(b.data.split("/").reverse().join("-"))
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB
    })
    setApontamentos(sortedApontamentos)
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

  const renderApontamento = ({ item }) => (
    <View style={styles.apontamentoItem} key={item.id}>
      <Text style={styles.data}>{item.data}</Text>
      <Text style={styles.responsavel}>{item.responsavel}</Text>
      <Text style={styles.direcionador}>{item.direcionador}</Text>
      <Text style={styles.ordemServico}>OS: {item.ordemServico}</Text>
    </View>
  )

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      <View style={styles.container}>
        {userRole === "admin" ? (
          <>
            <TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate("AdminPanel")}>
              <Icon name="settings-outline" size={28} color="white" />
              <Text style={styles.adminButtonText}>Admin Panel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.novoButton} onPress={() => navigation.navigate("Formulario")}>
              <Icon name="add-circle-outline" size={28} color="white" />
              <Text style={styles.novoButtonText}>NOVO APONTAMENTO</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.novoButton} onPress={() => navigation.navigate("Formulario")}>
              <Icon name="add-circle-outline" size={28} color="white" />
              <Text style={styles.novoButtonText}>NOVO APONTAMENTO</Text>
            </TouchableOpacity>

            {userRole === "manager" && (
              <View style={styles.filtroContainer}>
                <Text style={styles.filtroLabel}>Filtrar por usuário:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={filtroUsuario}
                    onValueChange={(itemValue) => setFiltroUsuario(itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos os usuários" value={null} />
                    {propertyUsers.map((user) => (
                      <Picker.Item key={user.id} label={user.nome} value={user.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            <View style={styles.sortButtonContainer}>
              <TouchableOpacity style={styles.sortButton} onPress={toggleSortOrder} disabled={isLoading}>
                <Icon name={sortOrder === "desc" ? "arrow-down" : "arrow-up"} size={24} color="white" />
                <Text style={styles.sortButtonText}>{sortOrder === "desc" ? "Mais antigo" : "Mais recente"}</Text>
              </TouchableOpacity>
            </View>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2a9d8f" />
              </View>
            )}

            <FlatList
              data={filteredApontamentos}
              renderItem={renderApontamento}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.apontamentosList}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
            />
          </>
        )}
      </View>
      <TouchableOpacity style={styles.sairButton} onPress={handleLogout}>
        <Icon name="log-out-outline" size={24} color="#E74C3C" />
        <Text style={styles.sairButtonText}>SAIR</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F0F4F8",
  },
  novoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 4,
  },
  novoButtonText: {
    color: "white",
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "bold",
  },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a9d8f",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 4,
  },
  adminButtonText: {
    color: "white",
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "bold",
  },
  filtroContainer: {
    marginBottom: 24,
  },
  filtroLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#2C3E50",
  },
  sortButtonContainer: {
    marginBottom: 16,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a9d8f",
    padding: 12,
    borderRadius: 12,
    elevation: 4,
  },
  sortButtonText: {
    color: "white",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  apontamentosList: {
    paddingBottom: 16,
  },
  apontamentoItem: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  data: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },
  responsavel: {
    fontSize: 16,
    color: "#2a9d8f",
    fontWeight: "600",
    marginBottom: 4,
  },
  direcionador: {
    fontSize: 16,
    color: "#34495E",
    marginBottom: 4,
  },
  ordemServico: {
    fontSize: 16,
    color: "#7F8C8D",
    fontWeight: "500",
  },
  sairButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4F8",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sairButtonText: {
    color: "#E74C3C",
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "bold",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginBottom: 10,
  },
  picker: {
    height: 50,
    width: "100%",
  },
})

