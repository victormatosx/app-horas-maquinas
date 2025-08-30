"use client"

import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { useNavigation } from "@react-navigation/native"
import Sidebar from "./Sidebar"

export default function Header({ title, showBack = false, showMenu = true }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const navigation = useNavigation()

  const handleBack = () => {
    navigation.goBack()
  }

  return (
    <>
      <View style={styles.header}>
        <View style={styles.leftContainer}>
          {showMenu && !showBack && (
            <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuButton}>
              <Icon name="menu" size={24} color="#333" />
            </TouchableOpacity>
          )}
          {showBack && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  menuButton: {
    padding: 4,
    marginRight: 8,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    flexShrink: 1,
  },
  logoutButton: {
    padding: 4,
  },
})
