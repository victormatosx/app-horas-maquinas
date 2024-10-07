import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Picker } from '@react-native-picker/picker';
import styles from '../styles/StyleForm';
import { database } from '../config/firebaseConfig';
import { ref, get, set } from 'firebase/database';

export default function Formulario() {
  const [formData, setFormData] = useState(initialFormData());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState('');
  const [nextId, setNextId] = useState(1);
  
  const [custoInsumoModalVisible, setCustoInsumoModalVisible] = useState(false);
  const [custoInsumoData, setCustoInsumoData] = useState(initialCustoInsumoData());

  const [custoOperacoesModalVisible, setCustoOperacoesModalVisible] = useState(false);
  const [custoOperacoesData, setCustoOperacoesData] = useState(initialCustoOperacoesData());

  useEffect(() => {
    const fetchNextId = async () => {
      const counterRef = ref(database, 'idCounter');
      const snapshot = await get(counterRef);
      if (snapshot.exists()) {
        setNextId(snapshot.val() + 1);
      } else {
        await set(counterRef, 0);
      }
    };

    fetchNextId();
  }, []);

  function initialFormData() {
    return {
      ordemServico: '',
      data: '',
      tipoPlantio: '',
      fazenda: '',
      pl: '',
      observacao: '',
      responsavel: '',
    };
  }

  function initialCustoInsumoData() {
    return {
      insumo: '',
      quantidade: '',
      dosagem: '',
      valor: '',
      total: '',
      observacao: ''
    };
  }

  function initialCustoOperacoesData() {
    return {
      bem: '',
      horaMaquinaInicial: '',
      horaMaquinaFinal: '',
      totalHoras: '',
      bemImplemento: ''
    };
  }

  const handleDateConfirm = (date) => {
    setFormData((prev) => ({ ...prev, data: date.toISOString().split('T')[0] }));
    setDatePickerVisible(false);
  };

  const handleTimeConfirm = (time) => {
    setFormData((prev) => ({ ...prev, [activeTimeField]: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
    setTimePickerVisible(false);
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustoInsumoChange = (name, value) => {
    setCustoInsumoData((prev) => ({ ...prev, [name]: value }));
    if (name === 'quantidade' || name === 'valor') {
      const quantidade = parseFloat(custoInsumoData.quantidade || 0);
      const valor = parseFloat(custoInsumoData.valor || 0);
      setCustoInsumoData((prev) => ({
        ...prev,
        total: (quantidade * valor).toFixed(2),
      }));
    }
  };

  const handleCustoOperacoesChange = (name, value) => {
    setCustoOperacoesData((prev) => ({ ...prev, [name]: value }));
    if (name === 'horaMaquinaInicial' || name === 'horaMaquinaFinal') {
      const inicial = parseFloat(custoOperacoesData.horaMaquinaInicial || 0);
      const final = parseFloat(custoOperacoesData.horaMaquinaFinal || 0);
      setCustoOperacoesData((prev) => ({
        ...prev,
        totalHoras: (final - inicial).toFixed(2),
      }));
    }
  };

  const handleSubmit = async () => {
    if (isFormValid()) {
      try {
        const newEntryRef = ref(database, `apontamentos/${nextId}`);
        await set(newEntryRef, {
          id: nextId,
          ...formData,
          timestamp: Date.now(),
          custoInsumo: custoInsumoData,
          custoOperacoes: custoOperacoesData
        });
        const counterRef = ref(database, 'idCounter');
        await set(counterRef, nextId);
        setNextId(nextId + 1);
        Alert.alert('Sucesso', `Dados enviados com sucesso!`);
        resetForm();
      } catch (error) {
        console.error('Error submitting form:', error);
        Alert.alert('Erro', 'Ocorreu um erro ao enviar os dados. Tente novamente.');
      }
    } else {
      Alert.alert('Atenção', 'Preencha todos os campos!');
    }
  };

  const isFormValid = () => {
    const requiredFields = { ...formData };
    delete requiredFields.observacao;
    return Object.values(requiredFields).every(Boolean);
  };
  
  const resetForm = () => {
    setFormData(initialFormData());
    setCustoInsumoData(initialCustoInsumoData());
    setCustoOperacoesData(initialCustoOperacoesData());
  };

  const renderInputField = (label, name, value, onChange, keyboardType = 'default') => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => onChange(name, text)}
        placeholder={label}
        keyboardType={keyboardType}
      />
    </View>
  );

  const renderDatePickerField = (label, name) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.input} onPress={() => setDatePickerVisible(true)}>
        <Text>{formData[name] || 'Selecione a Data'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDropdownField = (label, name, items, value, onChange) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={value}
          onValueChange={(value) => onChange(name, value)}
          style={styles.picker}
        >
          {items.map((item) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    </View>
  );

  const renderCustoInsumoModal = () => (
    <Modal visible={custoInsumoModalVisible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Custo Insumo</Text>
          {renderDropdownField("Insumo", "insumo", [
            { label: "Selecione o Insumo", value: "" },
            { label: "Insumo 1", value: "insumo1" },
            { label: "Insumo 2", value: "insumo2" },
            { label: "Insumo 3", value: "insumo3" },
          ], custoInsumoData.insumo, handleCustoInsumoChange)}
          {renderInputField("Quantidade (000,00)", "quantidade", custoInsumoData.quantidade, handleCustoInsumoChange, 'numeric')}
          {renderInputField("Dosagem (00,00)", "dosagem", custoInsumoData.dosagem, handleCustoInsumoChange, 'numeric')}
          {renderInputField("Valor", "valor", custoInsumoData.valor, handleCustoInsumoChange, 'numeric')}
          <Text style={styles.label}>Total: {custoInsumoData.total}</Text>
          {renderInputField("Observação", "observacao", custoInsumoData.observacao, handleCustoInsumoChange)}
          
          <TouchableOpacity style={styles.button} onPress={() => setCustoInsumoModalVisible(false)}>
            <Text style={styles.buttonText}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderCustoOperacoesModal = () => (
    <Modal visible={custoOperacoesModalVisible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Custo de Operações Mecanizadas</Text>
          {renderDropdownField("Bem", "bem", [
            { label: "Selecione o Bem", value: "" },
            { label: "Bem 1", value: "bem1" },
            { label: "Bem 2", value: "bem2" },
            { label: "Bem 3", value: "bem3" },
          ], custoOperacoesData.bem, handleCustoOperacoesChange)}
          {renderInputField("Hora Máquina Inicial", "horaMaquinaInicial", custoOperacoesData.horaMaquinaInicial, handleCustoOperacoesChange, 'numeric')}
          {renderInputField("Hora Máquina Final", "horaMaquinaFinal", custoOperacoesData.horaMaquinaFinal, handleCustoOperacoesChange, 'numeric')}
          <Text style={styles.label}>Total de Horas: {custoOperacoesData.totalHoras}</Text>
          {renderDropdownField("Bem Implemento", "bemImplemento", [
            { label: "Selecione o Bem Implemento", value: "" },
            { label: "Implemento 1", value: "implemento1" },
            { label: "Implemento 2", value: "implemento2" },
            { label: "Implemento 3", value: "implemento3" },
          ], custoOperacoesData.bemImplemento, handleCustoOperacoesChange)}
          
          <TouchableOpacity style={styles.button} onPress={() => setCustoOperacoesModalVisible(false)}>
            <Text style={styles.buttonText}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      {renderInputField("Ordem de Serviço", "ordemServico", formData.ordemServico, handleChange)}
      {renderDatePickerField("Data", "data")}
      {renderDropdownField("Tipo de Plantio", "tipoPlantio", [
        { label: "Selecione um Tipo de Plantio", value: "" },
        { label: "Plantio 1", value: "plantio1" },
        { label: "Plantio 2", value: "plantio2" },
        { label: "Plantio 3", value: "plantio3" },
      ], formData.tipoPlantio, handleChange)}
      {renderDropdownField("Fazenda", "fazenda", [
        { label: "Selecione a Fazenda", value: "" },
        { label: "Fazenda 1", value: "fazenda1" },
        { label: "Fazenda 2", value: "fazenda2" },
        { label: "Fazenda 3", value: "fazenda3" },
      ], formData.fazenda, handleChange)}
      {renderDropdownField("PL", "pl", [
        { label: "Selecione o PL", value: "" },
        { label: "PL 1", value: "pl1" },
        { label: "PL 2", value: "pl2" },
        { label: "PL 3", value: "pl3" },
      ], formData.pl, handleChange)}

      <TouchableOpacity style={styles.modalButton} onPress={() => setCustoInsumoModalVisible(true)}>
        <Text style={styles.buttonText}>Adicionar Custo Insumo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.modalButton} onPress={() => setCustoOperacoesModalVisible(true)}>
        <Text style={styles.buttonText}>Adicionar Custo de Operações Mecanizadas</Text>
      </TouchableOpacity>

      {renderDropdownField("Responsável", "responsavel", [
        { label: "Selecione o Responsável", value: "" },
        { label: "Responsável 1", value: "responsavel1" },
        { label: "Responsável 2", value: "responsavel2" },
        { label: "Responsável 3", value: "responsavel3" },
      ], formData.responsavel, handleChange)}

      {renderInputField("Observação", "observacao", formData.observacao, handleChange)}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Enviar</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
      />

      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerVisible(false)}
      />

      {renderCustoInsumoModal()}
      {renderCustoOperacoesModal()}
    </ScrollView>
  );
}