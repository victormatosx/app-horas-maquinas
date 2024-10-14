import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Picker } from '@react-native-picker/picker';
import { database } from '../config/firebaseConfig';
import { ref, get, set } from 'firebase/database';
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

export default function Component() {
  const [formData, setFormData] = useState(initialFormData);
  const [custoInsumoData, setCustoInsumoData] = useState(initialCustoInsumoData);
  const [custoOperacoesData, setCustoOperacoesData] = useState(initialCustoOperacoesData);
  const [nextId, setNextId] = useState(1);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [custoInsumoModalVisible, setCustoInsumoModalVisible] = useState(false);
  const [custoOperacoesModalVisible, setCustoOperacoesModalVisible] = useState(false);

  useEffect(() => {
    fetchNextId();
    updateCustoInsumoTotal();
    updateCustoOperacoesTotalHoras();
  }, [custoInsumoData.quantidade, custoInsumoData.valor, custoOperacoesData.horaMaquinaInicial, custoOperacoesData.horaMaquinaFinal]);

  const fetchNextId = async () => {
    const counterRef = ref(database, 'idCounter');
    const snapshot = await get(counterRef);
    if (snapshot.exists()) {
      setNextId(snapshot.val() + 1);
    } else {
      await set(counterRef, 0);
    }
  };

  const updateCustoInsumoTotal = () => {
    const quantidade = parseFloat(custoInsumoData.quantidade) || 0;
    const valor = parseFloat(custoInsumoData.valor) || 0;
    const total = (quantidade * valor).toFixed(2);
    setCustoInsumoData(prev => ({ ...prev, total }));
  };

  const updateCustoOperacoesTotalHoras = () => {
    const inicial = parseFloat(custoOperacoesData.horaMaquinaInicial) || 0;
    const final = parseFloat(custoOperacoesData.horaMaquinaFinal) || 0;
    const totalHoras = (final - inicial).toFixed(2);
    setCustoOperacoesData(prev => ({ ...prev, totalHoras }));
  };

  const handleDateConfirm = (date) => {
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    setFormData((prev) => ({ ...prev, data: formattedDate }));
    setDatePickerVisible(false);
  };

  const handleChange = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }));
  const handleCustoInsumoChange = (name, value) => setCustoInsumoData((prev) => ({ ...prev, [name]: value }));
  const handleCustoOperacoesChange = (name, value) => setCustoOperacoesData((prev) => ({ ...prev, [name]: value }));

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
        Alert.alert('Sucesso', 'Dados enviados com sucesso!');
        resetForm();
      } catch (error) {
        console.error('Error submitting form:', error);
        Alert.alert('Erro', 'Ocorreu um erro ao enviar os dados. Tente novamente.');
      }
    } else {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
    }
  };

  const isFormValid = () => {
    const requiredFields = ['ordemServico', 'data', 'direcionador', 'area', 'responsavel'];
    return requiredFields.every(field => formData[field] && formData[field].trim() !== '');
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCustoInsumoData(initialCustoInsumoData);
    setCustoOperacoesData(initialCustoOperacoesData);
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
        <Text style={styles.datePickerText}>{formData[name] || 'Selecione a Data'}</Text>
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

  const renderSummary = (title, data, fields) => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {fields.map(field => (
        <View key={field.key} style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{field.label}:</Text>
          <Text style={styles.summaryValue}>{data[field.key] || field.defaultValue}</Text>
        </View>
      ))}
    </View>
  );

  const renderModal = (visible, setVisible, title, content) => (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          {content}
          <TouchableOpacity style={styles.button} onPress={() => setVisible(false)}>
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
      {renderDropdownField("Direcionador", "direcionador", [
        { label: "Selecione um Direcionador", value: "" },
        { label: "Saf24 Alh Pl 04 - Sekita", value: "exemplo1" },
        { label: "Saf24 Alh Pl 07 - Shimada", value: "exemplo2" },
        { label: "Saf24 Ceb Pl 01 - Alvara", value: "exemplo3" },
      ], formData.direcionador, handleChange)}
      {renderInputField("Área Total", "area", formData.area, handleChange)}
      <TouchableOpacity style={styles.modalButton} onPress={() => setCustoInsumoModalVisible(true)}>
        <Text style={styles.buttonText}>Lançar Insumos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.modalButton} onPress={() => setCustoOperacoesModalVisible(true)}>
        <Text style={styles.buttonText}>Lançar Operações Mecanizadas</Text>
      </TouchableOpacity>
      {renderDropdownField("Responsável Pelo Lançamento", "responsavel", [
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
      {renderModal(
        custoInsumoModalVisible,
        setCustoInsumoModalVisible,
        "Lançamento de Insumos",
        <>
          {renderDropdownField("Insumo", "insumo", [
            { label: "Selecione o Insumo", value: "" },
            { label: "Insumo 1", value: "insumo1" },
            { label: "Insumo 2", value: "insumo2" },
            { label: "Insumo 3", value: "insumo3" },
          ], custoInsumoData.insumo, handleCustoInsumoChange)}
          {renderInputField("Quantidade", "quantidade", custoInsumoData.quantidade, handleCustoInsumoChange, 'numeric')}
          {renderInputField("Valor Unitário", "valor", custoInsumoData.valor, handleCustoInsumoChange, 'numeric')}
          {renderInputField("Observação", "observacao", custoInsumoData.observacao, handleCustoInsumoChange)}
          {renderSummary("Resumo Lançamento de Insumo", custoInsumoData, [
            { key: "insumo", label: "Insumo", defaultValue: "Não selecionado" },
            { key: "quantidade", label: "Quantidade", defaultValue: "0" },
            { key: "valor", label: "Valor Unitário", defaultValue: "0" },
            { key: "total", label: "Total", defaultValue: "0" },
          ])}
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
        </>
      )}
    </ScrollView>
  );
}