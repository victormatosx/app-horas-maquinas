"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { auth, database } from "../config/firebaseConfig"
import { ref, onValue, off, update } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import Header from "../components/Header"
import Sidebar from "../components/Sidebar"
import { Factory, Calendar, MapPin, FileText, ChevronDown, ChevronRight, BadgeCheck } from "lucide-react-native"

export default function ServiceOrdersDashboard({ route }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [serviceOrders, setServiceOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completionData, setCompletionData] = useState({
    descricaoServico: "",
    fotos: [],
  })
  const [orderToComplete, setOrderToComplete] = useState(null)
  const [savingCompletion, setSavingCompletion] = useState(false)
  const [loggedUserId, setLoggedUserId] = useState(null)
  const [usersMap, setUsersMap] = useState({})
  const [userPropriedade, setUserPropriedade] = useState(null)
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(true)

  const orderStatus = route?.params?.status || "aberto"

  // Authentication state listener to cleanup resources on logout
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // User logged out - cleanup all state
        setIsUserAuthenticated(false)
        setServiceOrders([])
        setUsersMap({})
        setLoggedUserId(null)
        setUserPropriedade(null)
        setLoading(false)
      } else {
        setIsUserAuthenticated(true)
      }
    })

    return () => unsubscribeAuth()
  }, [])

  useEffect(() => {
    if (!isUserAuthenticated) return

    const loadUserData = async () => {
      try {
        const userId = await AsyncStorage.getItem("@user_token")
        const propriedade = await AsyncStorage.getItem("@user_propriedade")
        setLoggedUserId(userId || "unknown")
        setUserPropriedade(propriedade)
      } catch (error) {
        console.log("[v0] Erro ao carregar dados do usuário:", error)
        setLoggedUserId("unknown")
      }
    }
    loadUserData()
  }, [isUserAuthenticated])

  useEffect(() => {
    if (!userPropriedade || !loggedUserId || !isUserAuthenticated) return

    let isMounted = true
    const usersRef = ref(database, `propriedades/${userPropriedade}/users`)
    
    const unsubscribe = onValue(
      usersRef, 
      (snapshot) => {
        if (!isMounted || !auth.currentUser || !isUserAuthenticated) return
        
        const data = snapshot.val()
        if (data) {
          const usersMapping = {}
          Object.entries(data).forEach(([key, value]) => {
            if (value && (value.nome || value.name)) {
              usersMapping[key] = value.nome || value.name || "Usuário não identificado"
            }
          })
          setUsersMap(usersMapping)
        }
      },
      (error) => {
        if (isUserAuthenticated && auth.currentUser) {
          console.log("[v0] Erro ao carregar mapa de usuários:", error)
        }
      }
    )

    return () => {
      isMounted = false
      if (unsubscribe) {
        off(usersRef, "value", unsubscribe)
      }
    }
  }, [userPropriedade, loggedUserId, isUserAuthenticated])

  useEffect(() => {
    if (!userPropriedade || !loggedUserId || !isUserAuthenticated) return

    let isMounted = true
    const propertyOrdersRef = ref(database, `propriedades/${userPropriedade}/ordemServico`)

    const unsubscribe = onValue(
      propertyOrdersRef,
      (snapshot) => {
        if (!isMounted || !auth.currentUser || !isUserAuthenticated) return
        
        try {
          const data = snapshot.val()
          if (data) {
            const allOrders = []

            Object.entries(data).forEach(([orderId, orderData]) => {
              if (orderData && orderData.status === orderStatus) {
                allOrders.push({
                  id: orderId,
                  propertyName: userPropriedade,
                  ...orderData,
                })
              }
            })

            allOrders.sort((a, b) => new Date(b.data || b.criadoEm) - new Date(a.data || a.criadoEm))
            setServiceOrders(allOrders)
          } else {
            setServiceOrders([])
          }
          setLoading(false)
        } catch (error) {
          if (isUserAuthenticated && auth.currentUser) {
            console.log("[v0] Erro ao processar dados:", error)
            Alert.alert("Erro", "Erro ao carregar dados do Firebase")
          }
          setLoading(false)
        }
      },
      (error) => {
        // Only log error if user is still authenticated
        if (isUserAuthenticated && auth.currentUser) {
          console.log("[v0] Erro ao acessar banco de dados:", error)
          Alert.alert("Erro", "Erro ao acessar banco de dados: " + error.message)
        }
        if (isMounted) {
          setLoading(false)
        }
      },
    )

    return () => {
      isMounted = false
      if (unsubscribe) {
        off(propertyOrdersRef, "value", unsubscribe)
      }
    }
  }, [orderStatus, userPropriedade, loggedUserId, isUserAuthenticated])

  const handleCompleteOrder = (order) => {
    setOrderToComplete(order)
    setCompletionData({
      descricaoServico: "",
      fotos: [],
    })
    setShowCompletionModal(true)
  }

  const handleSaveAndCloseOrder = async () => {
    if (!completionData.descricaoServico.trim()) {
      Alert.alert("Erro", "Por favor, descreva o que foi feito na ordem de serviço.")
      return
    }

    setSavingCompletion(true)

    try {
      const orderRef = ref(database, `propriedades/${orderToComplete.propertyName}/ordemServico/${orderToComplete.id}`)

      const completionInfo = {
        descricaoServico: completionData.descricaoServico,
        fotos: completionData.fotos,
        dataFechamento: new Date().toISOString(),
        fechadoPor: loggedUserId || "unknown",
        userIdFechamento: loggedUserId || "unknown",
      }

      const updates = {
        status: "fechado",
        conclusao: completionInfo,
      }

      await update(orderRef, updates)

      Alert.alert("Sucesso", "Ordem de serviço concluída com sucesso!")
      setShowCompletionModal(false)
      setOrderToComplete(null)
      setCompletionData({ descricaoServico: "", fotos: [] })
    } catch (error) {
      console.log("[v0] Erro ao salvar conclusão:", error)
      Alert.alert("Erro", "Erro ao salvar a conclusão da ordem de serviço: " + error.message)
    } finally {
      setSavingCompletion(false)
    }
  }

  const handleAttachPhoto = () => {
    Alert.alert("Funcionalidade", "Funcionalidade de anexar fotos será implementada em breve.")
  }

  const formatDate = (dateString) => {
    if (!dateString) return "Data não informada"

    try {
      let date

      if (dateString.includes("/") && !dateString.includes("T")) {
        const parts = dateString.split("/")
        if (parts.length === 3) {
          const day = Number.parseInt(parts[0], 10)
          const month = Number.parseInt(parts[1], 10) - 1
          const year = Number.parseInt(parts[2], 10)
          date = new Date(year, month, day)
        } else {
          date = new Date(dateString)
        }
      } else {
        date = new Date(dateString)
      }

      if (isNaN(date.getTime())) {
        console.log("[v0] Date is invalid")
        return "Data inválida"
      }

      return date.toLocaleDateString("pt-BR")
    } catch (error) {
      console.log("[v0] Error formatting date:", error)
      return "Data inválida"
    }
  }

  const capitalizeFirstLetter = (string) => {
    if (!string) return ""
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return "Data não informada"

    try {
      let date = new Date(dateString)

      if (dateString.seconds) {
        date = new Date(dateString.seconds * 1000)
      } else if (isNaN(date.getTime()) && dateString.includes("/")) {
        const parts = dateString.split("/")
        if (parts.length === 3) {
          const day = Number.parseInt(parts[0], 10)
          const month = Number.parseInt(parts[1], 10) - 1
          const year = Number.parseInt(parts[2], 10)
          date = new Date(year, month, day)
        }
      }

      if (isNaN(date.getTime())) {
        return "Data inválida"
      }

      return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    } catch (error) {
      console.log("[v0] Error formatting date/time:", error)
      return "Data inválida"
    }
  }

  const handleOrderClick = (order) => {
    setSelectedOrder(selectedOrder?.id === order.id ? null : order)
  }

  const getStatusLabel = () => {
    return orderStatus === "aberto" ? "Abertas" : "Fechadas"
  }

  const getStatusBadgeStyle = (isOpen) => {
    if (isOpen) {
      return {
        backgroundColor: "rgba(34, 197, 94, 0.12)", // Green for 'Aberto'
        borderColor: "#22c55e",
      }
    } else {
      return {
        backgroundColor: "rgba(239, 68, 68, 0.12)", // Red for 'Fechado'
        borderColor: "#ef4444",
      }
    }
  }

  const getStatusTextStyle = (isOpen) => {
    return { 
      color: isOpen ? "#22c55e" : "#ef4444" 
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <Header title={`Ordens de Serviço ${getStatusLabel()}`} onMenuPress={() => setIsSidebarOpen(true)} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f505b" />
          <Text style={styles.loadingText}>Carregando ordens de serviço...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Header title={`Ordens de Serviço ${getStatusLabel()}`} onMenuPress={() => setIsSidebarOpen(true)} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: orderStatus === "aberto" ? "#22c55e" : "#ef4444" }]}>
              {serviceOrders.length}
            </Text>
            <Text style={styles.statLabel}>
              {serviceOrders.length === 1
                ? `Ordem ${orderStatus === "aberto" ? "em Aberto" : "Fechada"}`
                : `Ordens ${orderStatus === "aberto" ? "em Aberto" : "Fechadas"}`}
            </Text>
          </View>
        </View>

        {serviceOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {orderStatus === "aberto" ? "Nenhuma ordem de serviço em aberto" : "Nenhuma ordem de serviço fechada"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {orderStatus === "aberto"
                ? "Todas as ordens de serviço foram concluídas ou não há ordens cadastradas."
                : "Não há ordens de serviço concluídas no momento."}
            </Text>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            {serviceOrders.map((order) => (
              <View key={`${order.propertyName}-${order.id}`} style={styles.orderCard}>
                <TouchableOpacity
                  style={styles.orderHeader}
                  onPress={() => handleOrderClick(order)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderHeaderContent}>
                    <View style={styles.orderTitleRow}>
                      <Factory size={18} color="#0f505b" style={{ marginRight: 8 }} />
                      <Text style={styles.orderTitle}>{order.equipamento || "Equipamento não informado"}</Text>
                      <View style={[styles.statusBadge, getStatusBadgeStyle(orderStatus === "aberto")]}>
                        <BadgeCheck size={14} color={orderStatus === "aberto" ? "#22c55e" : "#ef4444"} style={{ marginRight: 6 }} />
                        <Text style={[styles.statusText, getStatusTextStyle(orderStatus === "aberto")]}>
                          {orderStatus === "aberto" ? "Aberto" : "Fechado"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.propertyRow}>
                      <MapPin size={14} color="#0f505b" style={{ marginRight: 6 }} />
                      <Text style={styles.propertyText}>{order.propertyName}</Text>
                    </View>

                    {order.descricaoProblema && (
                      <View style={styles.descriptionRow}>
                        <FileText size={14} color="#0f505b" style={{ marginRight: 6 }} />
                        <Text style={styles.descriptionText} numberOfLines={2}>
                          <Text style={styles.boldText}>Descrição: </Text>
                          {order.descricaoProblema}
                        </Text>
                      </View>
                    )}

                    <View style={styles.dateRow}>
                      <Calendar size={12} color="#6b7280" style={{ marginRight: 6 }} />
                      <Text style={styles.dateText}>{formatDate(order.data)}</Text>
                    </View>
                  </View>

                  {selectedOrder?.id === order.id ? (
                    <ChevronDown size={18} color="#94a3b8" />
                  ) : (
                    <ChevronRight size={18} color="#94a3b8" />
                  )}
                </TouchableOpacity>

                {selectedOrder?.id === order.id && (
                  <View style={styles.orderDetails}>
                    <Text style={styles.detailsTitle}>Detalhes da Ordem de Serviço</Text>

                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Equipamento</Text>
                        <Text style={styles.detailValue}>{order.equipamento || "Não informado"}</Text>
                      </View>

                      {order.tipoEquipamento && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Tipo de Equipamento</Text>
                          <Text style={styles.detailValue}>{capitalizeFirstLetter(order.tipoEquipamento)}</Text>
                        </View>
                      )}

                      {order.horimetroEntrada && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Horímetro de Entrada</Text>
                          <Text style={styles.detailValue}>{order.horimetroEntrada}</Text>
                        </View>
                      )}

                      {order.descricaoProblema && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Descrição do Problema</Text>
                          <Text style={styles.detailValue}>{order.descricaoProblema}</Text>
                        </View>
                      )}

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Propriedade</Text>
                        <Text style={styles.detailValue}>{order.propertyName}</Text>
                      </View>

                      {order.userId && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>ID do Usuário</Text>
                          <Text style={styles.detailValue}>{usersMap[order.userId] || order.userId}</Text>
                        </View>
                      )}

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>ID da Ordem</Text>
                        <Text style={styles.detailValue}>{order.id}</Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>{capitalizeFirstLetter(order.status) || "Não informado"}</Text>
                      </View>
                    </View>

                    {orderStatus === "fechado" && order.conclusao && (
                      <View style={styles.completionSection}>
                        <Text style={styles.completionTitle}>Informações de Conclusão</Text>

                        <View style={styles.completionDetails}>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Serviço Realizado</Text>
                            <Text style={styles.detailValue}>{order.conclusao.descricaoServico}</Text>
                          </View>

                          {order.conclusao.dataFechamento && (
                            <View style={styles.detailItem}>
                              <Text style={styles.detailLabel}>Data de Fechamento</Text>
                              <Text style={styles.detailValue}>{formatDateTime(order.conclusao.dataFechamento)}</Text>
                            </View>
                          )}

                          {order.conclusao.fechadoPor && (
                            <View style={styles.detailItem}>
                              <Text style={styles.detailLabel}>Fechado por</Text>
                              <Text style={styles.detailValue}>
                                {usersMap[order.conclusao.fechadoPor] || order.conclusao.fechadoPor}
                              </Text>
                            </View>
                          )}

                          {order.conclusao.fotos && order.conclusao.fotos.length > 0 && (
                            <View style={styles.detailItem}>
                              <Text style={styles.detailLabel}>Fotos Anexadas</Text>
                              <Text style={styles.detailValue}>{order.conclusao.fotos.length} foto(s) anexada(s)</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {orderStatus === "aberto" && (
                      <View style={styles.completionButtonContainer}>
                        <TouchableOpacity
                          style={styles.completeButton}
                          onPress={() => handleCompleteOrder(order)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.completeButtonText}>Concluir OS</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.detailsFooter}>
                      <Text style={styles.createdText}>
                        <Text style={styles.boldText}>Criado em:</Text> {formatDateTime(order.criadoEm || order.data)}
                      </Text>
                      <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                        <Text style={styles.closeButton}>Fechar detalhes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showCompletionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompletionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Concluir Ordem de Serviço</Text>
              <TouchableOpacity onPress={() => setShowCompletionModal(false)} style={styles.closeModalButton}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Maquinário</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{orderToComplete?.equipamento || "Não informado"}</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Descrição do Problema</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{orderToComplete?.descricaoProblema || "Não informado"}</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Descrição do Serviço Realizado *</Text>
                <TextInput
                  style={styles.textArea}
                  multiline={true}
                  numberOfLines={6}
                  placeholder="Descreva detalhadamente o que foi feito na ordem de serviço..."
                  value={completionData.descricaoServico}
                  onChangeText={(text) => setCompletionData((prev) => ({ ...prev, descricaoServico: text }))}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Anexar Fotos (Opcional)</Text>
                <TouchableOpacity style={styles.photoButton} onPress={handleAttachPhoto} activeOpacity={0.7}>
                  <Text style={styles.photoButtonText}>📷 Anexar Fotos</Text>
                </TouchableOpacity>
                <Text style={styles.photoHint}>
                  {completionData.fotos.length > 0
                    ? `${completionData.fotos.length} foto(s) anexada(s)`
                    : "Nenhuma foto anexada"}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCompletionModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, savingCompletion && styles.saveButtonDisabled]}
                onPress={handleSaveAndCloseOrder}
                disabled={savingCompletion}
                activeOpacity={0.7}
              >
                {savingCompletion ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Fechar OS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: "#64748b",
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  ordersContainer: {
    gap: 16,
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#0f505b",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orderHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderHeaderContent: {
    flex: 1,
    paddingRight: 12,
  },
  orderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  orderTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f505b",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  propertyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  propertyText: {
    fontSize: 14,
    color: "#0f505b",
    fontWeight: "500",
  },
  descriptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: "#334155",
    flex: 1,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  boldText: {
    fontWeight: "bold",
    color: "#0f505b",
  },
  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  detailValue: {
    color: "#1e293b",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    fontSize: 14,
  },
  descriptionContainer: {
    marginTop: 16,
  },
  descriptionFullText: {
    color: "#1e293b",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    lineHeight: 20,
    fontSize: 14,
  },
  completionButtonContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  completeButton: {
    backgroundColor: "#0f505b",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  completeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  detailsFooter: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  createdText: {
    fontSize: 14,
    color: "#64748b",
  },
  closeButton: {
    color: "#1e40af",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end", // faz o modal "subir" de baixo
  },

  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: "100%",
    height: "90%", // ocupa 90% da tela (pode ajustar para 100% se quiser tela cheia)
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
  },
  closeModalButton: {
    padding: 4,
  },
  closeModalText: {
    fontSize: 20,
    color: "#64748b",
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    minHeight: 120,
  },
  readOnlyField: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
    minHeight: 48,
  },
  readOnlyText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 20,
  },
  photoButton: {
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  photoButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "500",
  },
  photoHint: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#22c55e",
  },
  saveButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  completionSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#22c55e",
    marginBottom: 12,
  },
  completionDetails: {
    backgroundColor: "#f0fdf4",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
})
