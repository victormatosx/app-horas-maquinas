import React, { useState, useEffect } from "react"
import { View, TextInput, TouchableOpacity, Text, Alert } from "react-native"
import { Picker } from "@react-native-picker/picker"
import { useNavigation } from "@react-navigation/native"
import { database } from "../config/firebaseConfig"
import { ref, get } from "firebase/database"
import styles from "../styles/StyleRegister"

export default function RegisterForm({ onRegister }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("user")
  const [property, setProperty] = useState("")
  const [properties, setProperties] = useState([])
  const navigation = useNavigation()

  useEffect(() => {
    const fetchProperties = async () => {
      const propertiesRef = ref(database, "propriedades")
      const snapshot = await get(propertiesRef)
      if (snapshot.exists()) {
        const propertiesData = snapshot.val()
        setProperties(Object.keys(propertiesData))
      }
    }
    fetchProperties()
  }, [])

  const handleRegister = () => {
    if (!email || !password || !confirmPassword || !name || !property) {
      Alert.alert("Campos incompletos", "Por favor, preencha todos os campos.")
      return
    }
    if (password !== confirmPassword) {
      Alert.alert("Erro", "As senhas não coincidem!")
      return
    }
    onRegister(email, password, name, role, property)
  }

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Crie sua conta</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome"
        placeholderTextColor="#A0AEC0"
        value={name}
        onChangeText={setName}
      />
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
      <TextInput
        style={styles.input}
        placeholder="Confirme sua senha"
        placeholderTextColor="#A0AEC0"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Picker selectedValue={role} style={styles.picker} onValueChange={(itemValue) => setRole(itemValue)}>
        <Picker.Item label="Usuário Operacional" value="user" />
        <Picker.Item label="Gestor" value="manager" />
        <Picker.Item label="Administrador" value="admin" />
        <Picker.Item label="Vendedor" value="seller" />
        <Picker.Item label="Mecânico" value="mecanico" />
      </Picker>
      <Picker selectedValue={property} style={styles.picker} onValueChange={(itemValue) => setProperty(itemValue)}>
        <Picker.Item label="Selecione uma propriedade" value="" />
        {properties.map((prop) => (
          <Picker.Item key={prop} label={prop} value={prop} />
        ))}
      </Picker>
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Criar conta</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.loginLink}>Já possui uma conta? Entre aqui!</Text>
      </TouchableOpacity>
    </View>
  )
}

