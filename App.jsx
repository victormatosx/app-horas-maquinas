"use client"

import { useEffect, useState } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { checkConnectivityAndSync } from "./src/utils/offlineManager"

// Screens
import LoginScreen from "./src/screens/LoginScreen"
import HomeScreen from "./src/screens/HomeScreen"
import FormScreen from "./src/screens/FormScreen"
import OpeningScreen from "./src/screens/OpeningScreen"
import VeiculosScreen from "./src/screens/VeiculosScreen"
import FormVeiculosScreen from "./src/screens/FormVeiculosScreen"
import RegisterScreen from "./src/screens/RegisterScreen" // Adicionando o import da tela de cadastro

const Stack = createNativeStackNavigator()

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const userToken = await AsyncStorage.getItem("@user_token")
        setIsLoggedIn(!!userToken)
      } catch (error) {
        console.error("Error checking login status:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkLoginStatus()
  }, [])

  // Monitorar o estado da conexão e sincronizar quando estiver online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        checkConnectivityAndSync()
      }
    })

    // Verificar e sincronizar ao iniciar o aplicativo
    checkConnectivityAndSync()

    return () => unsubscribe()
  }, [])

  if (isLoading) {
    return null
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Stack.Navigator
        initialRouteName={isLoggedIn ? "Opening" : "Login"}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Opening" component={OpeningScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Formulario" component={FormScreen} />
        <Stack.Screen name="Veiculos" component={VeiculosScreen} />
        <Stack.Screen name="FormVeiculos" component={FormVeiculosScreen} />
        <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}