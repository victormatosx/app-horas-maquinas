"use client"

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import { useState, useEffect, useRef } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { database } from "../config/firebaseConfig"
import { ref, onValue } from "firebase/database"

const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"
const CACHED_MAQUINARIOS_KEY = "@cached_maquinarios"
const CACHED_IMPLEMENTOS_KEY = "@cached_implementos"

export default function OrdemServico() {
  const navigation = useNavigation()
  const isMounted = useRef(true)
  const [userRole, setUserRole] = useState("")
  const [userPropriedade, setUserPropriedade] = useState("")

  const [selectedEquipment, setSelectedEquipment] = useState("")
  const [selectedEquipmentType, setSelectedEquipmentType] = useState("") // "maquinario" or "implemento"
  const [horimetroEntrada, setHorimetroEntrada] = useState("")
  const [data, setData] = useState("")
  const [datePickerVisible, setDatePickerVisible] = useState(false)
  const [operador, setOperador] = useState("")
  const [descricaoProblema, setDescricaoProblema] = useState("")

  const [maquinarios, setMaquinarios] = useState([])
  const [implementos, setImplementos] = useState([])
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false)
  const [equipmentType, setEquipmentType] = useState("maquinario") // Current selection type
  const [searchQuery, setSearchQuery] = useState("")

  const handleAnexarFotos = () => {
    // Placeholder function for handling photo attachment
    Alert.alert("Anexar Fotos", "Funcionalidade para anexar fotos ainda não implementada.")
  }

  const getCurrentDate = () => {
    const today = new Date()
    const day = String(today.getDate()).padStart(2, "0")
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const year = today.getFullYear()
    return `${day}/${month}/${year}`
  }

  const generateCalendarDays = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ day: "", isEmpty: true, key: `empty-${i}` })
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayString = String(day).padStart(2, "0")
      const monthString = String(currentMonth + 1).padStart(2, "0")
      const dateString = `${dayString}/${monthString}/${currentYear}`

      days.push({
        day: day,
        dateString: dateString,
        isEmpty: false,
        key: `day-${day}`,
      })
    }

    return days
  }

  const selectDate = (dateString) => {
    setData(dateString)
    setDatePickerVisible(false)
  }

  useEffect(() => {
    const loadUserData = async () => {
      const role = await AsyncStorage.getItem(USER_ROLE_KEY)
      const propriedade = await AsyncStorage.getItem(USER_PROPRIEDADE_KEY)

      setUserRole(role)
      setUserPropriedade(propriedade)

      if (role !== "user" && role !== "manager") {
        Alert.alert("Acesso Negado", "Você não tem permissão para acessar esta área.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ])
      }
    }
    loadUserData()

    setData(getCurrentDate())

    return () => {
      isMounted.current = false
    }
  }, [navigation])

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

  const openEquipmentModal = (type) => {
    setEquipmentType(type)
    setSearchQuery("")
    setEquipmentModalVisible(true)
  }

  const selectEquipment = (equipment) => {
    setSelectedEquipment(equipment.name)
    setSelectedEquipmentType(equipmentType)
    setEquipmentModalVisible(false)
  }

  const getFilteredData = () => {
    const data = equipmentType === "maquinario" ? maquinarios : implementos
    if (!searchQuery) return data
    return data.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }

  const handleSalvarEvento = () => {
    if (!selectedEquipment || !horimetroEntrada || !data || !operador || !descricaoProblema) {
      Alert.alert("Campos Obrigatórios", "Por favor, preencha todos os campos obrigatórios.")
      return
    }

    Alert.alert("Sucesso", "Evento salvo com sucesso!", [{ text: "OK", onPress: () => navigation.goBack() }])
  }

  const handleNovoEvento = () => {
    setSelectedEquipment("")
    setSelectedEquipmentType("")
    setHorimetroEntrada("")
    setData(getCurrentDate())
    setOperador("")
    setDescricaoProblema("")
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Criar Evento</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="calendar-plus" size={32} color="#f39c12" />
            <Text style={styles.cardTitle}>Criar um novo evento</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Maquinário/Implemento *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => openEquipmentModal("maquinario")}>
                <Text style={[styles.selectButtonText, !selectedEquipment && styles.placeholderText]}>
                  {selectedEquipment || "Selecione maquinário ou implemento"}
                </Text>
                <Icon name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Horímetro de Entrada */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Horímetro de Entrada *</Text>
              <TextInput
                style={styles.textInput}
                value={horimetroEntrada}
                onChangeText={setHorimetroEntrada}
                placeholder="Digite o horímetro de entrada"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Data *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setDatePickerVisible(true)}>
                <Text style={styles.selectButtonText}>{data}</Text>
                <Icon name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Operador */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Operador *</Text>
              <TextInput
                style={styles.textInput}
                value={operador}
                onChangeText={setOperador}
                placeholder="Nome do operador"
                placeholderTextColor="#999"
              />
            </View>

            {/* Descrição do Problema */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Descrição do Problema *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={descricaoProblema}
                onChangeText={setDescricaoProblema}
                placeholder="Descreva o problema encontrado"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Anexar ou Tirar Fotos */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Anexar ou Tirar Fotos</Text>
              <TouchableOpacity style={styles.photoButton} onPress={handleAnexarFotos}>
                <Icon name="camera-outline" size={20} color="#3498db" />
                <Text style={styles.photoButtonText}>Anexar/Tirar Fotos</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSalvarEvento}>
              <Icon name="save-outline" size={20} color="white" />
              <Text style={styles.saveButtonText}>Salvar Evento</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newButton} onPress={handleNovoEvento}>
              <Icon name="add-outline" size={20} color="#f39c12" />
              <Text style={styles.newButtonText}>Novo Evento</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacing for better scroll experience */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Equipment Selection Modal */}
      <Modal
        visible={equipmentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEquipmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Equipamento</Text>
              <TouchableOpacity onPress={() => setEquipmentModalVisible(false)} style={styles.closeButton}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Equipment Type Selection */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, equipmentType === "maquinario" && styles.typeButtonActive]}
                onPress={() => setEquipmentType("maquinario")}
              >
                <Text style={[styles.typeButtonText, equipmentType === "maquinario" && styles.typeButtonTextActive]}>
                  Maquinários
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, equipmentType === "implemento" && styles.typeButtonActive]}
                onPress={() => setEquipmentType("implemento")}
              >
                <Text style={[styles.typeButtonText, equipmentType === "implemento" && styles.typeButtonTextActive]}>
                  Implementos
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Buscar ${equipmentType === "maquinario" ? "maquinários" : "implementos"}...`}
                placeholderTextColor="#999"
              />
            </View>

            {/* Equipment List */}
            <FlatList
              data={getFilteredData()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.equipmentItem} onPress={() => selectEquipment(item)}>
                  <Text style={styles.equipmentItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={styles.equipmentList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={datePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Data</Text>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)} style={styles.closeButton}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarContainer}>
              <View style={styles.weekDaysHeader}>
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                  <Text key={day} style={styles.weekDayText}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {generateCalendarDays().map((dayObj) => (
                  <TouchableOpacity
                    key={dayObj.key}
                    style={[
                      styles.calendarDay,
                      dayObj.isEmpty && styles.emptyDay,
                      dayObj.dateString === data && styles.selectedDay,
                    ]}
                    onPress={() => !dayObj.isEmpty && selectDate(dayObj.dateString)}
                    disabled={dayObj.isEmpty}
                  >
                    <Text style={[styles.calendarDayText, dayObj.dateString === data && styles.selectedDayText]}>
                      {dayObj.day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.todayButton} onPress={() => selectDate(getCurrentDate())}>
                <Text style={styles.todayButtonText}>Hoje</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  headerRight: {
    width: 34,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  mainCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 12,
  },
  formContainer: {
    marginBottom: 25,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fafafa",
  },
  selectButtonText: {
    fontSize: 16,
    color: "#333",
  },
  placeholderText: {
    color: "#999",
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3498db",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 15,
    backgroundColor: "#f8f9fa",
  },
  photoButtonText: {
    color: "#3498db",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#27ae60",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  newButton: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#f39c12",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 8,
  },
  newButtonText: {
    color: "#f39c12",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 5,
  },
  typeSelector: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: "#3498db",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  typeButtonTextActive: {
    color: "white",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
    backgroundColor: "#fafafa",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
  },
  equipmentList: {
    maxHeight: 300,
  },
  equipmentItem: {
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  equipmentItemText: {
    fontSize: 16,
    color: "#333",
  },

  calendarModalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  calendarContainer: {
    marginTop: 10,
  },
  weekDaysHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  weekDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
    width: 40,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  calendarDay: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 2,
    borderRadius: 20,
  },
  emptyDay: {
    opacity: 0,
  },
  selectedDay: {
    backgroundColor: "#3498db",
  },
  calendarDayText: {
    fontSize: 16,
    color: "#333",
  },
  selectedDayText: {
    color: "white",
    fontWeight: "bold",
  },
  todayButton: {
    backgroundColor: "#f39c12",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  todayButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
})
