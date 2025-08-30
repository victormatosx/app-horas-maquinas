"use client"

import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Menu, ArrowLeft } from "lucide-react-native"
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
              <Menu size={28} color="#0f505b" />
            </TouchableOpacity>
          )}
          {showBack && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <ArrowLeft size={24} color="#0f505b" />
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
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: "transparent",
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
    marginRight: 12,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f505b",
    flexShrink: 1,
  },
})
