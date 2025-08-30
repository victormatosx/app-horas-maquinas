"use client"

import React, { useEffect, useState, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Animated, SafeAreaView, Alert } from "react-native"
import { auth } from "../config/firebaseConfig"
import { signOut } from "firebase/auth"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNavigation } from "@react-navigation/native"
import { FileText, FileCheck2, LogOut, X, UserCircle } from "lucide-react-native"

const menuItems = [
  { id: "OrdemServicoDashboard", params: { status: "aberto" }, icon: FileText, label: "Ordens Abertas" },
  { id: "OrdemServicoDashboard", params: { status: "fechado" }, icon: FileCheck2, label: "Ordens Fechadas" },
]

export default function Sidebar({ isOpen, onClose }) {
  const navigation = useNavigation()
  const translateX = useRef(new Animated.Value(-300)).current
  const [userName, setUserName] = useState("Usuário")
  const [userPropriedade, setUserPropriedade] = useState("")

  useEffect(() => {
    if (isOpen) {
      const loadUserData = async () => {
        try {
          const name = await AsyncStorage.getItem("@user_name")
          const property = await AsyncStorage.getItem("@user_propriedade")
          setUserName(name || "Usuário")
          setUserPropriedade(property || "")
        } catch (error) {
          console.error("Failed to load user data from storage", error)
        }
      }
      loadUserData()
    }
  }, [isOpen])

  useEffect(() => {
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
      await AsyncStorage.multiRemove(["@user_token", "@user_role", "@user_propriedade", "@user_name"])
      navigation.replace("Login")
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
      Alert.alert("Erro", "Não foi possível fazer logout. Tente novamente.")
    }
  }

  if (!isOpen) return null

  return (
    <>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: translateX.interpolate({
                inputRange: [-300, 0],
                outputRange: [0, 0.7],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      </TouchableOpacity>
      <Animated.View style={[styles.sidebarContainer, { transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileContainer}>
            <View style={styles.avatar}>
              <UserCircle size={50} color="#0f505b" strokeWidth={1.5} />
            </View>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileProperty}>{userPropriedade}</Text>
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.menuItems}>
              {menuItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <TouchableOpacity
                    key={`${item.id}-${index}`}
                    style={styles.menuItem}
                    onPress={() => handleNavigation(item.id, item.params)}
                  >
                    <Icon size={22} color="#fff" style={styles.menuIcon} />
                    <Text style={styles.menuText}>{item.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation("logout")}>
                <LogOut size={22} color="#fff" style={styles.menuIcon} />
                <Text style={styles.menuText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 99,
  },
  sidebarContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: "#0f505b",
    zIndex: 100,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: "flex-end",
    padding: 16,
  },
  closeButton: {
    padding: 4,
  },
  profileContainer: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  profileProperty: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  menuItems: {},
  footer: {
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  menuIcon: {
    marginRight: 20,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
})
