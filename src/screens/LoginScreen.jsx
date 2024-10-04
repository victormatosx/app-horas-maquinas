import React from 'react';
import { View, Alert, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LoginForm from '../components/LoginForm';
import { auth } from '../config/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles/StyleLogin';

export default function LoginScreen() {
  const navigation = useNavigation();

  const handleLogin = async (email, password) => {
    if (!email || !password) {
      Alert.alert('Campos incompletos.v', 'Por favor, preencha todos os campos!');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigation.replace('Home');
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        Alert.alert('Login Failed', 'Your email or password is incorrect!');
      } else {
        Alert.alert('E-mail ou senha inválidos.', 'Por favor, coloque E-mail e Senha válidos!');
      }
    }
  };

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