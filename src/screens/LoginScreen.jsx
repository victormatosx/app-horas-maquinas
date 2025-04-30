"use client"

import { useEffect, useState } from "react"
import { View, Alert, SafeAreaView, ActivityIndicator } from "react-native"
import { useNavigation } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import LoginForm from "../components/LoginForm"
import { auth, database } from "../config/firebaseConfig"
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"
import { ref, get } from "firebase/database"
import { LinearGradient } from "expo-linear-gradient"
import styles from "../styles/StyleLogin"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPRIEDADE_KEY = "@user_propriedade"

export default function LoginScreen() {
  const navigation = useNavigation()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const checkUserToken = async () => {
      try {
        const userToken = await AsyncStorage.getItem(USER_TOKEN_KEY)
        const userRole = await AsyncStorage.getItem(USER_ROLE_KEY)
        const userPropriedade = await AsyncStorage.getItem(USER_PROPRIEDADE_KEY)
        if (userToken && userRole && userPropriedade) {
          navigation.replace("Opening")
        }
      } catch (error) {
        console.error("Error checking user data:", error)
      } finally {
        setInitializing(false)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`)
          const userSnapshot = await get(userRef)

          if (userSnapshot.exists()) {
            const userData = userSnapshot.val()
            const propriedadeEscolhida = userData.propriedade_escolhida

            const propriedadeRef = ref(database, `propriedades/${propriedadeEscolhida}/users/${user.uid}`)
            const propriedadeSnapshot = await get(propriedadeRef)

            if (propriedadeSnapshot.exists()) {
              const propriedadeUserData = propriedadeSnapshot.val()
              await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid)
              await AsyncStorage.setItem(USER_ROLE_KEY, propriedadeUserData.role)
              await AsyncStorage.setItem(USER_PROPRIEDADE_KEY, propriedadeEscolhida)
              navigation.replace("Opening")
            } else {
              console.error("User data not found in the specified propriedade")
              Alert.alert("Error", "User data not found. Please contact support.")
            }
          } else {
            console.error("User not found in users node")
            Alert.alert("Error", "User account not found. Please register or contact support.")
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          Alert.alert("Error", "An error occurred while processing your data. Please try again.")
        }
      }
      if (initializing) setInitializing(false)
    })

    checkUserToken()

    return () => unsubscribe()
  }, [navigation, initializing])

  const handleLogin = async (email, password) => {
    if (!email || !password) {
      Alert.alert("Campos incompletos", "Por favor, preencha todos os campos!")
      return
    }

    try {
      await signInWithEmailAndPassword(auth, email, password)
      // User data will be handled by the onAuthStateChanged listener
    } catch (error) {
      console.error("Login error:", error)
      switch (error.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
          Alert.alert("Login Failed", "Your email or password is incorrect!")
          break
        case "auth/invalid-email":
          Alert.alert("Invalid Email", "Please enter a valid email address.")
          break
        case "auth/user-disabled":
          Alert.alert("Account Disabled", "This account has been disabled. Please contact support.")
          break
        default:
          Alert.alert("Erro de Login", "Ocorreu um erro ao fazer login. Por favor, tente novamente.")
      }
    }
  }

  if (initializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={["#4c669f", "#3b5998", "#192f6a"]} style={styles.gradientBackground}>
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#4c669f", "#3b5998", "#192f6a"]} style={styles.gradientBackground}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <LoginForm onLogin={handleLogin} />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  )
}
