"use client"

import React from "react"
import { View, Text, TouchableOpacity, StyleSheet, Animated, SafeAreaView, Alert } from "react-native"
import { auth } from "../config/firebaseConfig"
import { signOut } from "firebase/auth"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"

const menuItems = [
  { id: "OrdemServicoDashboard", params: { status: "aberto" }, icon: "document-text-outline", label: "Ordens Abertas" },
  {
    id: "OrdemServicoDashboard",
    params: { status: "fechado" },
    icon: "checkmark-done-outline",
    label: "Ordens Fechadas",
  },
]

export default function Sidebar({ isOpen, onClose }) {
  const navigation = useNavigation()
  const translateX = React.useRef(new Animated.Value(-300)).current

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : -300,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [isOpen])

  const handleNavigation = (screen, params = {}) => {
    onClose()
    if (screen === "logout") {
      handleLogout()
    } else {
      navigation.navigate(screen, params)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      await AsyncStorage.multiRemove(["@user_token", "@user_role", "@user_propriedade"])
      navigation.replace("Login")
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
      Alert.alert("Erro", "Não foi possível fazer logout. Tente novamente.")
    }
  }

  if (!isOpen) return null

  return (
    <>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: translateX.interpolate({
              inputRange: [-300, 0],
              outputRange: [0, 0.5],
              extrapolate: "clamp",
            }),
          },
        ]}
      />
      <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[styles.sidebarContainer, { transform: [{ translateX }] }]}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Menu</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.menuItems}>
                {menuItems.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.id}-${index}`}
                    style={styles.menuItem}
                    onPress={() => handleNavigation(item.id, item.params)}
                  >
                    <Icon name={item.icon} size={24} color="#333" style={styles.menuIcon} />
                    <Text style={styles.menuText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.footer}>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation("logout")}>
                  <Icon name="log-out-outline" size={24} color="#e74c3c" style={styles.menuIcon} />
                  <Text style={[styles.menuText, styles.logoutText]}>Sair</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </TouchableOpacity>
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 99,
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sidebarContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: "#fff",
    zIndex: 101,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  menuItems: {
    paddingTop: 16,
  },
  footer: {
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIcon: {
    width: 40,
  },
  menuText: {
    fontSize: 16,
    color: "#333",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 8,
  },
  logoutButton: {
    marginTop: "auto",
    marginBottom: 16,
  },
  logoutText: {
    color: "#e74c3c",
    fontWeight: "600",
  },
})
