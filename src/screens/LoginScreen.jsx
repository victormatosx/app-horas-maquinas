import React, { useEffect, useState } from "react"
import { View, Alert, SafeAreaView, ActivityIndicator } from "react-native"
import { useNavigation } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import LoginForm from "../components/LoginForm"
import { auth, database } from "../config/firebaseConfig"
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"
import { ref, get, set } from "firebase/database"
import { LinearGradient } from "expo-linear-gradient"
import styles from "../styles/StyleLogin"

const USER_TOKEN_KEY = "@user_token"
const USER_ROLE_KEY = "@user_role"
const USER_PROPERTY_KEY = "@user_property"

export default function LoginScreen() {
  const navigation = useNavigation()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const checkUserToken = async () => {
      try {
        const userToken = await AsyncStorage.getItem(USER_TOKEN_KEY)
        const userRole = await AsyncStorage.getItem(USER_ROLE_KEY)
        const userProperty = await AsyncStorage.getItem(USER_PROPERTY_KEY)
        if (userToken && userRole && userProperty) {
          navigation.replace("Home")
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
          const userRef = ref(database, `propriedades/${user.uid}`)
          const snapshot = await get(userRef)
          if (snapshot.exists()) {
            const userData = snapshot.val()
            await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid)
            await AsyncStorage.setItem(USER_ROLE_KEY, userData.role)
            await AsyncStorage.setItem(USER_PROPERTY_KEY, userData.property)
            navigation.replace("Home")
          } else {
            // Create a new user record if it doesn't exist
            const newUserData = {
              role: "user", // Default role
              property: "default", // Default property
            }
            await set(userRef, newUserData)
            await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid)
            await AsyncStorage.setItem(USER_ROLE_KEY, newUserData.role)
            await AsyncStorage.setItem(USER_PROPERTY_KEY, newUserData.property)
            navigation.replace("Home")
          }
        } catch (error) {
          console.error("Error fetching/creating user data:", error)
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

