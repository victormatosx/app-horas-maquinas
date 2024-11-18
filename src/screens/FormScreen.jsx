import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, View, TextInput, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Picker } from '@react-native-picker/picker';
import { database } from '../config/firebaseConfig';
import { ref, push, set, onValue } from 'firebase/database';
import { X, Trash2, Search } from 'lucide-react-native';
import styles from '../styles/StyleForm';

const initialFormData = {
  ordemServico: '',
  data: '',
  direcionador: '',
  observacao: '',
  responsavel: '',
  atividade: '',
};

const initialCustoInsumoData = {
  insumo: '',
  quantidade: '',
  valor: '',
  total: '',
  observacao: ''
};

const initialCustoOperacoesData = {
  bem: '',
  horaMaquinaInicial: '',
  horaMaquinaFinal: '',
  totalHoras: '',
  bemImplemento: ''
};

const initialCustoMaoDeObraData = {
  quantidade: '',
  tipo: '',
  unidade: '',
  valor: '',
  observacao: ''
};

export default function FormScreen() {
  const [formData, setFormData] = useState(initialFormData);
  const [custoInsumoData, setCustoInsumoData] = useState(initialCustoInsumoData);
  const [custoOperacoesData, setCustoOperacoesData] = useState(initialCustoOperacoesData);
  const [custoMaoDeObraData, setCustoMaoDeObraData] = useState(initialCustoMaoDeObraData);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [custoInsumoModalVisible, setCustoInsumoModalVisible] = useState(false);
  const [custoOperacoesModalVisible, setCustoOperacoesModalVisible] = useState(false);
  const [custoMaoDeObraModalVisible, setCustoMaoDeObraModalVisible] = useState(false);

  const [selectedInsumos, setSelectedInsumos] = useState([]);
  const [selectedOperacoes, setSelectedOperacoes] = useState([]);
  const [selectedBemImplementos, setSelectedBemImplementos] = useState([]);

  const [insumosData, setInsumosData] = useState({});
  const [direcionadores, setDirecionadores] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [bens, setBens] = useState([]);
  const [bensImplementos, setBensImplementos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [atividade, setAtividade] = useState({});
  const [filteredAtividades, setFilteredAtividades] = useState([]);
  const [searchQueryAtividade, setSearchQueryAtividade] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredInsumos, setFilteredInsumos] = useState([]);
  const [searchQueryBem, setSearchQueryBem] = useState('');
  const [filteredBens, setFilteredBens] = useState([]);
  const [searchQueryBemImplemento, setSearchQueryBemImplemento] = useState('');
  const [filteredBensImplementos, setFilteredBensImplementos] = useState([]);

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchData = async (path, setterFunction) => {
      try {
        const dbRef = ref(database, path);
        onValue(dbRef, (snapshot) => {
          if (isMounted.current) {
            const data = snapshot.val();
            console.log(`Data fetched from ${path}:`, data);
            setterFunction(data || {});
          }
        }, (error) => {
          console.error(`Error fetching ${path}:`, error);
          if (isMounted.current) {
            setError(`Failed to load ${path}. Please try again.`);
          }
        });
      } catch (error) {
        console.error(`Error setting up listener for ${path}:`, error);
        if (isMounted.current) {
          setError(`Failed to set up listener for ${path}. Please try again.`);
        }
      }
    };

    Promise.all([
      fetchData('insumos', setInsumosData),
      fetchData('direcionadores', setDirecionadores),
      fetchData('responsaveis', setResponsaveis),
      fetchData('bens-implementos', (data) => {
        setBens(data || {});
        setBensImplementos(data || {});
      }),
      fetchData('unidades', setUnidades),
      fetchData('atividade', setAtividade),
    ]).then(() => {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }).catch((error) => {
      console.error('Error in Promise.all:', error);
      if (isMounted.current) {
        setError('Failed to load all data. Please try again.');
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    updateCustoInsumoTotal();
  }, [custoInsumoData.quantidade, custoInsumoData.valor]);

  useEffect(() => {
    updateCustoOperacoesTotalHoras();
  }, [custoOperacoesData.horaMaquinaInicial, custoOperacoesData.horaMaquinaFinal]);

  useEffect(() => {
    if (custoInsumoData.insumo && insumosData[custoInsumoData.insumo]) {
      const selectedInsumo = insumosData[custoInsumoData.insumo];
      if (selectedInsumo) {
        setCustoInsumoData(prev => ({ ...prev, valor: selectedInsumo.toString() }));
      }
    }
  }, [custoInsumoData.insumo, insumosData]);

  useEffect(() => {
    const filtered = Object.keys(insumosData).filter(key =>
      key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredInsumos(filtered);
  }, [searchQuery, insumosData]);

  useEffect(() => {
    const filtered = Object.keys(bens).filter(key =>
      bens[key].toLowerCase().includes(searchQueryBem.toLowerCase())
    );
    setFilteredBens(filtered);
  }, [searchQueryBem, bens]);

  useEffect(() => {
    const filtered = Object.keys(bensImplementos).filter(key =>
      bensImplementos[key].toLowerCase().includes(searchQueryBemImplemento.toLowerCase())
    );
    setFilteredBensImplementos(filtered);
  }, [searchQueryBemImplemento, bensImplementos]);

  useEffect(() => {
    const filtered = Object.entries(atividade)
      .filter(([key, value]) => value.toLowerCase().includes(searchQueryAtividade.toLowerCase()))
      .map(([key, value]) => ({ label: value, value: key }));
    setFilteredAtividades(filtered);
  }, [searchQueryAtividade, atividade]);

  const updateCustoInsumoTotal = useCallback(() => {
    const quantidade = parseFloat(custoInsumoData.quantidade) || 0;
    const valor = parseFloat(custoInsumoData.valor) || 0;
    const total = (quantidade * valor).toFixed(2);
    setCustoInsumoData(prev => ({ ...prev, total }));
  }, [custoInsumoData.quantidade, custoInsumoData.valor]);

  const updateCustoOperacoesTotalHoras = useCallback(() => {
    const inicial = parseFloat(custoOperacoesData.horaMaquinaInicial) || 0;
    const final = parseFloat(custoOperacoesData.horaMaquinaFinal) || 0;
    const totalHoras = (final - inicial).toFixed(2);
    setCustoOperacoesData(prev => ({ ...prev, totalHoras }));
  }, [custoOperacoesData.horaMaquinaInicial, custoOperacoesData.horaMaquinaFinal]);

  const handleDateConfirm = useCallback((date) => {
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    setFormData((prev) => ({ ...prev, data: formattedDate }));
    setDatePickerVisible(false);
  }, []);

  const handleChange = useCallback((name, value) => setFormData((prev) => ({ ...prev, [name]: value })), []);
  const handleCustoInsumoChange = useCallback((name, value) => {
    setCustoInsumoData((prev) => ({ ...prev, [name]: value }));
    if (name === 'insumo' && insumosData[value]) {
      setCustoInsumoData((prev) => ({ ...prev, valor: insumosData[value].toString() }));
    }
  }, [insumosData]);
  const handleCustoOperacoesChange = useCallback((name, value) => setCustoOperacoesData((prev) => ({ ...prev, [name]: value })), []);
  const handleCustoMaoDeObraChange = useCallback((name, value) => setCustoMaoDeObraData((prev) => ({ ...prev, [name]: value })), []);

  const handleSubmit = useCallback(async () => {
    if (isFormValid()) {
      try {
        const newEntryRef = push(ref(database, 'apontamentos'));
        const apontamentoData = {
          ...formData,
          timestamp: Date.now(),
          custoInsumo: selectedInsumos,
          custoOperacoes: selectedOperacoes.map(operacao => ({
            ...operacao,
            bemImplementos: selectedBemImplementos.filter(impl => impl.operacaoId === operacao.id)
          })),
          custoMaoDeObra: custoMaoDeObraData
        };
        await set(newEntryRef, apontamentoData);
        Alert.alert('Sucesso', 'Dados enviados com sucesso!');
        resetForm();
      } catch (error) {
        console.error('Error submitting form:', error);
        Alert.alert('Erro', 'Ocorreu um erro ao enviar os dados. Tente novamente.');
      }
    } else {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
    }
  }, [formData, selectedInsumos, selectedOperacoes, selectedBemImplementos, custoMaoDeObraData, isFormValid, resetForm]);

  const isFormValid = useCallback(() => {
    const requiredFields = ['ordemServico', 'data', 'direcionador', 'responsavel', 'atividade'];
    return requiredFields.every(field => formData[field] && formData[field].trim() !== '');
  }, [formData]);

  const isCustoInsumoValid = useCallback(() => {
    const requiredFields = ['insumo', 'quantidade'];
    return requiredFields.every(field => custoInsumoData[field] && custoInsumoData[field].trim() !== '');
  }, [custoInsumoData]);

  const isCustoOperacoesValid = useCallback(() => {
    return custoOperacoesData.bem && custoOperacoesData.bem.trim() !== '';
  }, [custoOperacoesData.bem]);

  const isCustoMaoDeObraValid = useCallback(() => {
    const requiredFields = ['quantidade', 'tipo', 'unidade', 'valor'];
    return requiredFields.every(field => custoMaoDeObraData[field] && custoMaoDeObraData[field].trim() !== '');
  }, [custoMaoDeObraData]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setCustoInsumoData(initialCustoInsumoData);
    setCustoOperacoesData(initialCustoOperacoesData);
    setCustoMaoDeObraData(initialCustoMaoDeObraData);
    setSelectedInsumos([]);
    setSelectedOperacoes([]);
    setSelectedBemImplementos([]);
  }, []);

  const renderInputField = useCallback((label, name, value, onChange, keyboardType = 'default', editable = true) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.disabledInput]}
        value={value}
        onChangeText={(text) => onChange(name, text)}
        placeholder={label}
        keyboardType={keyboardType}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  ), []);

  const renderDatePickerField = useCallback((label, name) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity 
        style={styles.input} 
        onPress={() => setDatePickerVisible(true)}
        accessibilityLabel={`Selecionar ${label}`}
        accessibilityHint="Toque para abrir o seletor de data"
      >
        <Text style={styles.datePickerText}>{formData[name] || 'Selecione a Data'}</Text>
      </TouchableOpacity>
    </View>
  ), [formData]);

  const renderDropdownField = useCallback((label, name, items, value, onChange) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={value}
          onValueChange={(value) => onChange(name, value)}
          style={styles.picker}
          accessibilityLabel={label}
        >
          <Picker.Item label={`Selecione ${label}`} value="" />
          {items.map((item) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    </View>
  ), []);

  const renderSummary = useCallback((title, data, fields) => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {fields.map(field => (
        <View key={field.key} style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{field.label}:</Text>
          <Text style={styles.summaryValue}>{data[field.key] || field.defaultValue}</Text>
        </View>
      ))}
    </View>
  ), []);

  const renderModal = useCallback((visible, setVisible, title, content) => (
    <Modal visible={visible} transparent={true} animationType="slide">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]}>{title}</Text>
            <TouchableOpacity 
              onPress={() => setVisible(false)} 
              style={[styles.closeButton, { position: 'absolute', right: 0 }]}
              accessibilityLabel="Fechar modal"
              accessibilityHint="Toque para fechar o modal"
            >
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  ), []);

  const addSelectedInsumo = useCallback(() => {
    if (isCustoInsumoValid()) {
      setSelectedInsumos(prev => [...prev, { ...custoInsumoData, id: Date.now() }]);
      setCustoInsumoData(initialCustoInsumoData);
    } else {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
    }
  }, [custoInsumoData, isCustoInsumoValid]);

  const removeSelectedInsumo = useCallback((id) => {
    setSelectedInsumos(prev => prev.filter(item => item.id !== id));
  }, []);

  const addSelectedOperacao = useCallback(() => {
    if (isCustoOperacoesValid()) {
      const newOperacao = { ...custoOperacoesData, id: Date.now() };
      setSelectedOperacoes(prev => [...prev, newOperacao]);
      setCustoOperacoesData(initialCustoOperacoesData);
    } else {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
    }
  }, [custoOperacoesData, isCustoOperacoesValid]);

  const removeSelectedOperacao = useCallback((id) => {
    setSelectedOperacoes(prev => prev.filter(item => item.id !== id));
    setSelectedBemImplementos(prev => prev.filter(item => item.operacaoId !== id));
  }, []);

  const addSelectedBemImplemento = useCallback(() => {
    if (custoOperacoesData.bemImplemento) {
      const lastOperacao = selectedOperacoes[selectedOperacoes.length - 1];
      if (lastOperacao) {
        setSelectedBemImplementos(prev => [...prev, { 
          bemImplemento: custoOperacoesData.bemImplemento, 
          id: Date.now(),
          operacaoId: lastOperacao.id
        }]);
        setCustoOperacoesData(prev => ({ ...prev, bemImplemento: '' }));
      } else {
        Alert.alert('Atenção', 'Adicione uma operação antes de adicionar um bem implemento!');
      }
    } else {
      Alert.alert('Atenção', 'Selecione um Bem Implemento!');
    }
  }, [custoOperacoesData.bemImplemento, selectedOperacoes]);

  const removeSelectedBemImplemento = useCallback((id) => {
    setSelectedBemImplementos(prev => prev.filter(item => item.id !== id));
  }, []);

  const renderSelectedItems = useCallback((items, removeFunction) => (
    <View>
      {items.map((item) => (
        <View key={item.id} style={styles.selectedItem}>
          <Text>{item.insumo || item.bem || item.bemImplemento}</Text>
          <TouchableOpacity onPress={() => removeFunction(item.id)}>
            <Trash2 size={20} color="#FF0000" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  ), []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Carregando...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>{error}</Text>
        <TouchableOpacity onPress={() => window.location.reload()}>
          <Text>Tentar novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {renderInputField("Ordem de Serviço", "ordemServico", formData.ordemServico, handleChange)}
        {renderDatePickerField("Data", "data")}
        <Text style={styles.label}>Atividade</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar atividade..."
            value={searchQueryAtividade}
            onChangeText={setSearchQueryAtividade}
          />
          <Search size={24} color="#000" style={styles.searchIcon} />
        </View>
        {renderDropdownField("", "atividade", 
          filteredAtividades.length > 0 ? filteredAtividades : Object.entries(atividade).map(([key, value]) => ({ label: value, value: key })),
          formData.atividade, 
          handleChange
        )}
        {renderDropdownField("Direcionador", "direcionador", 
          Object.entries(direcionadores).map(([key, value]) => ({ label: value, value: key })), 
          formData.direcionador, handleChange)}
        <TouchableOpacity 
          style={styles.modalButton} 
          onPress={() => setCustoInsumoModalVisible(true)}
          accessibilityLabel="Lançar Insumos"
          accessibilityHint="Toque para abrir o formulário de lançamento de insumos"
        >
          <Text style={styles.buttonText}>Lançar Insumos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.modalButton} 
          onPress={() => setCustoOperacoesModalVisible(true)}
          accessibilityLabel="Lançar Operações Mecanizadas"
          accessibilityHint="Toque para abrir o formulário de lançamento de operações mecanizadas"
        >
          <Text style={styles.buttonText}>Lançar Operações Mecanizadas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.modalButton} 
          onPress={() => setCustoMaoDeObraModalVisible(true)}
          accessibilityLabel="Lançar Mão de Obra"
          accessibilityHint="Toque para abrir o formulário de lançamento de mão de obra"
        >
          <Text style={styles.buttonText}>Lançar Mão de Obra</Text>
        </TouchableOpacity>
        {renderDropdownField("Responsável Pelo Lançamento", "responsavel", 
          Object.entries(responsaveis).map(([key, value]) => ({ label: value, value: key })), 
          formData.responsavel, handleChange)}
        {renderInputField("Observação", "observacao", formData.observacao, handleChange)}
        <TouchableOpacity 
          style={styles.buttonEnviar} 
          onPress={handleSubmit}
          accessibilityLabel="Enviar formulário"
          accessibilityHint="Toque para enviar o formulário preenchido"
        >
          <Text style={styles.buttonText}>Enviar</Text>
        </TouchableOpacity>
      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
      />

      {renderModal(
        custoInsumoModalVisible,
        setCustoInsumoModalVisible,
        "Lançamento de Insumos",
        <>
          <Text style={styles.label}>Insumos</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar insumos..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Search size={24} color="#000" style={styles.searchIcon} />
          </View>
          {renderDropdownField("", "insumo", 
            filteredInsumos.map(key => ({ label: key, value: key })), 
            custoInsumoData.insumo, handleCustoInsumoChange)}
          {renderInputField("Quantidade", "quantidade", custoInsumoData.quantidade, handleCustoInsumoChange, 'numeric')}
          {renderInputField("Valor Unitário", "valor", custoInsumoData.valor, handleCustoInsumoChange, 'numeric', false)}
          {renderInputField("Observação", "observacao", custoInsumoData.observacao, handleCustoInsumoChange)}
          <TouchableOpacity 
            style={[styles.button, !isCustoInsumoValid() && styles.disabledButton]} 
            onPress={addSelectedInsumo}
            accessibilityLabel="Adicionar insumo"
            accessibilityHint="Toque para adicionar o insumo à lista"
            disabled={!isCustoInsumoValid()}
          >
            <Text style={styles.buttonText}>Adicionar Insumo</Text>
          </TouchableOpacity>
          {renderSelectedItems(selectedInsumos, removeSelectedInsumo)}
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setCustoInsumoModalVisible(false)}
            accessibilityLabel="Salvar e sair do modal de insumos"
            accessibilityHint="Toque para salvar e sair do modal de insumos"
          >
            <Text style={styles.buttonText}>Salvar e Sair</Text>
          </TouchableOpacity>
        </>
      )}

      {renderModal(
        custoOperacoesModalVisible,
        setCustoOperacoesModalVisible,
        "Lançamento Operações Mecanizadas",
        <>
          <Text style={styles.label}>Bem</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar bem..."
              value={searchQueryBem}
              onChangeText={setSearchQueryBem}
            />
            <Search size={24} color="#000" style={styles.searchIcon} />
          </View>
          {renderDropdownField("", "bem", 
            filteredBens.map(key => ({ label: bens[key], value: key })), 
            custoOperacoesData.bem, handleCustoOperacoesChange)}
          {renderInputField("Hora Máquina Inicial", "horaMaquinaInicial", custoOperacoesData.horaMaquinaInicial, handleCustoOperacoesChange, 'numeric')}
          {renderInputField("Hora Máquina Final", "horaMaquinaFinal", custoOperacoesData.horaMaquinaFinal, handleCustoOperacoesChange, 'numeric')}
          <TouchableOpacity 
            style={[styles.button, !isCustoOperacoesValid() && styles.disabledButton]} 
            onPress={addSelectedOperacao}
            accessibilityLabel="Adicionar operação"
            accessibilityHint="Toque para adicionar a operação à lista"
            disabled={!isCustoOperacoesValid()}
          >
            <Text style={styles.buttonText}>Adicionar Operação</Text>
          </TouchableOpacity>
          {renderSelectedItems(selectedOperacoes, removeSelectedOperacao)}
          <Text style={styles.label}>Bem Implemento</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar bem implemento..."
              value={searchQueryBemImplemento}
              onChangeText={setSearchQueryBemImplemento}
            />
            <Search size={24} color="#000" style={styles.searchIcon} />
          </View>
          {renderDropdownField("", "bemImplemento", 
            filteredBensImplementos.map(key => ({ label: bensImplementos[key], value: key })), 
            custoOperacoesData.bemImplemento, handleCustoOperacoesChange)}
          <TouchableOpacity 
            style={[styles.button, !custoOperacoesData.bemImplemento && styles.disabledButton]} 
            onPress={addSelectedBemImplemento}
            accessibilityLabel="Adicionar bem implemento"
            accessibilityHint="Toque para adicionar o bem implemento à lista"
            disabled={!custoOperacoesData.bemImplemento}
          >
            <Text style={styles.buttonText}>Adicionar Bem Implemento</Text>
          </TouchableOpacity>
          {renderSelectedItems(selectedBemImplementos, removeSelectedBemImplemento)}
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setCustoOperacoesModalVisible(false)}
            accessibilityLabel="Salvar e sair do modal de operações mecanizadas"
            accessibilityHint="Toque para salvar e sair do modal de operações mecanizadas"
          >
            <Text style={styles.buttonText}>Salvar e Sair</Text>
          </TouchableOpacity>
        </>
      )}

      {renderModal(
        custoMaoDeObraModalVisible,
        setCustoMaoDeObraModalVisible,
        "Lançamento Mão de Obra",
        <>
          {renderInputField("Quantidade", "quantidade", custoMaoDeObraData.quantidade, handleCustoMaoDeObraChange, 'numeric')}
          {renderDropdownField("Tipo", "tipo", [
            { label: "Selecione o Tipo", value: "" },
            { label: "Terceirizada", value: "Terceirizada" },
          ], custoMaoDeObraData.tipo, handleCustoMaoDeObraChange)}
          {renderDropdownField("Unidade", "unidade", 
            Object.entries(unidades).map(([key, value]) => ({ label: value, value: key })), 
            custoMaoDeObraData.unidade, handleCustoMaoDeObraChange)}
          {renderInputField("Valor", "valor", custoMaoDeObraData.valor, handleCustoMaoDeObraChange, 'numeric')}
          {renderInputField("Observação", "observacao", custoMaoDeObraData.observacao, handleCustoMaoDeObraChange)}
          {renderSummary("Resumo Lançamento Mão de Obra", custoMaoDeObraData, [
            { key: "quantidade", label: "Quantidade", defaultValue: "0" },
            { key: "tipo", label: "Tipo", defaultValue: "Não selecionado" },
            { key: "unidade", label: "Unidade", defaultValue: "Não selecionado" },
            { key: "valor", label: "Valor", defaultValue: "0" },
          ])}
          <TouchableOpacity 
            style={[styles.button, !isCustoMaoDeObraValid() && styles.disabledButton]} 
            onPress={() => {
              if (isCustoMaoDeObraValid()) {
                setCustoMaoDeObraModalVisible(false);
              } else {
                Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
              }
            }}
            accessibilityLabel="Salvar e sair do lançamento de mão de obra"
            accessibilityHint="Toque para salvar e sair do lançamento de mão de obra"
            disabled={!isCustoMaoDeObraValid()}
          >
            <Text style={styles.buttonText}>Salvar e Sair</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}