import React, { useEffect, useState } from 'react';
import { View, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginForm from '../components/LoginForm';
import { auth } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles/StyleLogin';

const USER_TOKEN_KEY = '@user_token';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const checkUserToken = async () => {
      try {
        const userToken = await AsyncStorage.getItem(USER_TOKEN_KEY);
        if (userToken) {
          // If a token exists, assume the user is logged in and navigate to Home
          navigation.replace('Home');
        }
      } catch (error) {
        console.error("Error checking user token:", error);
      } finally {
        setInitializing(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, store the token and navigate to Home screen
        try {
          await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid);
          navigation.replace('Home');
        } catch (error) {
          console.error("Error storing user token:", error);
        }
      }
      if (initializing) setInitializing(false);
    });

    checkUserToken();

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [navigation, initializing]);

  const handleLogin = async (email, password) => {
    if (!email || !password) {
      Alert.alert('Campos incompletos', 'Por favor, preencha todos os campos!');
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Store the user token
      await AsyncStorage.setItem(USER_TOKEN_KEY, user.uid);
      
      // Navigation will be handled by the onAuthStateChanged listener
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        Alert.alert('Login Failed', 'Your email or password is incorrect!');
      } else {
        Alert.alert('Erro de Login', 'Ocorreu um erro ao fazer login. Por favor, tente novamente.');
      }
    }
  };

  if (initializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#4c669f', '#3b5998', '#192f6a']}
          style={styles.gradientBackground}
        >
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.gradientBackground}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <LoginForm onLogin={handleLogin} />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}