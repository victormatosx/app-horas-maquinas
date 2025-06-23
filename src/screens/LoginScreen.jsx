"use client"

import { useEffect, useState } from "react"
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
const USER_PROPRIEDADE_KEY = "@user_propriedade"

export default function LoginScreen() {
  const navigation = useNavigation()
  const [initializing, setInitializing] = useState(true)

  // Função para criar usuário no database se não existir
  const createUserInDatabase = async (user) => {
    try {
      const userRef = ref(database, `users/${user.uid}`)
      const defaultUserData = {
        email: user.email,
        nome: user.displayName || user.email.split("@")[0],
        propriedade_escolhida: "Matrice", // Valor padrão baseado na sua estrutura
        created_at: new Date().toISOString(),
      }

      await set(userRef, defaultUserData)
      console.log("Usuário criado no database:", user.uid)
      return defaultUserData
    } catch (error) {
      console.error("Erro ao criar usuário no database:", error)
      throw error
    }
  }

  // Função para criar usuário na propriedade se não existir
  const createUserInPropriedade = async (userId, propriedadeId) => {
    try {
      const propriedadeUserRef = ref(database, `propriedades/${propriedadeId}/users/${userId}`)
      const defaultPropriedadeData = {
        role: "user", // Valor padrão
        status: "active",
        added_at: new Date().toISOString(),
      }

      await set(propriedadeUserRef, defaultPropriedadeData)
      console.log("Usuário adicionado à propriedade:", propriedadeId)
      return defaultPropriedadeData
    } catch (error) {
      console.error("Erro ao adicionar usuário à propriedade:", error)
      throw error
    }
  }

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
          console.log("Usuário autenticado:", user.uid)

          const userRef = ref(database, `users/${user.uid}`)
          const userSnapshot = await get(userRef)
          let userData

          // Se o usuário não existe no database, criar
          if (!userSnapshot.exists()) {
            console.log("Usuário não encontrado no database, criando...")
            userData = await createUserInDatabase(user)
          } else {
            userData = userSnapshot.val()
            console.log("Dados do usuário encontrados:", userData)
          }

          const propriedadeEscolhida = userData.propriedade_escolhida

          if (!propriedadeEscolhida) {
            Alert.alert("Erro", "Propriedade não definida para este usuário. Entre em contato com o suporte.")
            return
          }

          const propriedadeRef = ref(database, `propriedades/${propriedadeEscolhida}/users/${user.uid}`)
          const propriedadeSnapshot = await get(propriedadeRef)
          let propriedadeUserData

          // Se o usuário não existe na propriedade, criar
          if (!propriedadeSnapshot.exists()) {
            console.log("Usuário não encontrado na propriedade, adicionando...")
            propriedadeUserData = await createUserInPropriedade(user.uid, propriedadeEscolhida)
          } else {
            propriedadeUserData = propriedadeSnapshot.val()
            console.log("Dados do usuário na propriedade:", propriedadeUserData)
          }

          // Salvar dados no AsyncStorage
          await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid)
          await AsyncStorage.setItem(USER_ROLE_KEY, propriedadeUserData.role)
          await AsyncStorage.setItem(USER_PROPRIEDADE_KEY, propriedadeEscolhida)

          console.log("Login realizado com sucesso")
          navigation.replace("Opening")
        } catch (error) {
          console.error("Erro ao processar dados do usuário:", error)
          Alert.alert(
            "Erro",
            "Ocorreu um erro ao processar seus dados. Tente novamente ou entre em contato com o suporte.",
            [
              {
                text: "Tentar Novamente",
                onPress: () => {
                  // Força logout para tentar novamente
                  auth.signOut()
                },
              },
              {
                text: "OK",
                style: "cancel",
              },
            ],
          )
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
      console.log("Tentando fazer login com:", email)
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error("Erro de login:", error)
      switch (error.code) {
        case "auth/user-not-found":
          Alert.alert("Usuário não encontrado", "Este email não está cadastrado.")
          break
        case "auth/wrong-password":
        case "auth/invalid-credential":
          Alert.alert("Senha incorreta", "A senha informada está incorreta.")
          break
        case "auth/invalid-email":
          Alert.alert("Email inválido", "Por favor, insira um email válido.")
          break
        case "auth/user-disabled":
          Alert.alert("Conta desabilitada", "Esta conta foi desabilitada. Entre em contato com o suporte.")
          break
        case "auth/too-many-requests":
          Alert.alert("Muitas tentativas", "Muitas tentativas de login. Tente novamente mais tarde.")
          break
        default:
          Alert.alert("Erro de Login", `Ocorreu um erro: ${error.message}`)
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
