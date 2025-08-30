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
const USER_NAME_KEY = "@user_name"

export default function LoginScreen() {
  const navigation = useNavigation()
  const [initializing, setInitializing] = useState(true)

  // Função para criar usuário na propriedade se não existir
  const createUserInPropriedade = async (user, propriedadeId) => {
    try {
      const propriedadeUserRef = ref(database, `propriedades/${propriedadeId}/users/${user.uid}`)
      const defaultPropriedadeData = {
        email: user.email,
        nome: user.displayName || user.email.split("@")[0],
        propriedade: propriedadeId,
        role: "user", // Valor padrão
        status: "active",
        created_at: new Date().toISOString(),
      }

      await set(propriedadeUserRef, defaultPropriedadeData)
      console.log("Usuário criado na propriedade:", propriedadeId)
      return defaultPropriedadeData
    } catch (error) {
      console.error("Erro ao criar usuário na propriedade:", error)
      throw error
    }
  }

  // Função para determinar a propriedade do usuário baseada no email
  const determinarPropriedade = (email) => {
    // Você pode implementar lógica mais complexa aqui
    // Por exemplo, baseado no domínio do email ou uma tabela de mapeamento
    if (email.includes("@matrice.com")) {
      return "Matrice"
    }
    // Propriedade padrão
    return "Matrice"
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
          console.log("Email do usuário:", user.email)

          // Determinar propriedade baseada no email
          const propriedadeEscolhida = determinarPropriedade(user.email)
          console.log("Propriedade determinada:", propriedadeEscolhida)

          const propriedadeRef = ref(database, `propriedades/${propriedadeEscolhida}/users/${user.uid}`)

          try {
            const propriedadeSnapshot = await get(propriedadeRef)
            let propriedadeUserData

            if (!propriedadeSnapshot.exists()) {
              console.log("Usuário não encontrado na propriedade, criando...")
              propriedadeUserData = await createUserInPropriedade(user, propriedadeEscolhida)
            } else {
              propriedadeUserData = propriedadeSnapshot.val()
              console.log("Dados do usuário encontrados:", propriedadeUserData)
            }

            // Salvar dados no AsyncStorage
            const userRole = propriedadeUserData.role || "user"
            const userName = propriedadeUserData.nome || user.email.split("@")[0]
            await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid)
            await AsyncStorage.setItem(USER_ROLE_KEY, userRole)
            await AsyncStorage.setItem(USER_PROPRIEDADE_KEY, propriedadeEscolhida)
            await AsyncStorage.setItem(USER_NAME_KEY, userName)

            console.log("Login realizado com sucesso")
            
            // Redirecionar com base no papel do usuário
            if (userRole === "mecanico") {
              navigation.replace("OrdemServicoDashboard")
            } else {
              navigation.replace("Opening")
            }
          } catch (dbError) {
            console.error("Erro ao acessar banco de dados:", dbError)

            // Se houver erro de permissão, tenta criar o usuário mesmo assim
            if (dbError.code === "PERMISSION_DENIED") {
              console.log("Erro de permissão, tentando criar usuário...")
              try {
                const propriedadeUserData = await createUserInPropriedade(user, propriedadeEscolhida)

                const userRole = propriedadeUserData.role || "user"
                const userName = propriedadeUserData.nome || user.email.split("@")[0]
                await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid)
                await AsyncStorage.setItem(USER_ROLE_KEY, userRole)
                await AsyncStorage.setItem(USER_PROPRIEDADE_KEY, propriedadeEscolhida)
                await AsyncStorage.setItem(USER_NAME_KEY, userName)

                console.log("Usuário criado com sucesso após erro de permissão")
                
                // Redirecionar com base no papel do usuário
                if (userRole === "mecanico") {
                  navigation.replace("OrdemServicoDashboard")
                } else {
                  navigation.replace("Opening")
                }
              } catch (createError) {
                console.error("Erro ao criar usuário após erro de permissão:", createError)
                Alert.alert(
                  "Erro de Acesso",
                  "Sua conta não foi encontrada no sistema. Entre em contato com o suporte para ativação.",
                  [{ text: "OK", onPress: () => auth.signOut() }],
                )
              }
            } else {
              throw dbError
            }
          }
        } catch (error) {
          console.error("Erro geral ao processar usuário:", error)
          Alert.alert(
            "Erro",
            "Ocorreu um erro ao processar seus dados. Tente novamente ou entre em contato com o suporte.",
            [
              {
                text: "Tentar Novamente",
                onPress: () => auth.signOut(),
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
          Alert.alert("Usuário não encontrado", "Este email não está cadastrado no Firebase Authentication.")
          break
        case "auth/wrong-password":
        case "auth/invalid-credential":
          Alert.alert("Credenciais inválidas", "Email ou senha incorretos.")
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
