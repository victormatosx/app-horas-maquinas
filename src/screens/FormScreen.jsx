import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Picker } from '@react-native-picker/picker';
import { database } from '../config/firebaseConfig';
import { ref, get, set } from 'firebase/database';
import { X } from 'lucide-react-native';
import styles from '../styles/StyleForm';

const initialFormData = {
  ordemServico: '',
  data: '',
  direcionador: '',
  area: '',
  observacao: '',
  responsavel: '',
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

const direcionadorAreas = {
  "Saf24 Alh Pl 04 - Sekita": "10.5",
  "Saf24 Alh Pl 07 - Shimada": "15.2",
  "Saf24 Ceb Pl 01 - Alvara": "8.7",
};

const insumosData = {
  "insumo1": { nome: "Insumo 1", valor: "10.50" },
  "insumo2": { nome: "Insumo 2", valor: "15.75" },
  "insumo3": { nome: "Insumo 3", valor: "20.00" },
};

export default function FormScreen() {
  const [formData, setFormData] = useState(initialFormData);
  const [custoInsumoData, setCustoInsumoData] = useState(initialCustoInsumoData);
  const [custoOperacoesData, setCustoOperacoesData] = useState(initialCustoOperacoesData);
  const [custoMaoDeObraData, setCustoMaoDeObraData] = useState(initialCustoMaoDeObraData);
  const [nextId, setNextId] = useState(1);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [custoInsumoModalVisible, setCustoInsumoModalVisible] = useState(false);
  const [custoOperacoesModalVisible, setCustoOperacoesModalVisible] = useState(false);
  const [custoMaoDeObraModalVisible, setCustoMaoDeObraModalVisible] = useState(false);

  useEffect(() => {
    fetchNextId();
  }, []);

  useEffect(() => {
    updateCustoInsumoTotal();
  }, [custoInsumoData.quantidade, custoInsumoData.valor]);

  useEffect(() => {
    updateCustoOperacoesTotalHoras();
  }, [custoOperacoesData.horaMaquinaInicial, custoOperacoesData.horaMaquinaFinal]);

  useEffect(() => {
    if (formData.direcionador) {
      setFormData(prev => ({ ...prev, area: direcionadorAreas[formData.direcionador] || '' }));
    }
  }, [formData.direcionador]);

  useEffect(() => {
    if (custoInsumoData.insumo) {
      const selectedInsumo = insumosData[custoInsumoData.insumo];
      if (selectedInsumo) {
        setCustoInsumoData(prev => ({ ...prev, valor: selectedInsumo.valor }));
      }
    }
  }, [custoInsumoData.insumo]);

  const fetchNextId = useCallback(async () => {
    try {
      const counterRef = ref(database, 'idCounter');
      const snapshot = await get(counterRef);
      if (snapshot.exists()) {
        setNextId(snapshot.val() + 1);
      } else {
        // If the counter doesn't exist, initialize it
        await set(counterRef, 1);
        setNextId(1);
      }
    } catch (error) {
      console.error('Error fetching next ID:', error);
      // Handle the permission denied error
      if (error.message.includes('Permission denied')) {
        Alert.alert(
          'Erro de Permissão',
          'Você não tem permissão para acessar o contador de ID. Por favor, verifique suas credenciais e permissões no Firebase.'
        );
      } else {
        Alert.alert('Erro', 'Não foi possível obter o próximo ID. Por favor, tente novamente.');
      }
    }
  }, []);

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
  const handleCustoInsumoChange = useCallback((name, value) => setCustoInsumoData((prev) => ({ ...prev, [name]: value })), []);
  const handleCustoOperacoesChange = useCallback((name, value) => setCustoOperacoesData((prev) => ({ ...prev, [name]: value })), []);
  const handleCustoMaoDeObraChange = useCallback((name, value) => setCustoMaoDeObraData((prev) => ({ ...prev, [name]: value })), []);

  const handleSubmit = useCallback(async () => {
    if (isFormValid()) {
      try {
        const newEntryRef = ref(database, `apontamentos/${nextId}`);
        await set(newEntryRef, {
          id: nextId,
          ...formData,
          timestamp: Date.now(),
          custoInsumo: custoInsumoData,
          custoOperacoes: custoOperacoesData,
          custoMaoDeObra: custoMaoDeObraData
        });
        const counterRef = ref(database, 'idCounter');
        await set(counterRef, nextId);
        setNextId(nextId + 1);
        Alert.alert('Sucesso', 'Dados enviados com sucesso!');
        resetForm();
      } catch (error) {
        console.error('Error submitting form:', error);
        Alert.alert('Erro', 'Ocorreu um erro ao enviar os dados. Tente novamente.');
      }
    } else {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
    }
  }, [formData, custoInsumoData, custoOperacoesData, custoMaoDeObraData, nextId, isFormValid, resetForm]);

  const isFormValid = useCallback(() => {
    const requiredFields = ['ordemServico', 'data', 'direcionador', 'area', 'responsavel'];
    return requiredFields.every(field => formData[field] && formData[field].trim() !== '');
  }, [formData]);

  const isCustoInsumoValid = useCallback(() => {
    const requiredFields = ['insumo', 'quantidade'];
    return requiredFields.every(field => custoInsumoData[field] && custoInsumoData[field].trim() !== '');
  }, [custoInsumoData]);

  const isCustoOperacoesValid = useCallback(() => {
    const requiredFields = ['bem', 'horaMaquinaInicial', 'horaMaquinaFinal', 'bemImplemento'];
    return requiredFields.every(field => custoOperacoesData[field] && custoOperacoesData[field].trim() !== '');
  }, [custoOperacoesData]);

  const isCustoMaoDeObraValid = useCallback(() => {
    const requiredFields = ['quantidade', 'tipo', 'unidade', 'valor'];
    return requiredFields.every(field => custoMaoDeObraData[field] && custoMaoDeObraData[field].trim() !== '');
  }, [custoMaoDeObraData]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setCustoInsumoData(initialCustoInsumoData);
    setCustoOperacoesData(initialCustoOperacoesData);
    setCustoMaoDeObraData(initialCustoMaoDeObraData);
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
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity 
              onPress={() => setVisible(false)} 
              style={styles.closeButton}
              accessibilityLabel="Fechar modal"
              accessibilityHint="Toque para fechar o modal"
            >
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView>{content}</ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {renderInputField("Ordem de Serviço", "ordemServico", formData.ordemServico, handleChange)}
        {renderDatePickerField("Data", "data")}
        {renderDropdownField("Direcionador", "direcionador", [
          { label: "Selecione um Direcionador", value: "" },
          { label: "Saf24 Alh Pl 04 - Sekita", value: "Saf24 Alh Pl 04 - Sekita" },
          { label: "Saf24 Alh Pl 07 - Shimada", value: "Saf24 Alh Pl 07 - Shimada" },
          { label: "Saf24 Ceb Pl 01 - Alvara", value: "Saf24 Ceb Pl 01 - Alvara" },
        ], formData.direcionador, handleChange)}
        {renderInputField("Área Total", "area", formData.area, handleChange, 'numeric', false)}
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
        {renderDropdownField("Responsável Pelo Lançamento", "responsavel", [
          { label: "Selecione o Responsável", value: "" },
          { label: "João", value: "João" },
          { label: "Pedro", value: "Pedro" },
          { label: "Júnior", value: "Júnior" },
        ], formData.responsavel, handleChange)}
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
          {renderDropdownField("Insumo", "insumo", [
            { label: "Selecione o Insumo", value: "" },
            ...Object.entries(insumosData).map(([value, { nome }]) => ({ label: nome, value })),
          ], custoInsumoData.insumo, handleCustoInsumoChange)}
          {renderInputField("Quantidade", "quantidade", custoInsumoData.quantidade, handleCustoInsumoChange, 'numeric')}
          {renderInputField("Valor Unitário", "valor", custoInsumoData.valor, handleCustoInsumoChange, 'numeric', false)}
          {renderInputField("Observação", "observacao", custoInsumoData.observacao, handleCustoInsumoChange)}
          {renderSummary("Resumo Lançamento de Insumo", custoInsumoData, [
            { key: "insumo", label: "Insumo", defaultValue: "Não selecionado" },
            { key: "quantidade", label: "Quantidade", defaultValue: "0" },
            { key: "valor", label: "Valor Unitário", defaultValue: "0" },
            { key: "total", label: "Total", defaultValue: "0" },
          ])}
          <TouchableOpacity 
            style={[styles.button, !isCustoInsumoValid() && styles.disabledButton]} 
            onPress={() => {
              if (isCustoInsumoValid()) {
                setCustoInsumoModalVisible(false);
              } else {
                Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
              }
            }}
            accessibilityLabel="Salvar lançamento de insumo"
            accessibilityHint="Toque para salvar o lançamento de insumo"
            disabled={!isCustoInsumoValid()}
          >
            <Text style={styles.buttonText}>Salvar</Text>
          </TouchableOpacity>
        </>
      )}

      {renderModal(
        custoOperacoesModalVisible,
        setCustoOperacoesModalVisible,
        "Lançamento Operações Mecanizadas",
        <>
          {renderDropdownField("Bem", "bem", [
            { label: "Selecione o Bem", value: "" },
            { label: "Bem 1", value: "bem1" },
            { label: "Bem 2", value: "bem2" },
            { label: "Bem 3", value: "bem3" },
          ], custoOperacoesData.bem, handleCustoOperacoesChange)}
          {renderInputField("Hora Máquina Inicial", "horaMaquinaInicial", custoOperacoesData.horaMaquinaInicial, handleCustoOperacoesChange, 'numeric')}
          {renderInputField("Hora Máquina Final", "horaMaquinaFinal", custoOperacoesData.horaMaquinaFinal, handleCustoOperacoesChange, 'numeric')}
          {renderDropdownField("Bem Implemento", "bemImplemento", [
            { label: "Selecione o Bem Implemento", value: "" },
            { label: "Implemento 1", value: "implemento1" },
            { label: "Implemento 2", value: "implemento2" },
            { label: "Implemento 3", value: "implemento3" },
          ], custoOperacoesData.bemImplemento, handleCustoOperacoesChange)}
          {renderSummary("Resumo Lançamento Operações Mecanizadas", custoOperacoesData, [
            { key: "bem", label: "Bem", defaultValue: "Não selecionado" },
            { key: "horaMaquinaInicial", label: "Hora Máquina Inicial", defaultValue: "0" },
            { key: "horaMaquinaFinal", label: "Hora Máquina Final", defaultValue: "0" },
            { key: "bemImplemento", label: "Bem Implemento", defaultValue: "Não selecionado" },
            { key: "totalHoras", label: "Total de Horas", defaultValue: "0" },
          ])}
          <TouchableOpacity 
            style={[styles.button, !isCustoOperacoesValid() && styles.disabledButton]} 
            onPress={() => {
              if (isCustoOperacoesValid()) {
                setCustoOperacoesModalVisible(false);
              } else {
                Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
              }
            }}
            accessibilityLabel="Salvar lançamento de operações mecanizadas"
            accessibilityHint="Toque para salvar o lançamento de operações mecanizadas"
            disabled={!isCustoOperacoesValid()}
          >
            <Text style={styles.buttonText}>Salvar</Text>
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
          {renderDropdownField("Unidade", "unidade", [
            { label: "Selecione a Unidade", value: "" },
            { label: "Diárias", value: "Diárias" },
            { label: "Caixas", value: "Caixas" },
            { label: "Horas", value: "Horas" },
          ], custoMaoDeObraData.unidade, handleCustoMaoDeObraChange)}
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
            accessibilityLabel="Salvar lançamento de mão de obra"
            accessibilityHint="Toque para salvar o lançamento de mão de obra"
            disabled={!isCustoMaoDeObraValid()}
          >
            <Text style={styles.buttonText}>Salvar</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}