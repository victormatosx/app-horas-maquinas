import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Picker } from '@react-native-picker/picker';
import styles from '../styles/StyleForm';
import { database } from '../config/firebaseConfig';
import { ref, push, get, set } from 'firebase/database';

export default function Formulario() {
  const [formData, setFormData] = useState(initialFormData());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState('');
  const [nextId, setNextId] = useState(1);

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
      atividade: '',
      fase: '',
      maquinario: '',
      nomeTrabalhador: '',
      horaInicialTrabalhador: '',
      horaFinalTrabalhador: '',
      maquina: '',
      implemento: '',
      horaMaquinaInicial: '',
      horaMaquinaFinal: '',
      valorHoraMaquina: '',
      tipoPlantio: '',
      fazenda: '',
      pl: '',
      area: '',
      insumo: '',
      insumoGasto: '',
      dosagem: '',
      observacao: '',
      responsavel: '',
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

  const handleSubmit = async () => {
    if (isFormValid()) {
      try {
        const newEntryRef = ref(database, `apontamentos/${nextId}`);
        await set(newEntryRef, {
          id: nextId,
          ...formData,
          timestamp: Date.now()
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
    delete requiredFields.observacao; // Remove o campo 'observacao' da validação
  
    return Object.values(requiredFields).every(Boolean);
  };
  

  const resetForm = () => setFormData(initialFormData());

  const renderInputField = (label, name) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={formData[name]}
        onChangeText={(text) => handleChange(name, text)}
        placeholder={label}
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

  const renderTimePickerField = (label, name) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity 
        style={styles.input} 
        onPress={() => {
          setActiveTimeField(name);
          setTimePickerVisible(true);
        }}
      >
        <Text>{formData[name] || 'Selecione o Horário'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDropdownField = (label, name, items) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={formData[name]}
          onValueChange={(value) => handleChange(name, value)}
          style={styles.picker}
        >
          {items.map((item) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Apontamento Custos e Horas Máquinas</Text>

      {renderInputField("Ordem de Serviço", "ordemServico")}
      {renderDatePickerField("Data", "data")}
      {renderDropdownField("Atividade", "atividade", [
        { label: "Selecione uma Atividade", value: "" },
        { label: "Atividade 1", value: "atividade1" },
        { label: "Atividade 2", value: "atividade2" },
        { label: "Atividade 3", value: "atividade3" },
      ])}
      {renderDropdownField("Fase", "fase", [
        { label: "Selecione uma Fase", value: "" },
        { label: "Fase 1", value: "fase1" },
        { label: "Fase 2", value: "fase2" },
        { label: "Fase 3", value: "fase3" },
      ])}
      {renderDropdownField("Maquinário", "maquinario", [
        { label: "Selecione um Maquinário", value: "" },
        { label: "Maquinário 1", value: "maquinario1" },
        { label: "Maquinário 2", value: "maquinario2" },
        { label: "Maquinário 3", value: "maquinario3" },
      ])}
      {renderDropdownField("Nome do Trabalhador", "nomeTrabalhador", [
        { label: "Selecione um Trabalhador", value: "" },
        { label: "Trabalhador 1", value: "trabalhador1" },
        { label: "Trabalhador 2", value: "trabalhador2" },
        { label: "Trabalhador 3", value: "trabalhador3" },
      ])}
      {renderTimePickerField("Hora do Trabalhador Inicial", "horaInicialTrabalhador")}
      {renderTimePickerField("Hora do Trabalhador Final", "horaFinalTrabalhador")}
      {renderDropdownField("Máquina", "maquina", [
        { label: "Selecione uma Máquina", value: "" },
        { label: "Máquina 1", value: "maquina1" },
        { label: "Máquina 2", value: "maquina2" },
        { label: "Máquina 3", value: "maquina3" },
      ])}
      {renderDropdownField("Implemento", "implemento", [
        { label: "Selecione um Implemento", value: "" },
        { label: "Implemento 1", value: "implemento1" },
        { label: "Implemento 2", value: "implemento2" },
        { label: "Implemento 3", value: "implemento3" },
      ])}
      {renderTimePickerField("Hora Máquina Inicial", "horaMaquinaInicial")}
      {renderTimePickerField("Hora Máquina Final", "horaMaquinaFinal")}
      {renderInputField("Valor da Hora Máquina", "valorHoraMaquina")}
      {renderDropdownField("Tipo do Plantio", "tipoPlantio", [
        { label: "Selecione um Tipo do Plantio", value: "" },
        { label: "Alho", value: "alho" },
        { label: "Cebola", value: "cebola" },
        { label: "Cenoura", value: "cenoura" },
        { label: "Brachiara", value: "brachiara" },
        { label: "Futura Braquiaria", value: "futuraBraquiaria" },
        { label: "Terra Vazia", value: "terraVazia" },
      ])}
      {renderDropdownField("Fazenda", "fazenda", [
        { label: "Selecione uma Fazenda", value: "" },
        { label: "Fazenda 1", value: "fazenda1" },
        { label: "Fazenda 2", value: "fazenda2" },
        { label: "Fazenda 3", value: "fazenda3" },
      ])}
      {renderDropdownField("PL", "pl", [
        { label: "Selecione um PL", value: "" },
        { label: "PL 1", value: "pl1" },
        { label: "PL 2", value: "pl2" },
        { label: "PL 3", value: "pl3" },
      ])}
      {renderInputField("Área", "area")}
      {renderDropdownField("Insumo", "insumo", [
        { label: "Selecione um Insumo", value: "" },
        { label: "Fertilizante", value: "fertilizante" },
        { label: "Adubo", value: "adubo" },
        { label: "Defensivo", value: "defensivo" },
        { label: "Semente", value: "semente" },
      ])}
      {renderInputField("Insumo Gasto", "insumoGasto")}
      {renderInputField("Dosagem", "dosagem")}
      {renderInputField("Observação", "observacao")}
      {renderDropdownField("Responsável Pelo Lançamento", "responsavel", [
        { label: "Selecione um Responsável", value: "" },
        { label: "Responsável 1", value: "responsavel1" },
        { label: "Responsável 2", value: "responsavel2" },
        { label: "Responsável 3", value: "responsavel3" },
      ])}

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

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Finalizar Apontamento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}