"use client"

import { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native"
import { database } from "../config/firebaseConfig"
import { ref, onValue, off } from "firebase/database"
import Header from "../components/Header"

export default function ServiceOrdersDashboard({ route }) {
  const [serviceOrders, setServiceOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)

  const orderStatus = route?.params?.status || "aberto"

  useEffect(() => {
    const propertiesRef = ref(database, "propriedades")

    const unsubscribe = onValue(
      propertiesRef,
      (snapshot) => {
        try {
          const data = snapshot.val()
          if (data) {
            const allOrders = []

            Object.entries(data).forEach(([propertyName, propertyData]) => {
              if (propertyData.ordemServico) {
                Object.entries(propertyData.ordemServico).forEach(([orderId, orderData]) => {
                  if (orderData.status === orderStatus) {
                    allOrders.push({
                      id: orderId,
                      propertyName: propertyName,
                      ...orderData,
                    })
                  }
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
          console.log("[v0] Erro ao processar dados:", error)
          Alert.alert("Erro", "Erro ao carregar dados do Firebase")
          setLoading(false)
        }
      },
      (error) => {
        console.log("[v0] Erro ao acessar banco de dados:", error)
        Alert.alert("Erro", "Erro ao acessar banco de dados: " + error.message)
        setLoading(false)
      },
    )

    return () => {
      off(propertiesRef, "value", unsubscribe)
    }
  }, [orderStatus]) // Added orderStatus as dependency

  const formatDate = (dateString) => {
    if (!dateString) return "Data não informada"

    console.log("[v0] Formatando data:", dateString)

    try {
      let date

      if (dateString.includes("/") && !dateString.includes("T")) {
        // Handle DD/MM/YYYY format
        const parts = dateString.split("/")
        if (parts.length === 3) {
          const day = Number.parseInt(parts[0], 10)
          const month = Number.parseInt(parts[1], 10) - 1 // Month is 0-indexed in JavaScript
          const year = Number.parseInt(parts[2], 10)

          console.log("[v0] Parsed parts:", { day, month: month + 1, year })
          date = new Date(year, month, day)
        } else {
          date = new Date(dateString)
        }
      } else {
        // Handle ISO format or other standard formats
        date = new Date(dateString)
      }

      console.log("[v0] Created date object:", date)

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log("[v0] Date is invalid")
        return "Data inválida"
      }

      // Return only the date in Brazilian format
      return date.toLocaleDateString("pt-BR")
    } catch (error) {
      console.log("[v0] Error formatting date:", error)
      return "Data inválida"
    }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return "Data não informada"

    try {
      let date = new Date(dateString)

      // Handle Firebase timestamp
      if (dateString.seconds) {
        date = new Date(dateString.seconds * 1000)
      }
      // If date is invalid, try parsing as DD/MM/YYYY
      else if (isNaN(date.getTime()) && dateString.includes("/")) {
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

      // Return date and time in Brazilian format
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

  const getStatusBadgeStyle = () => {
    if (orderStatus === "fechado") {
      return {
        backgroundColor: "#dcfce7",
        borderColor: "#22c55e",
      }
    }
    return {
      backgroundColor: "#fef3c7",
      borderColor: "#fbbf24",
    }
  }

  const getStatusTextStyle = () => {
    if (orderStatus === "fechado") {
      return { color: "#166534" }
    }
    return { color: "#92400e" }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={`Ordens de Serviço ${getStatusLabel()}`} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Carregando ordens de serviço...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Header title={`Ordens de Serviço ${getStatusLabel()}`} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{serviceOrders.length}</Text>
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
                      <Text style={styles.orderTitle}>{order.equipamento || "Equipamento não informado"}</Text>
                      <View style={[styles.statusBadge, getStatusBadgeStyle()]}>
                        <Text style={[styles.statusText, getStatusTextStyle()]}>
                          {orderStatus === "aberto" ? "Aberto" : "Fechado"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.propertyText}>
                      <Text style={styles.boldText}>Propriedade:</Text> {order.propertyName}
                    </Text>

                    {order.descricaoProblema && (
                      <Text style={styles.descriptionText} numberOfLines={2}>
                        {order.descricaoProblema}
                      </Text>
                    )}

                    <View style={styles.orderInfoRow}>
                      <Text style={styles.infoText}>
                        <Text style={styles.boldText}>Data:</Text> {formatDate(order.data)}
                      </Text>
                      {order.operador && (
                        <Text style={styles.infoText}>
                          <Text style={styles.boldText}>Operador:</Text> {order.operador}
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text style={styles.chevron}>{selectedOrder?.id === order.id ? "▼" : "▶"}</Text>
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
                          <Text style={styles.detailValue}>{order.tipoEquipamento}</Text>
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
                          <Text style={styles.detailValue}>{order.userId}</Text>
                        </View>
                      )}

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>ID da Ordem</Text>
                        <Text style={styles.detailValue}>{order.id}</Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>{order.status || "Não informado"}</Text>
                      </View>
                    </View>


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
    </View>
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
    borderRadius: 12,
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
  orderHeader: {
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  orderHeaderContent: {
    flex: 1,
  },
  orderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  propertyText: {
    color: "#64748b",
    marginBottom: 8,
    fontSize: 14,
  },
  boldText: {
    fontWeight: "600",
    color: "#374151",
  },
  descriptionText: {
    color: "#475569",
    marginBottom: 12,
    lineHeight: 20,
    fontSize: 14,
  },
  orderInfoRow: {
    gap: 16,
  },
  infoText: {
    fontSize: 14,
    color: "#64748b",
  },
  chevron: {
    fontSize: 18,
    color: "#94a3b8",
    marginLeft: 16,
    fontWeight: "bold",
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
})
