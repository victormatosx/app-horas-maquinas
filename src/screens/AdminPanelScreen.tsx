import React, { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Alert } from "react-native"
import { database } from "../config/firebaseConfig"
import { ref, onValue, remove } from "firebase/database"
import Icon from "react-native-vector-icons/Ionicons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNavigation } from "@react-navigation/native"

const USER_ROLE_KEY = "@user_role"

export default function AdminPanelScreen() {
  const [users, setUsers] = useState([])
  const navigation = useNavigation()

  useEffect(() => {
    const checkAdminAccess = async () => {
      const userRole = await AsyncStorage.getItem(USER_ROLE_KEY)
      if (userRole !== "admin") {
        Alert.alert("Acesso Negado", "Você não tem permissão para acessar esta área.")
        navigation.goBack()
        return
      }
    }
    checkAdminAccess()

    const usersRef = ref(database, "users")
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const usersArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
        }))
        setUsers(usersArray)
      }
    })

    return () => unsubscribe()
  }, [navigation])

  const handleDeleteUser = (userId) => {
    Alert.alert("Confirmar exclusão", "Tem certeza que deseja excluir este usuário?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sim",
        onPress: () => {
          const userRef = ref(database, `users/${userId}`)
          remove(userRef)
            .then(() => {
              Alert.alert("Sucesso", "Usuário excluído com sucesso!")
            })
            .catch((error) => {
              console.error("Error removing user: ", error)
              Alert.alert("Erro", "Não foi possível excluir o usuário.")
            })
        },
      },
    ])
  }

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <View>
        <Text style={styles.userName}>{item.nome}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userRole}>{item.role}</Text>
      </View>
      <TouchableOpacity onPress={() => handleDeleteUser(item.id)}>
        <Icon name="trash-outline" size={24} color="#FF0000" />
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Painel de Administração</Text>
      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("Register")}>
        <Text style={styles.addButtonText}>Adicionar Novo Usuário</Text>
      </TouchableOpacity>
      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.userList}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F0F4F8",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#2C3E50",
  },
  addButton: {
    backgroundColor: "#2a9d8f",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  addButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  userList: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
  },
  userEmail: {
    fontSize: 14,
    color: "#7F8C8D",
  },
  userRole: {
    fontSize: 14,
    color: "#2a9d8f",
    fontWeight: "bold",
  },
})

