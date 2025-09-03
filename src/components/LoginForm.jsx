"use client"

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, Image, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Modal } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { Ionicons } from '@expo/vector-icons'
import styles, { colors } from "../styles/StyleLogin"

const { width } = Dimensions.get('window')

export default function LoginForm({ onLogin, loading }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showRecovery, setShowRecovery] = useState(false)
  const [isFocused, setIsFocused] = useState({
    email: false,
    password: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const navigation = useNavigation()

  const handleLogin = () => {
    Keyboard.dismiss()
    onLogin(email, password)
  }

  const handleFocus = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: true }))
  }

  const handleBlur = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: false }))
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 260, height: 260, resizeMode: 'contain' }} 
            />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>Bem-vindo de volta</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  isFocused.email && styles.inputFocused
                ]}
                placeholder="Email"
                placeholderTextColor={colors.darkGray}
                value={email}
                onChangeText={setEmail}
                onFocus={() => handleFocus('email')}
                onBlur={() => handleBlur('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.primary}
              />
            </View>

            <View style={[styles.inputContainer, isFocused.password && styles.inputFocused]}>
              <TextInput 
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor={colors.darkGray}
                value={password}
                onChangeText={setPassword}
                onFocus={() => handleFocus('password')}
                onBlur={() => handleBlur('password')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                selectionColor={colors.primary}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={24} 
                  color={colors.darkGray} 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[
                styles.button,
                (loading || !email || !password) && { opacity: 0.7 }
              ]} 
              onPress={handleLogin}
              disabled={loading || !email || !password}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Esqueceu sua senha?{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() => setShowRecovery(true)}
                >
                  Recuperar
                </Text>
                
                <Modal
                  animationType="fade"
                  transparent={true}
                  visible={showRecovery}
                  onRequestClose={() => setShowRecovery(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <Text style={styles.modalTitle}>Recuperação de Senha</Text>
                      <Text style={styles.modalText}>
                        Para recuperar sua senha, entre em contato conosco pelo e-mail contato@jragrosolutions.com ou pelo WhatsApp (34) 9 9653-2577.
                      </Text>
                      <TouchableOpacity
                        style={styles.modalButton}
                        onPress={() => setShowRecovery(false)}
                      >
                        <Text style={styles.modalButtonText}>Fechar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              </Text>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  )
}
