"use client"

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { database, auth } from '../config/firebaseConfig';
import { ref, onValue, off } from 'firebase/database';
import { signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const USER_PROPRIEDADE_KEY = "@user_propriedade";
const USER_TOKEN_KEY = "@user_token";
const USER_ROLE_KEY = "@user_role";

export default function OrdemServicoDashboard() {
  const navigation = useNavigation();
  const [ordensServico, setOrdensServico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPropriedade, setUserPropriedade] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Carregar ordens de serviço do Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const propriedade = await AsyncStorage.getItem(USER_PROPRIEDADE_KEY);
        if (!propriedade) {
          Alert.alert('Erro', 'Propriedade não encontrada. Faça login novamente.');
          navigation.navigate('Login');
          return;
        }
        setUserPropriedade(propriedade);

        const osRef = ref(database, `propriedades/${propriedade}/ordens_servico`);
        
        const onDataChange = (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const ordensArray = Object.entries(data).map(([id, os]) => ({
              id,
              ...os,
              // Garante que as datas sejam tratadas corretamente
              data: os.data || new Date().toISOString(),
            }));
            // Ordena por data mais recente primeiro
            ordensArray.sort((a, b) => new Date(b.data) - new Date(a.data));
            setOrdensServico(ordensArray);
          } else {
            setOrdensServico([]);
          }
          setLoading(false);
          setRefreshing(false);
        };

        onValue(osRef, onDataChange);

        return () => off(osRef, 'value', onDataChange);
      } catch (error) {
        console.error('Erro ao carregar ordens de serviço:', error);
        Alert.alert('Erro', 'Não foi possível carregar as ordens de serviço.');
        setLoading(false);
        setRefreshing(false);
      }
    };

    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // A recarga será tratada pelo listener do Firebase no useEffect
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.multiRemove([USER_TOKEN_KEY, USER_ROLE_KEY, USER_PROPRIEDADE_KEY]);
      navigation.replace('Login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      Alert.alert('Erro', 'Não foi possível fazer logout. Tente novamente.');
    }
  };

  const handleOrdemServicoPress = (ordem) => {
    navigation.navigate('OrdemServico', { ordemId: ordem.id });
  };

  const formatarData = (dataString) => {
    try {
      const data = new Date(dataString);
      if (isNaN(data.getTime())) return 'Data inválida';
      
      return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Data inválida';
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => handleOrdemServicoPress(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.equipamento} numberOfLines={1}>
          {item.equipamento || 'Sem equipamento'}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'concluido' ? '#4CAF50' : '#FFC107' }
        ]}>
          <Text style={styles.statusText}>
            {item.status === 'concluido' ? 'Concluído' : 'Pendente'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.descricao} numberOfLines={2}>
        {item.descricao || 'Sem descrição'}
      </Text>
      
      <View style={styles.cardFooter}>
        <Text style={styles.data}>
          {formatarData(item.data)}
        </Text>
        <Icon name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ordens de Serviço</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="log-out-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={ordensServico}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="document-text-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>Nenhuma ordem de serviço encontrada</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: {
    padding: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  equipamento: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  descricao: {
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  data: {
    color: '#888',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    color: '#888',
    textAlign: 'center',
    fontSize: 16,
  },
});
