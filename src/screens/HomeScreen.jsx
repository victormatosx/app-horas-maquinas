import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { database, auth } from '../config/firebaseConfig';
import { ref, onValue, off } from 'firebase/database';
import { signOut } from 'firebase/auth';

const USER_TOKEN_KEY = '@user_token';

export default function HomeScreen() {
  const [apontamentos, setApontamentos] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [filtroResponsavel, setFiltroResponsavel] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' for most recent, 'asc' for oldest
  const navigation = useNavigation();

  useEffect(() => {
    const apontamentosRef = ref(database, 'apontamentos');
    const listener = onValue(apontamentosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const apontamentosArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
        }));
        
        sortApontamentos(apontamentosArray);
        
        const uniqueResponsaveis = [...new Set(apontamentosArray.map(item => item.responsavel))];
        setResponsaveis(uniqueResponsaveis);
      }
    });

    return () => off(apontamentosRef, 'value', listener);
  }, []);

  const sortApontamentos = (apontamentosArray) => {
    const sortedApontamentos = [...apontamentosArray].sort((a, b) => {
      const dateA = new Date(a.data.split('/').reverse().join('-'));
      const dateB = new Date(b.data.split('/').reverse().join('-'));
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    setApontamentos(sortedApontamentos);
  };

  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newSortOrder);
    sortApontamentos(apontamentos);
  };

  const filteredApontamentos = filtroResponsavel
    ? apontamentos.filter(item => item.responsavel === filtroResponsavel)
    : apontamentos;

  const renderApontamento = ({ item }) => (
    <View style={styles.apontamentoItem}>
      <Text style={styles.data}>{item.data}</Text>
      <Text style={styles.responsavel}>{item.responsavel}</Text>
      <Text style={styles.direcionador}>{item.direcionador}</Text>
      <Text style={styles.ordemServico}>OS: {item.ordemServico}</Text>
    </View>
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem(USER_TOKEN_KEY);
      navigation.replace('Login');
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert('Erro ao sair', 'Ocorreu um erro ao tentar sair. Por favor, tente novamente.');
    }
  };

  const renderFooter = () => (
    <TouchableOpacity
      style={styles.sairButton}
      onPress={handleLogout}
    >
      <Icon name="log-out-outline" size={24} color="white" />
      <Text style={styles.sairButtonText}>SAIR</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.novoButton}
          onPress={() => navigation.navigate('Formulario')}
        >
          <Icon name="add-circle-outline" size={28} color="white" />
          <Text style={styles.novoButtonText}>NOVO APONTAMENTO</Text>
        </TouchableOpacity>

        <View style={styles.filtroContainer}>
          <Text style={styles.filtroLabel}>Filtrar por responsável:</Text>
          <FlatList
            data={responsaveis}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filtroItem,
                  filtroResponsavel === item && styles.filtroItemActive
                ]}
                onPress={() => setFiltroResponsavel(filtroResponsavel === item ? null : item)}
              >
                <Text style={[
                  styles.filtroItemText,
                  filtroResponsavel === item && styles.filtroItemTextActive
                ]}>{item}</Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item}
          />
        </View>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={toggleSortOrder}
        >
          <Icon name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} size={24} color="white" />
          <Text style={styles.sortButtonText}>
            {sortOrder === 'desc' ? 'Mais antigo' : 'Mais recente'}
          </Text>
        </TouchableOpacity>

        <FlatList
          data={filteredApontamentos}
          renderItem={renderApontamento}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.apontamentosList}
          ListFooterComponent={renderFooter}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#2a9d8f',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F0F4F8',
  },
  novoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a9d8f',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 4,
  },
  novoButtonText: {
    color: 'white',
    marginLeft: 12,
    fontSize: 18,
    fontWeight: 'bold',
  },
  filtroContainer: {
    marginBottom: 24,
  },
  filtroLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2C3E50',
  },
  filtroItem: {
    backgroundColor: '#F0F4F8',
    padding: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#2a9d8f',
  },
  filtroItemActive: {
    backgroundColor: '#2a9d8f',
  },
  filtroItemText: {
    color: '#2a9d8f',
    fontWeight: '600',
  },
  filtroItemTextActive: {
    color: 'white',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a9d8f',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 4,
  },
  sortButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  apontamentosList: {
    paddingBottom: 16,
  },
  apontamentoItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  data: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  responsavel: {
    fontSize: 16,
    color: '#2a9d8f',
    fontWeight: '600',
    marginBottom: 4,
  },
  direcionador: {
    fontSize: 16,
    color: '#34495E',
    marginBottom: 4,
  },
  ordemServico: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  sairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    elevation: 4,
  },
  sairButtonText: {
    color: 'white',
    marginLeft: 12,
    fontSize: 18,
    fontWeight: 'bold',
  },
});