import React, { useState, useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import LoginScreen from "./src/screens/LoginScreen"
import HomeScreen from "./src/screens/HomeScreen"
import FormScreen from "./src/screens/FormScreen"
import RegisterScreen from "./src/screens/RegisterScreen"
import AdminPanelScreen from "./src/screens/AdminPanelScreen"

const Stack = createNativeStackNavigator()
const USER_ROLE_KEY = "@user_role"

export default function App() {
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    const loadUserRole = async () => {
      const role = await AsyncStorage.getItem(USER_ROLE_KEY)
      setUserRole(role)
    }
    loadUserRole()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#f0f0f0" />
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
              headerStyle: {
                backgroundColor: "#2a9d8f",
              },
              headerTintColor: "#fff",
              headerTitleStyle: {
                fontWeight: "bold",
              },
              headerTitleAlign: "center",
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Formulario" component={FormScreen} options={{ title: "Novo Apontamento" }} />
            {userRole === "admin" && (
              <Stack.Screen name="AdminPanel" component={AdminPanelScreen} options={{ title: "Admin Panel" }} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

