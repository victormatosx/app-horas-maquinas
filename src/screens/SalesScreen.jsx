"use client"

import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, ScrollView } from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import { useState, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

const USER_ROLE_KEY = "@user_role"

export default function SalesScreen() {
  const navigation = useNavigation()
  const [userRole, setUserRole] = useState("")

  useEffect(() => {
    const loadUserRole = async () => {
      const role = await AsyncStorage.getItem(USER_ROLE_KEY)
      setUserRole(role)
    }
    loadUserRole()
  }, [])

  const salesOptions = [
    {
      id: 1,
      title: "Nova Venda",
      description: "Registrar uma nova venda",
      icon: "add-circle-outline",
      color: "#27ae60",
      onPress: () => {
        // Navegar para tela de nova venda (a ser implementada)
        console.log("Nova Venda")
      },
    },
    {
      id: 2,
      title: "Relatórios",
      description: "Visualizar relatórios de vendas",
      icon: "bar-chart-outline",
      color: "#3498db",
      onPress: () => {
        // Navegar para tela de relatórios (a ser implementada)
        console.log("Relatórios")
      },
    },
    {
      id: 3,
      title: "Clientes",
      description: "Gerenciar cadastro de clientes",
      icon: "people-outline",
      color: "#e67e22",
      onPress: () => {
        // Navegar para tela de clientes (a ser implementada)
        console.log("Clientes")
      },
    },
    {
      id: 4,
      title: "Produtos",
      description: "Gerenciar catálogo de produtos",
      icon: "cube-outline",
      color: "#9b59b6",
      onPress: () => {
        // Navegar para tela de produtos (a ser implementada)
        console.log("Produtos")
      },
    },
  ]

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendas</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <MaterialCommunityIcons name="chart-line" size={60} color="#9b59b6" />
          <Text style={styles.welcomeTitle}>Módulo de Vendas</Text>
          <Text style={styles.welcomeSubtitle}>
            {userRole === "admin" ? "Acesso completo ao sistema de vendas" : "Área de vendas e relatórios"}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Vendas Hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>R$ 0,00</Text>
            <Text style={styles.statLabel}>Faturamento</Text>
          </View>
        </View>

        <View style={styles.optionsContainer}>
          <Text style={styles.sectionTitle}>Opções Disponíveis</Text>

          {salesOptions.map((option) => (
            <TouchableOpacity key={option.id} style={styles.optionCard} onPress={option.onPress}>
              <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
                <Icon name={option.icon} size={30} color="white" />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <View style={styles.arrowContainer}>
                <Icon name="chevron-forward" size={24} color={option.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Icon name="information-circle-outline" size={24} color="#3498db" />
            <Text style={styles.infoText}>
              Este módulo está em desenvolvimento. Novas funcionalidades serão adicionadas em breve.
            </Text>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 34,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  welcomeSection: {
    alignItems: "center",
    marginBottom: 30,
    backgroundColor: "white",
    padding: 30,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 15,
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#9b59b6",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  optionsContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  optionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  optionDescription: {
    fontSize: 14,
    color: "#666",
  },
  arrowContainer: {
    padding: 5,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: "#e3f2fd",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1976d2",
    marginLeft: 10,
    lineHeight: 20,
  },
})
