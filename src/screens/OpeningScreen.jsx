"use client"

import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert, ScrollView, Dimensions } from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { signOut } from "firebase/auth"
import { auth } from "../config/firebaseConfig"
import { useState, useEffect } from "react"
import NetInfo from "@react-native-community/netinfo"
import { LinearGradient } from 'expo-linear-gradient'

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const { width, height } = Dimensions.get('window')

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
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <View style={styles.gradientBackground}>
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
                <LinearGradient
                  colors={['#0F505B', '#1a6b75']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="tractor" size={40} color="white" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.optionTitle}>Máquinas</Text>
                      <Text style={styles.optionDescription}>Gerenciar apontamentos e abastecimentos</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Icon name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Veículos - Ocultar para seller */}
            {userRole !== "seller" && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("Veiculos")}>
                <LinearGradient
                  colors={['#f39c12', '#e67e22']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <Icon name="car-outline" size={40} color="white" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.optionTitle}>Veículos</Text>
                      <Text style={styles.optionDescription}>Gerenciar frota e registros de uso</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Icon name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {(userRole === "user" || userRole === "manager") && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("OrdemServico")}>
                <LinearGradient
                  colors={['#f1c40f', '#f39c12']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="clipboard-text" size={40} color="white" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.optionTitle}>Abrir OS</Text>
                      <Text style={styles.optionDescription}>Gerenciar ordens de serviço</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Icon name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Vendas - Mostrar para admin e seller - ALTERADO PARA VendasHome */}
            {(userRole === "admin" || userRole === "seller") && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("VendasHome")}>
                <LinearGradient
                  colors={['#9b59b6', '#8e44ad']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="chart-line" size={40} color="white" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.optionTitle}>Vendas</Text>
                      <Text style={styles.optionDescription}>Gerenciar vendas e relatórios comerciais</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Icon name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Cadastrar Usuários - Apenas para admin */}
            {userRole === "admin" && (
              <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate("RegisterScreen")}>
                <LinearGradient
                  colors={['#3498db', '#2980b9']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                      <Icon name="person-add-outline" size={40} color="white" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.optionTitle}>Cadastro</Text>
                      <Text style={styles.optionDescription}>Adicionar novos usuários ao sistema</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Icon name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

          </View>
        </ScrollView>
        </View>

        <TouchableOpacity style={styles.logoutIcon} onPress={handleLogout}>
          <Icon name="log-out-outline" size={30} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#333",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    fontWeight: "300",
    letterSpacing: 0.3,
  },
  optionsContainer: {
    marginTop: 10,
  },
  optionCard: {
    marginBottom: 20,
    borderRadius: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    minHeight: 100,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 20,
  },
  textContainer: {
    flex: 1,
    paddingRight: 15,
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  optionDescription: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 20,
    fontWeight: "400",
  },
  arrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    padding: 15,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  offlineBanner: {
    backgroundColor: "rgba(231, 76, 60, 0.9)",
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  offlineBannerText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  offlineIcon: {
    marginRight: 10,
  },
})
