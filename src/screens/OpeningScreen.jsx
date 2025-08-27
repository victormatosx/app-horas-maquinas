"use client"

import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert, ScrollView } from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { signOut } from "firebase/auth"
import { auth } from "../config/firebaseConfig"
import { useState, useEffect } from "react"
import NetInfo from "@react-native-community/netinfo"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"

export default function OpeningScreen() {
  const navigation = useNavigation()
  const [userRole, setUserRole] = useState("")
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    const loadUserRole = async () => {
      const role = await AsyncStorage.getItem(USER_ROLE_KEY)
      setUserRole(role)
    }
    loadUserRole()

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected)
    })

    return () => unsubscribe()
  }, [])

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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.container}>
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Icon name="cloud-offline-outline" size={18} color="white" style={styles.offlineIcon} />
            <Text style={styles.offlineBannerText}>
              Modo Offline - Os dados serão sincronizados quando houver conexão
            </Text>
          </View>
        )}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Painel Principal</Text>
            <Text style={styles.subtitle}>
              {userRole === "seller" ? "Área de vendas" : "Selecione uma área para continuar"}
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {/* Máquinas - Ocultar para seller */}
            {userRole !== "seller" && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("Home")}>
                <View style={[styles.iconContainer, { backgroundColor: "#2a9d8f" }]}>
                  <MaterialCommunityIcons name="tractor" size={40} color="white" />
                </View>
                <Text style={styles.optionTitle}>Máquinas</Text>
                <Text style={styles.optionDescription}>Gerenciar apontamentos e abastecimentos</Text>
                <View style={styles.arrowContainer}>
                  <Icon name="chevron-forward" size={24} color="#2a9d8f" />
                </View>
              </TouchableOpacity>
            )}

            {/* Veículos - Ocultar para seller */}
            {userRole !== "seller" && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("Veiculos")}>
                <View style={[styles.iconContainer, { backgroundColor: "#e67e22" }]}>
                  <Icon name="car-outline" size={40} color="white" />
                </View>
                <Text style={styles.optionTitle}>Veículos</Text>
                <Text style={styles.optionDescription}>Gerenciar frota e registros de uso</Text>
                <View style={styles.arrowContainer}>
                  <Icon name="chevron-forward" size={24} color="#e67e22" />
                </View>
              </TouchableOpacity>
            )}

            {(userRole === "user" || userRole === "manager") && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("OrdemServico")}>
                <View style={[styles.iconContainer, { backgroundColor: "#f39c12" }]}>
                  <MaterialCommunityIcons name="clipboard-text" size={40} color="white" />
                </View>
                <Text style={styles.optionTitle}>Abrir OS</Text>
                <Text style={styles.optionDescription}>Gerenciar ordens de serviço</Text>
                <View style={styles.arrowContainer}>
                  <Icon name="chevron-forward" size={24} color="#f39c12" />
                </View>
              </TouchableOpacity>
            )}

            {/* Vendas - Mostrar para admin e seller - ALTERADO PARA VendasHome */}
            {(userRole === "admin" || userRole === "seller") && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("VendasHome")}>
                <View style={[styles.iconContainer, { backgroundColor: "#9b59b6" }]}>
                  <MaterialCommunityIcons name="chart-line" size={40} color="white" />
                </View>
                <Text style={styles.optionTitle}>Vendas</Text>
                <Text style={styles.optionDescription}>Gerenciar vendas e relatórios comerciais</Text>
                <View style={styles.arrowContainer}>
                  <Icon name="chevron-forward" size={24} color="#9b59b6" />
                </View>
              </TouchableOpacity>
            )}

            {/* Cadastrar Usuários - Apenas para admin */}
            {userRole === "admin" && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("RegisterScreen")}>
                <View style={[styles.iconContainer, { backgroundColor: "#3498db" }]}>
                  <Icon name="person-add-outline" size={40} color="white" />
                </View>
                <Text style={styles.optionTitle}>Cadastrar Usuários</Text>
                <Text style={styles.optionDescription}>Adicionar novos usuários ao sistema</Text>
                <View style={styles.arrowContainer}>
                  <Icon name="chevron-forward" size={24} color="#3498db" />
                </View>
              </TouchableOpacity>
            )}

            {/* Mensagem especial para seller */}
            {userRole === "seller" && (
              <View style={styles.sellerWelcomeCard}>
                <View style={styles.sellerIconContainer}>
                  <MaterialCommunityIcons name="account-tie" size={50} color="#9b59b6" />
                </View>
                <Text style={styles.sellerWelcomeTitle}>Bem-vindo, Vendedor!</Text>
                <Text style={styles.sellerWelcomeText}>
                  Você tem acesso ao módulo de vendas. Gerencie suas vendas, clientes e relatórios comerciais.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
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
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 20,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  optionsContainer: {
    marginTop: 10,
  },
  optionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: "relative",
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    width: "80%",
  },
  arrowContainer: {
    position: "absolute",
    right: 20,
    top: "50%",
    marginTop: -12,
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  offlineBanner: {
    backgroundColor: "#e74c3c",
    padding: 10,
    borderRadius: 8,
    marginBottom: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineBannerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  offlineIcon: {
    marginRight: 8,
  },
  sellerWelcomeCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 25,
    marginTop: 20,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#9b59b6",
  },
  sellerIconContainer: {
    marginBottom: 15,
  },
  sellerWelcomeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  sellerWelcomeText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
})
