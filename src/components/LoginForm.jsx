"use client"

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"
import styles from "../styles/StyleLogin"

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigation = useNavigation()

  const handleLogin = () => {
    onLogin(email, password)
  }

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Bem Vindo(a)!</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#A0AEC0"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#A0AEC0"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  )
}
