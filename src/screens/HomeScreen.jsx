import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import styles from '../styles/StyleHome';

const HomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem-Vindo(a)!</Text>
      
      <TouchableOpacity 
        style={styles.formButton}
        onPress={() => navigation.navigate('Formulario')}
      >
        <Text style={styles.buttonText}>Ir para o Formulário</Text>
      </TouchableOpacity>

      <View style={styles.logoutButtonContainer}>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
  ); 
};

export default HomeScreen;
