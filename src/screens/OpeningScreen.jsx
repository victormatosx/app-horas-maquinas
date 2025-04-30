import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { signOut } from "firebase/auth"
import { auth } from "../config/firebaseConfig"

const USER_TOKEN_KEY = "@user_token"

export default function OpeningScreen() {
  const navigation = useNavigation()

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
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Painel Principal</Text>
          <Text style={styles.subtitle}>Selecione uma área para continuar</Text>
        </View>

        <View style={styles.optionsContainer}>
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
        </View>
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
    paddingTop: 60, // Mantido em 60 conforme solicitado anteriormente
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 30, // Reduzido de 60 para 30
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
    marginTop: 10, // Reduzido de 20 para 10
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
})