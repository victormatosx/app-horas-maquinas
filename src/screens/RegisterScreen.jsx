import React from "react"
import { View, Alert, SafeAreaView } from "react-native"
import { useNavigation } from "@react-navigation/native"
import RegisterForm from "../components/RegisterForm"
import { auth, database } from "../config/firebaseConfig"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { ref, set } from "firebase/database"
import { LinearGradient } from "expo-linear-gradient"
import styles from "../styles/StyleRegister"

export default function RegisterScreen() {
  const navigation = useNavigation()

  const handleRegister = async (email, password, name, role, property) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Save user data only within the specific property's users node
      await set(ref(database, `propriedades/${property}/users/${user.uid}`), {
        nome: name,
        email: email,
        role: role,
      })

      Alert.alert("Conta Criada!", "Sua conta foi criada com sucesso!", [
        { text: "OK", onPress: () => navigation.replace("Home") },
      ])
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("E-mail já cadastrado", "Este e-mail já foi cadastrado. Por favor, use outro e-mail ou faça login.")
      } else {
        Alert.alert("Erro!", error.message)
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#4c669f", "#3b5998", "#192f6a"]} style={styles.gradientBackground}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <RegisterForm onRegister={handleRegister} />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  )
}

