import React from 'react';
import { View, Alert, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import RegisterForm from '../components/RegisterForm';
import { auth } from '../config/firebaseConfig.jsx';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles/StyleRegister.jsx';

export default function RegisterScreen() {
  const navigation = useNavigation();

  const handleRegister = async (email, password) => {
    try {
      //verifica se o e-mail ja foi cadastrado
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      
      if (signInMethods.length > 0) {
        //se ja foi cadastrado:
        Alert.alert('E-mail já cadastrado', 'Este e-mail já foi cadastrado. Por favor, use outro e-mail ou faça login.');
        return;
      }

      //se não foi cadastrado anteriormente
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('Conta Criada!', 'Sua conta foi criada com sucesso!', [
        { text: 'OK', onPress: () => navigation.replace('Home') }
      ]);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('E-mail já cadastrado', 'Este e-mail já foi cadastrado. Por favor, use outro e-mail ou faça login.');
      } else {
        Alert.alert('Erro!', 'Sua senha precisa ter no mínimo 6 caracteres!');
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
            <RegisterForm onRegister={handleRegister} />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}