"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
  FlatList,
  Linking,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { Picker } from "@react-native-picker/picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ChevronDown } from "lucide-react-native"
import { Image } from 'react-native';

import * as FileSystem from 'expo-file-system';

// Importações compatíveis com Expo
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Asset } from 'expo-asset' // Importar Asset

// Importar Firebase
import { database } from "../config/firebaseConfig"
import { ref, push, set, onValue } from "firebase/database"

// Importar a logo
import matriceLogo from '../../assets/matriceLogo.png';

const COLORS = {
  primary: "#8b5cf6",
  primaryLight: "#f3f4f6",
  secondary: "#64748b",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  background: "#f8fafc",
  white: "#ffffff",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1e293b",
  gray900: "#0f172a",
}

const STORAGE_KEYS = {
  VENDAS: "@vendas",
  USER_PROPRIEDADE: "@user_propriedade",
  USER_ID: "@user_id",
}

// Dados para os campos de seleção (mantidos para outros campos)
const SELECTION_DATA = {
  // Clientes serão carregados do Firebase
  formasPagamento: [
    { id: "vista", name: "À Vista" },
    { id: "prazo", name: "A Prazo" },
    { id: "bonificacao", name: "Bonificação" },
    { id: "outras", name: "Outras Entradas" },
  ],
  // Variedades e Talhões serão carregados do Firebase
  // Classificações serão carregadas do Firebase
  // Embalagens serão carregadas do Firebase
  // TiposProduto serão carregados do Firebase
}

// Função para formatar números para o padrão brasileiro (R$ X.XXX,XX)
const formatCurrencyBRL = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  const number = parseFloat(value);
  if (isNaN(number)) return 'R$ 0,00';

  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


// Classe para gerenciar PDF com expo-print
class PDFManager {
  static async generateAndShareSalesReport(vendaData, propriedadeNome, logoUri) {
    try {
      const htmlContent = this.generateHTMLContent(vendaData, propriedadeNome, logoUri)

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false, // Não precisamos do base64 para compartilhar o URI
      })

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Compartilhamento não disponível', 'A funcionalidade de compartilhamento não está disponível neste dispositivo.')
        return
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar Relatório de Venda',
        UTI: 'com.adobe.pdf', // Para iOS
      })

      return uri // Retorna a URI caso precise ser usada para algo mais

    } catch (error) {
      console.error('Erro ao gerar e compartilhar PDF:', error)
      Alert.alert('Erro', 'Falha ao gerar ou compartilhar o relatório PDF.')
      throw error // Propaga o erro para quem chamou
    }
  }

  static generateHTMLContent(vendaData, propriedadeNome, logoUri) {
    const itensHTML = vendaData.itens.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.tipoProduto || '-'}</td>
        <td>${item.variedade || '-'}</td>
        <td>${item.talhao || '-'}</td>
        <td>${item.classificacao || '-'}</td>
        <td>${item.embalagem || '-'}</td>
        <td class="numeric">${item.quantidade}</td>
        <td class="numeric">${formatCurrencyBRL(item.preco)}</td>
        <td class="numeric">${formatCurrencyBRL(item.valorTotal)}</td>
      </tr>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Venda</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #8b5cf6;
            padding-bottom: 15px;
          }
          .header-left {
            flex: 1;
          }
          .header-right {
            flex: 1;
            text-align: right;
          }
          .logo {
            max-width: 100px; /* Ajuste conforme necessário */
            height: auto;
          }
          .report-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-top: 5px;
          }

          .info-section { margin-bottom: 15px; }
          .info-title { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .info-grid { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-bottom: 10px; } /* Ajustado para flexbox */
          .info-item { display: flex; width: calc(50% - 10px); } /* Ajustado para 2 colunas */
          .info-label { font-weight: bold; margin-right: 5px; min-width: 100px; } /* Ajustado min-width */
          .info-value { flex: 1; } /* Permite que o valor ocupe o espaço restante */

          .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; } /* Fonte menor para a tabela */
          .items-table th { background-color: #8b5cf6; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; } /* Padding menor */
          .items-table td { border: 1px solid #ddd; padding: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* Padding menor, nowrap, ellipsis */
          .items-table td:nth-child(1) { width: 5%; } /* Item */
          .items-table td:nth-child(2) { width: 10%; } /* Produto */
          .items-table td:nth-child(3) { width: 15%; } /* Variedade */
          .items-table td:nth-child(4) { width: 10%; } /* Talhão */
          .items-table td:nth-child(5) { width: 10%; } /* Classificação */
          .items-table td:nth-child(6) { width: 10%; } /* Embalagem */
          .items-table td:nth-child(7) { width: 10%; text-align: right; } /* Quantidade */
          .items-table td:nth-child(8) { width: 10%; text-align: right; } /* Preço Unit. */
          .items-table td:nth-child(9) { width: 10%; text-align: right; } /* Subtotal */

          .numeric { text-align: right; } /* Classe para alinhar números à direita */

          .total-section { margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #ddd; }
          .total-label { font-size: 14px; font-weight: bold; color: #333; margin-right: 10px; }
          .total-value { font-size: 18px; font-weight: bold; color: #8b5cf6; }

          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
          .company-footer { font-size: 12px; font-weight: bold; color: #8b5cf6; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${logoUri ? `<img src="${logoUri}" class="logo" alt="Logo da Fazenda" />` : ''}
          </div>
          <div class="header-right">
            <div class="report-title">Relatório de Venda</div>
            <div class="app-name">Sistema de Gestão Agrícola</div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-title">Informações da Venda</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Cliente:</span>
              <span class="info-value">${vendaData.cliente}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data do Pedido:</span>
              <span class="info-value">${vendaData.dataPedido}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Forma de Pagamento:</span>
              <span class="info-value">${vendaData.formaPagamento}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data Carregamento:</span>
              <span class="info-value">${vendaData.dataCarregamento}</span>
            </div>
             ${vendaData.formaPagamentoId === "prazo" && vendaData.prazoDias ? `
              <div class="info-item">
                <span class="info-label">Prazo:</span>
                <span class="info-value">${vendaData.prazoDias} dias</span>
              </div>
            ` : ''}
             ${vendaData.observacaoPagamento ? `
              <div class="info-item" style="width: 100%;">
                <span class="info-label">Observação Pagamento:</span>
                <span class="info-value">${vendaData.observacaoPagamento}</span>
              </div>
            ` : ''}
          </div>
           ${vendaData.observacao ? `
            <div class="info-item" style="width: 100%;">
              <span class="info-label">Observações Gerais:</span>
              <span class="info-value">${vendaData.observacao}</span>
            </div>
          ` : ''}
        </div>

        <div class="info-section">
          <div class="info-title">Itens da Venda</div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Produto</th>
                <th>Variedade</th>
                <th>Talhão</th>
                <th>Classificação</th>
                <th>Embalagem</th>
                <th class="numeric">Quant.</th>
                <th class="numeric">Preço Unit.</th>
                <th class="numeric">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itensHTML}
            </tbody>
          </table>
        </div>

        <div class="total-section">
          <span class="total-label">Total do Pedido:</span>
          <span class="total-value">${formatCurrencyBRL(vendaData.valorTotal)}</span>
        </div>

        <div class="footer">
          <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
          <p>Propriedade: ${propriedadeNome}</p>
          <div class="company-footer">J. R. AgSolutions</div>
        </div>
      </body>
      </html>
    `
  }
}

// Componente para Modal de Sucesso
const SuccessModal = ({ visible, onClose, onGenerateAndSharePDF, isGeneratingPDF }) => {
  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.successModalOverlay}>
        <View style={styles.successModalContainer}>
          <View style={styles.successModalContent}>
            {/* Ícone de Sucesso */}
            <View style={styles.successIconContainer}>
              <MaterialIcons name="check-circle" size={60} color={COLORS.success} />
            </View>

            {/* Título */}
            <Text style={styles.successTitle}>Venda Registrada com Sucesso!</Text>

            {/* Mensagem */}
            <Text style={styles.successMessage}>
              Sua venda foi salva e está disponível no sistema.
            </Text>

            {/* Botões de Ação */}
            <View style={styles.successActions}>
              {/* Botão Gerar e Compartilhar PDF */}
              <TouchableOpacity
                style={[styles.successButton, styles.whatsappButton]} // Usando cor verde para compartilhar
                onPress={onGenerateAndSharePDF}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <MaterialIcons name="share" size={20} color={COLORS.white} />
                    <Text style={styles.successButtonText}>Gerar e Compartilhar PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Botão Fechar */}
              <TouchableOpacity
                style={[styles.successButton, styles.closeButton]}
                onPress={onClose}
              >
                <Text style={[styles.successButtonText, { color: COLORS.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// O visualizador de PDF integrado foi removido.
// A visualização ocorrerá em um app externo após o compartilhamento ou abertura do arquivo.

export default function SalesScreen() {
  const navigation = useNavigation()
  const scrollViewRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [propriedadeNome, setPropriedadeNome] = useState("")
  const [userId, setUserId] = useState("")
  const [logoUri, setLogoUri] = useState(null); // Estado para armazenar a URI da logo

  // Estados para o modal de sucesso e PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  // pdfUri não é mais necessário no estado do componente principal, pois é gerado e compartilhado na mesma função
  const [lastSaleData, setLastSaleData] = useState(null)

  // Estado para armazenar os direcionadores do Firebase
  const [direcionadores, setDirecionadores] = useState([]);
  // Estado para armazenar as classificações do Firebase
  const [classificacoes, setClassificacoes] = useState([]);
  // Estado para armazenar as embalagens do Firebase
  const [embalagens, setEmbalagens] = useState([]);
  // Estado para armazenar os tipos de produto do Firebase
  const [tiposProduto, setTiposProduto] = useState([]);
  // Estado para armazenar os clientes do Firebase
  const [clientes, setClientes] = useState([]);


  const [formData, setFormData] = useState({
    dataPedido: new Date(),
    cliente: "",
    clienteId: "",
    formaPagamento: "",
    formaPagamentoId: "",
    prazoDias: "",
    dataCarregamento: new Date(),
    observacao: "",
    observacaoPagamento: "", // Novo campo para observação de pagamento
  })

  const [items, setItems] = useState([
    {
      id: "1",
      talhao: "",
      talhaoId: "",
      variedade: "",
      variedadeId: "", // VariedadeId não é usado no Firebase, mas mantido por consistência
      classificacao: "",
      classificacaoId: "",
      quantidade: "",
      embalagem: "",
      embalagemId: "",
      preco: "",
      valorTotal: 0,
      tipoProduto: "",
    },
  ])

  const [showItemsModal, setShowItemsModal] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerField, setDatePickerField] = useState("")

  // Estados para modal de seleção
  const [isListModalVisible, setListModalVisible] = useState(false)
  const [listModalType, setListModalType] = useState("")
  const [listModalData, setListModalData] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentItemId, setCurrentItemId] = useState(null)

  // Carregar informações do usuário atual e a URI da logo
  useEffect(() => {
    const loadUserDataAndLogo = async () => {
      try {
        const storedPropriedade = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROPRIEDADE)
        const storedUserId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID)

        setPropriedadeNome(storedPropriedade || "Matrice")
        setUserId(storedUserId || `user_${Date.now()}`)

        // Se não existir, criar um ID de usuário único
        if (!storedUserId) {
          const newUserId = `user_${Date.now()}`
          await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, newUserId)
          setUserId(newUserId)
        }

        // Se não existir propriedade, definir padrão
        if (!storedPropriedade) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_PROPRIEDADE, "Matrice")
          setPropriedadeNome("Matrice")
        }

        // Carregar a URI da logo e converter para Base64
        const asset = Asset.fromModule(matriceLogo);
        await asset.downloadAsync();
        const base64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const base64Uri = `data:image/png;base64,${base64}`;
        setLogoUri(base64Uri);


      } catch (error) {
        console.error("Erro ao carregar dados do usuário ou logo:", error)
        setPropriedadeNome("Matrice")
        setUserId(`user_${Date.now()}`)
        setLogoUri(null); // Definir como null em caso de erro
      }
    }

    loadUserDataAndLogo()
  }, [])

  // Efeito para carregar os direcionadores, classificações, embalagens, tipos de produto e clientes do Firebase
  useEffect(() => {
    if (!propriedadeNome) return; // Espera o nome da propriedade ser carregado

    // Carregar Direcionadores (Talhões e Variedades)
    const direcionadoresRef = ref(database, `propriedades/${propriedadeNome}/direcionadores`);
    const unsubscribeDirecionadores = onValue(direcionadoresRef, (snapshot) => {
      const data = snapshot.val();
      const loadedDirecionadores = [];
      if (data) {
        Object.keys(data).forEach(key => {
          loadedDirecionadores.push({
            id: key,
            ...data[key]
          });
        });
      }
      setDirecionadores(loadedDirecionadores);
    }, (error) => {
      console.error("Erro ao carregar direcionadores do Firebase:", error);
      Alert.alert("Erro", "Não foi possível carregar a lista de talhões e variedades.");
    });

    // Carregar Classificações
    const classificacoesRef = ref(database, `propriedades/${propriedadeNome}/classificacao`);
    const unsubscribeClassificacoes = onValue(classificacoesRef, (snapshot) => {
      const data = snapshot.val();
      const loadedClassificacoes = [];
      if (data) {
        Object.keys(data).forEach(key => {
          // Usar a chave 'Descrição' como nome e o ID do Firebase como id
          loadedClassificacoes.push({
            id: key,
            name: data[key].Descrição || `Classificação ${key}` // Usar Descrição ou um fallback
          });
        });
      }
      setClassificacoes(loadedClassificacoes);
    }, (error) => {
      console.error("Erro ao carregar classificações do Firebase:", error);
      Alert.alert("Erro", "Não foi possível carregar a lista de classificações.");
    });

    // Carregar Embalagens
    const embalagensRef = ref(database, `propriedades/${propriedadeNome}/embalagens`);
    const unsubscribeEmbalagens = onValue(embalagensRef, (snapshot) => {
      const data = snapshot.val();
      const loadedEmbalagens = [];
      if (data) {
        Object.keys(data).forEach(key => {
          // Usar a chave 'descricao' como nome e o ID do Firebase como id
          loadedEmbalagens.push({
            id: key,
            name: data[key].descricao || `Embalagem ${key}` // Usar descricao ou um fallback
          });
        });
      }
      setEmbalagens(loadedEmbalagens);
    }, (error) => {
      console.error("Erro ao carregar embalagens do Firebase:", error);
      Alert.alert("Erro", "Não foi possível carregar a lista de embalagens.");
    });

     // Carregar Tipos de Produto (culturaAssociada)
     const tiposProdutoRef = ref(database, `propriedades/${propriedadeNome}/direcionadores`); // Assumindo que culturaAssociada está dentro de direcionadores
     const unsubscribeTiposProduto = onValue(tiposProdutoRef, (snapshot) => {
       const data = snapshot.val();
       const loadedTiposProduto = [];
       const uniqueCulturas = new Set(); // Usar um Set para garantir unicidade
       if (data) {
         Object.keys(data).forEach(key => {
           if (data[key].culturaAssociada && !uniqueCulturas.has(data[key].culturaAssociada)) {
             uniqueCulturas.add(data[key].culturaAssociada);
             loadedTiposProduto.push({
               id: data[key].culturaAssociada, // Usar a culturaAssociada como ID e nome
               name: data[key].culturaAssociada
             });
           }
         });
       }
       setTiposProduto(loadedTiposProduto);
     }, (error) => {
       console.error("Erro ao carregar tipos de produto do Firebase:", error);
       Alert.alert("Erro", "Não foi possível carregar a lista de tipos de produto.");
     });

     // Carregar Clientes
     const clientesRef = ref(database, `propriedades/${propriedadeNome}/clientes`);
     const unsubscribeClientes = onValue(clientesRef, (snapshot) => {
       const data = snapshot.val();
       const loadedClientes = [];
       if (data) {
         Object.keys(data).forEach(key => {
           // Usar a chave 'Nome' como nome e o ID do Firebase como id
           if (data[key].Nome) { // Garantir que o cliente tem um nome
             loadedClientes.push({
               id: key,
               name: data[key].Nome
             });
           }
         });
       }
       setClientes(loadedClientes);
     }, (error) => {
       console.error("Erro ao carregar clientes do Firebase:", error);
       Alert.alert("Erro", "Não foi possível carregar a lista de clientes.");
     });


    // Cleanup function para parar de escutar as mudanças quando o componente desmontar
    return () => {
      unsubscribeDirecionadores();
      unsubscribeClassificacoes();
      unsubscribeEmbalagens();
      unsubscribeTiposProduto();
      unsubscribeClientes(); // Limpar o listener de clientes
    };
  }, [propriedadeNome]); // Depende de propriedadeNome

  // Função unificada para gerar e compartilhar PDF
  const handleGenerateAndSharePDF = async () => {
    if (!lastSaleData) return

    setIsGeneratingPDF(true)
    try {
      // Passar a URI da logo para a função de geração de PDF
      await PDFManager.generateAndShareSalesReport(lastSaleData, propriedadeNome, logoUri)
    } catch (error) {
      // Erro já tratado dentro de generateAndShareSalesReport
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false)
    setLastSaleData(null)
    navigation.goBack()
  }

  const addItem = () => {
    const newItem = {
      id: Date.now().toString(),
      talhao: "",
      talhaoId: "",
      variedade: "",
      variedadeId: "", // VariedadeId não é usado no Firebase, mas mantido por consistência
      classificacao: "",
      classificacaoId: "",
      quantidade: "",
      embalagem: "",
      embalagemId: "",
      preco: "",
      valorTotal: 0,
      tipoProduto: "",
    }
    setItems([...items, newItem])

    // Scroll to bottom after adding
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id, field, value, idField = null, idValue = null) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }

          if (idField && idValue !== null) {
            updatedItem[idField] = idValue
          }

          // Se o campo atualizado for 'talhao', encontrar o direcionador correspondente e preencher a variedade
          if (field === 'talhao') {
            const selectedDirecionador = direcionadores.find(d => d.direcionador === value);
            if (selectedDirecionador) {
              updatedItem.variedade = selectedDirecionador.variedade;
              // Não há variedadeId no Firebase, então não atualizamos
            } else {
              updatedItem.variedade = ""; // Limpa a variedade se o talhão não for encontrado
            }
          }


          if (field === "quantidade" || field === "preco") {
            const quantidade = Number.parseFloat(field === "quantidade" ? value.replace(',', '.') : updatedItem.quantidade.replace(',', '.')) || 0;
            const preco = Number.parseFloat(field === "preco" ? value.replace(',', '.') : updatedItem.preco.replace(',', '.')) || 0;
            updatedItem.valorTotal = quantidade * preco;
          }

          return updatedItem
        }
        return item
      }),
    )
  }

  const totalPedido = items.reduce((total, item) => total + item.valorTotal, 0)
  const totalItems = items.filter((item) => item.talhao || item.variedade || item.quantidade).length

  // Função para abrir modal de seleção
  const openListModal = useCallback((type, itemId = null) => {
    setListModalType(type)
    setCurrentItemId(itemId)

    switch (type) {
      case "cliente":
        // Usar os clientes carregados do Firebase
        setListModalData(clientes)
        break
      case "formaPagamento":
        setListModalData(SELECTION_DATA.formasPagamento)
        break
      case "variedade":
        // Variedade agora é preenchida automaticamente pelo Talhão,
        // mas mantemos a opção de seleção manual caso necessário ou para outros fluxos.
        // Para este caso, a lista de variedades pode ser gerada a partir dos direcionadores únicos.
        const uniqueVariedades = Array.from(new Set(direcionadores.map(d => d.variedade)))
          .map((variedade, index) => ({ id: index.toString(), name: variedade }));
        setListModalData(uniqueVariedades);
        break
      case "talhao":
        // Usar os direcionadores carregados do Firebase para a lista de talhões
        const talhoesFromDirecionadores = direcionadores.map(d => ({
          id: d.id, // Usar o ID do direcionador como ID do item
          name: d.direcionador, // Usar o valor do direcionador como nome
          variedade: d.variedade, // Incluir a variedade para auto-preenchimento
        }));
        setListModalData(talhoesFromDirecionadores);
        break
      case "classificacao":
        // Usar as classificações carregadas do Firebase
        setListModalData(classificacoes);
        break
      case "embalagem":
        // Usar as embalagens carregadas do Firebase
        setListModalData(embalagens);
        break
      case "tipoProduto":
        // Usar os tipos de produto carregados do Firebase
        setListModalData(tiposProduto);
        break
      default:
        setListModalData([])
    }

    setSearchQuery("")
    setListModalVisible(true)
  }, [direcionadores, classificacoes, embalagens, tiposProduto, clientes]) // Adicionar clientes como dependência

  // Dados filtrados para busca
  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  // Função para lidar com seleção de item
  const handleItemSelection = useCallback((selectedItem) => {
    if (currentItemId) {
      // Seleção para item específico
      switch (listModalType) {
        case "variedade":
          updateItem(currentItemId, "variedade", selectedItem.name, "variedadeId", selectedItem.id)
          break
        case "talhao":
          // Ao selecionar um talhão, atualiza o talhão e a variedade do item
          updateItem(currentItemId, "talhao", selectedItem.name, "talhaoId", selectedItem.id);
          // A variedade será preenchida automaticamente dentro de updateItem
          break
        case "classificacao":
          updateItem(currentItemId, "classificacao", selectedItem.name, "classificacaoId", selectedItem.id)
          break
        case "embalagem":
          updateItem(currentItemId, "embalagem", selectedItem.name, "embalagemId", selectedItem.id)
          break
        case "tipoProduto":
          updateItem(currentItemId, "tipoProduto", selectedItem.id)
          break
      }
    } else {
      // Seleção para formulário principal
      switch (listModalType) {
        case "cliente":
          setFormData(prev => ({ ...prev, cliente: selectedItem.name, clienteId: selectedItem.id }))
          break
        case "formaPagamento":
          setFormData(prev => ({ ...prev, formaPagamento: selectedItem.name, formaPagamentoId: selectedItem.id }))
          break
      }
    }
    setListModalVisible(false)
  }, [listModalType, currentItemId, updateItem]) // Adicionar updateItem como dependência

  // Função para salvar no AsyncStorage (mantida para backup local)
  const saveVendaToStorage = async (vendaData) => {
    try {
      // Buscar vendas existentes
      const existingVendas = await AsyncStorage.getItem(STORAGE_KEYS.VENDAS)
      const vendas = existingVendas ? JSON.parse(existingVendas) : {}

      // Criar estrutura se não existir
      if (!vendas.propriedades) {
        vendas.propriedades = {}
      }

      if (!vendas.propriedades[propriedadeNome]) {
        vendas.propriedades[propriedadeNome] = {
          vendas: {},
        }
      }

      // Gerar ID único para a venda
      const vendaId = `venda_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Adicionar a nova venda
      vendas.propriedades[propriedadeNome].vendas[vendaId] = vendaData

      // Salvar de volta no AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.VENDAS, JSON.stringify(vendas))

      return vendaId
    } catch (error) {
      throw new Error("Erro ao salvar no armazenamento local")
    }
  }

  // Nova função para salvar no Firebase
  const saveVendaToFirebase = async (vendaData) => {
    try {
      // Referência para o nó de vendas da propriedade específica
      const vendasRef = ref(database, `propriedades/${propriedadeNome}/vendas`)

      // Usar push para gerar uma chave única automaticamente
      const newVendaRef = push(vendasRef)

      // Salvar os dados da venda
      await set(newVendaRef, vendaData)

      // Retornar o ID gerado pelo Firebase
      return newVendaRef.key
    } catch (error) {
      console.error("Erro ao salvar no Firebase:", error)
      throw new Error("Erro ao salvar no banco de dados online")
    }
  }

  const handleSubmit = async () => {
    // Validação básica
    if (!formData.cliente || !formData.formaPagamento) {
      Alert.alert("Erro", "Por favor, preencha todos os campos obrigatórios")
      return
    }

    // Validar prazo se for "A Prazo"
    if (formData.formaPagamentoId === "prazo" && !formData.prazoDias) {
      Alert.alert("Erro", "Por favor, informe o prazo em dias para pagamento a prazo")
      return
    }

    // Verificar se há itens válidos
    if (items.length === 0 || !items.some((item) => item.talhao && item.quantidade && item.preco)) {
      Alert.alert("Erro", "Adicione pelo menos um item com talhão, quantidade e preço")
      return
    }

    try {
      setLoading(true)

      // Preparar os dados para salvar
      const vendaData = {
        cliente: formData.cliente,
        clienteId: formData.clienteId,
        dataPedido: formatDate(formData.dataPedido),
        dataTimestamp: formData.dataPedido.getTime(),
        formaPagamento: formData.formaPagamento,
        formaPagamentoId: formData.formaPagamentoId,
        prazoDias: formData.formaPagamentoId === "prazo" ? formData.prazoDias : null,
        dataCarregamento: formatDate(formData.dataCarregamento),
        dataCarregamentoTimestamp: formData.dataCarregamento.getTime(),
        observacao: formData.observacao,
        observacaoPagamento: formData.observacaoPagamento, // Incluir o novo campo
        valorTotal: totalPedido,
        itens: items
          .filter((item) => item.talhao || item.variedade || item.quantidade || item.preco)
          .map((item) => ({
            talhao: item.talhao,
            talhaoId: item.talhaoId,
            variedade: item.variedade,
            variedadeId: item.variedadeId,
            classificacao: item.classificacao,
            classificacaoId: item.classificacaoId,
            quantidade: Number.parseFloat(item.quantidade.replace(',', '.')) || 0,
            embalagem: item.embalagem,
            embalagemId: item.embalagemId,
            preco: Number.parseFloat(item.preco.replace(',', '.')) || 0,
            valorTotal: Number.parseFloat(item.valorTotal) || 0,
            tipoProduto: item.tipoProduto,
          })),
        status: "pendente",
        criadoEm: new Date().toISOString(),
        criadoPor: userId,
        propriedade: propriedadeNome,
      }

      // Tentar salvar no Firebase primeiro
      let firebaseVendaId = null
      let localVendaId = null

      try {
        firebaseVendaId = await saveVendaToFirebase(vendaData)
        console.log("Venda salva no Firebase com ID:", firebaseVendaId)
      } catch (firebaseError) {
        console.error("Erro ao salvar no Firebase:", firebaseError)
        // Continuar para salvar localmente mesmo se o Firebase falhar
      }

      // Salvar localmente como backup
      try {
        localVendaId = await saveVendaToStorage(vendaData)
        console.log("Venda salva localmente com ID:", localVendaId)
      } catch (localError) {
        console.error("Erro ao salvar localmente:", localError)
      }

      setLoading(false)

      // Salvar dados da venda para uso no modal de sucesso
      setLastSaleData(vendaData)

      // Mostrar modal de sucesso
      setShowSuccessModal(true)

    } catch (error) {
      setLoading(false)
      console.error("Erro ao salvar venda:", error)
      Alert.alert("Erro", "Ocorreu um erro ao salvar a venda. Tente novamente.")
    }
  }

  const updateFormData = (field, value) => {
    setFormData({ ...formData, [field]: value })
  }

  const openDatePicker = (field) => {
    setDatePickerField(field)
    setShowDatePicker(true)
  }

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === "ios")
    if (selectedDate) {
      updateFormData(datePickerField, selectedDate)
    }
  }

  const formatDate = (date) => {
    if (!date) return ""
    return date instanceof Date
      ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
      : ""
  }

  const isItemComplete = (item) => {
    return item.talhao && item.variedade && item.quantidade && item.preco
  }

  // Função para obter o nome do tipo de produto
  const getTipoProdutoName = (tipoProdutoId) => {
    const tipoProduto = tiposProduto.find(item => item.id === tipoProdutoId);
    return tipoProduto ? tipoProduto.name : "";
  }

  // Componente para renderizar item da lista
  const renderListItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleItemSelection(item)}
    >
      <Text style={styles.listItemText}>{item.name}</Text>
    </TouchableOpacity>
  ), [handleItemSelection])

  // Modal de seleção flutuante
  const renderListModal = () => {
    const getModalTitle = () => {
      switch (listModalType) {
        case "cliente": return "Selecione o Cliente"
        case "formaPagamento": return "Selecione a Forma de Pagamento"
        case "variedade": return "Selecione a Variedade"
        case "talhao": return "Selecione o Talhão"
        case "classificacao": return "Selecione a Classificação"
        case "embalagem": return "Selecione a Embalagem"
        case "tipoProduto": return "Selecione o Produto"
        default: return "Selecione uma opção"
      }
    }

    return (
      <Modal
        visible={isListModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setListModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setListModalVisible(false)}
        >
          <View style={styles.floatingModalContainer}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={styles.floatingModalContent}>
                <View style={styles.floatingModalHeader}>
                  <Text style={styles.floatingModalTitle}>{getModalTitle()}</Text>
                  <TouchableOpacity
                    onPress={() => setListModalVisible(false)}
                    style={styles.floatingCloseButton}
                  >
                    <Icon name="close" size={20} color={COLORS.gray600} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.floatingSearchInput}
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={COLORS.gray400}
                />

                <FlatList
                  data={filteredListData}
                  renderItem={renderListItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  style={styles.floatingList}
                  maxHeight={200}
                />
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Venda</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Info da Propriedade */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Propriedade: {propriedadeNome}</Text>
        </View>

        {/* Informações do Cliente */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="person" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Cliente</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data do Pedido *</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => openDatePicker("dataPedido")}>
              <Text style={styles.dateText}>{formatDate(formData.dataPedido)}</Text>
              <Icon name="calendar" size={18} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome do Cliente *</Text>
            <TouchableOpacity
              style={styles.selectionInput}
              onPress={() => openListModal("cliente")}
            >
              <Text style={[styles.selectionText, !formData.cliente && styles.placeholderText]}>
                {formData.cliente || "Selecione o cliente"}
              </Text>
              <ChevronDown size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Informações de Pagamento */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="card" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Pagamento</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Forma de Pagamento *</Text>
            <TouchableOpacity
              style={styles.selectionInput}
              onPress={() => openListModal("formaPagamento")}
            >
              <Text style={[styles.selectionText, !formData.formaPagamento && styles.placeholderText]}>
                {formData.formaPagamento || "Selecione a forma de pagamento"}
              </Text>
              <ChevronDown size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {formData.formaPagamentoId === "prazo" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prazo (dias) *</Text>
              <TextInput
                style={styles.input}
                placeholder="30"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
                value={formData.prazoDias}
                onChangeText={(value) => updateFormData("prazoDias", value)}
              />
            </View>
          )}

           {/* Campo de Observação Pagamento */}
           <View style={styles.inputGroup}>
            <Text style={styles.label}>Observação Pagamento</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações específicas sobre o pagamento..."
              placeholderTextColor={COLORS.gray400}
              multiline
              numberOfLines={3}
              value={formData.observacaoPagamento}
              onChangeText={(value) => updateFormData("observacaoPagamento", value)}
            />
          </View>
        </View>

        {/* Itens da Venda */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="list" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Itens da Venda</Text>
          </View>

          <TouchableOpacity style={styles.itemsButton} onPress={() => setShowItemsModal(true)}>
            <View style={styles.itemsButtonContent}>
              <View style={styles.itemsInfo}>
                <Text style={styles.itemsCount}>{totalItems} item(s) adicionado(s)</Text>
                <Text style={styles.itemsTotal}>Total: {formatCurrencyBRL(totalPedido)}</Text>
              </View>
              <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Data de Carregamento */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="calendar" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Data de Carregamento</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data do Carregamento</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => openDatePicker("dataCarregamento")}>
              <Text style={styles.dateText}>{formatDate(formData.dataCarregamento)}</Text>
              <Icon name="calendar" size={18} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Observações Gerais */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="document-text" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Observações Gerais</Text>
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações adicionais sobre a venda..."
              placeholderTextColor={COLORS.gray400}
              multiline
              numberOfLines={3}
              value={formData.observacao}
              onChangeText={(value) => updateFormData("observacao", value)}
            />
          </View>
        </View>

        {/* Botão Salvar Venda */}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Icon name="checkmark-circle" size={24} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Salvar Venda</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Modal de Itens */}
      <Modal visible={showItemsModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowItemsModal(false)}>
              <MaterialIcons name="close" size={24} color={COLORS.gray600} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Itens da Venda</Text>
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <MaterialIcons name="add" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollViewRef} style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemNumberContainer}>
                    <Text style={styles.itemNumber}>{index + 1}</Text>
                  </View>
                  <Text style={styles.itemTitle}>Item {index + 1}</Text>
                  <View style={styles.itemActions}>
                    {isItemComplete(item) && (
                      <View style={styles.completeIndicator}>
                        <MaterialIcons name="check-circle" size={16} color={COLORS.success} />
                      </View>
                    )}
                    {items.length > 1 && (
                      <TouchableOpacity style={styles.deleteButton} onPress={() => removeItem(item.id)}>
                        <MaterialIcons name="delete-outline" size={20} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.inputGrid}>
                  <View style={styles.inputRow}>
                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Produto</Text>
                      <TouchableOpacity
                        style={styles.itemSelectionInput}
                        onPress={() => openListModal("tipoProduto", item.id)}
                      >
                        <Text style={[styles.itemSelectionText, !item.tipoProduto && styles.placeholderText]}>
                          {getTipoProdutoName(item.tipoProduto) || "Selecione o Produto"}
                        </Text>
                        <ChevronDown size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Talhão</Text>
                      <TouchableOpacity
                        style={styles.itemSelectionInput}
                        onPress={() => openListModal("talhao", item.id)}
                      >
                        <Text style={[styles.itemSelectionText, !item.talhao && styles.placeholderText]}>
                          {item.talhao || "Selecione o talhão"}
                        </Text>
                        <ChevronDown size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Variedade</Text>
                      {/* Campo Variedade agora é preenchido automaticamente */}
                      <View style={styles.itemSelectionInput}>
                         <Text style={[styles.itemSelectionText, !item.variedade && styles.placeholderText]}>
                          {item.variedade || "Preenchido automaticamente"}
                        </Text>
                        {/* Remove o ícone de seleção manual */}
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Classificação</Text>
                      <TouchableOpacity
                        style={styles.itemSelectionInput}
                        onPress={() => openListModal("classificacao", item.id)}
                      >
                        <Text style={[styles.itemSelectionText, !item.classificacao && styles.placeholderText]}>
                          {item.classificacao || "Selecione a classificação"}
                        </Text>
                        <ChevronDown size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Embalagem</Text>
                      <TouchableOpacity
                        style={styles.itemSelectionInput}
                        onPress={() => openListModal("embalagem", item.id)}
                      >
                        <Text style={[styles.itemSelectionText, !item.embalagem && styles.placeholderText]}>
                          {item.embalagem || "Selecione a embalagem"}
                        </Text>
                        <ChevronDown size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Quantidade</Text>
                      <TextInput
                        style={styles.itemInput}
                        placeholder="0"
                        keyboardType="numeric"
                        value={item.quantidade}
                        onChangeText={(value) => updateItem(item.id, "quantidade", value)}
                      />
                    </View>

                    <View style={styles.inputColumn}>
                      <Text style={styles.itemLabel}>Preço Unitário</Text>
                      <TextInput
                        style={styles.itemInput}
                        placeholder="0,00"
                        keyboardType="numeric"
                        value={item.preco}
                        onChangeText={(value) => updateItem(item.id, "preco", value)}
                      />
                    </View>
                  </View>
                </View>

                {item.valorTotal > 0 && (
                  <View style={styles.itemTotal}>
                    <Text style={styles.itemTotalLabel}>Subtotal:</Text>
                    <Text style={styles.itemTotalValue}>{formatCurrencyBRL(item.valorTotal)}</Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.addItemContainer}>
              <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                <MaterialIcons name="add" size={20} color={COLORS.primary} />
                <Text style={styles.addItemText}>Adicionar Novo Item</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSpace} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total do Pedido</Text>
              <Text style={styles.totalValue}>{formatCurrencyBRL(totalPedido)}</Text>
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={() => setShowItemsModal(false)}>
              <Text style={styles.confirmButtonText}>Confirmar Itens</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={formData[datePickerField] || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* Modal de Seleção Flutuante */}
      {renderListModal()}

      {/* Modal de Sucesso */}
      <SuccessModal
        visible={showSuccessModal}
        onClose={handleCloseSuccessModal}
        onGenerateAndSharePDF={handleGenerateAndSharePDF} // Chama a função unificada
        isGeneratingPDF={isGeneratingPDF}
      />

      {/* O visualizador de PDF integrado foi removido */}
    </SafeAreaView>
  )
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
  },
  placeholder: {
    width: 34,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  warningCard: {
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningText: {
    fontSize: 12,
    color: "#856404",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray800,
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.gray700,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: COLORS.white,
    color: COLORS.gray800,
  },
  selectionInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    padding: 14,
    backgroundColor: COLORS.white,
  },
  selectionText: {
    fontSize: 16,
    color: COLORS.gray800,
  },
  placeholderText: {
    color: COLORS.gray400,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    padding: 14,
    backgroundColor: COLORS.white,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.gray800,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  picker: {
    height: 50,
  },
  itemsButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    backgroundColor: COLORS.primaryLight,
  },
  itemsButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemsInfo: {
    flex: 1,
  },
  itemsCount: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.gray700,
    marginBottom: 2,
  },
  itemsTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.gray400,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  bottomSpace: {
    height: 20,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.gray800,
  },
  addButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Item Card Styles
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  itemNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemNumber: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray800,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  completeIndicator: {
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  inputGrid: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  inputColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.gray600,
    marginBottom: 4,
  },
  itemInput: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: COLORS.white,
  },
  itemSelectionInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 6,
    padding: 10,
    backgroundColor: COLORS.white,
  },
  itemSelectionText: {
    fontSize: 14,
    color: COLORS.gray800,
    flex: 1,
  },
  itemPicker: {
    height: 40,
  },
  itemTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  itemTotalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.gray600,
  },
  itemTotalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },

  // Add Item Button
  addItemContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 16,
    width: "100%",
  },
  addItemText: {
    color: COLORS.primary,
    fontWeight: "500",
    marginLeft: 8,
  },

  // Modal Footer
  modalFooter: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray800,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },

  // Floating Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  floatingModalContainer: {
    width: "85%",
    maxWidth: 400,
  },
  floatingModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  floatingModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  floatingModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray800,
    flex: 1,
  },
  floatingCloseButton: {
    padding: 4,
  },
  floatingSearchInput: {
    height: 40,
    borderColor: COLORS.gray300,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    fontSize: 14,
    color: COLORS.gray800,
  },
  floatingList: {
    maxHeight: 200,
  },
  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  listItemText: {
    fontSize: 14,
    color: COLORS.gray800,
  },

  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  successModalContainer: {
    width: "90%",
    maxWidth: 400,
  },
  successModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.gray800,
    textAlign: "center",
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  warningMessage: {
    fontSize: 12,
    color: "#856404",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 16,
    backgroundColor: "#fff3cd",
    padding: 8,
    borderRadius: 6,
    width: '100%', // Garante que o aviso ocupe a largura total
  },
  successActions: {
    width: "100%",
  },
  successButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  pdfButton: {
    backgroundColor: COLORS.danger,
  },
  whatsappButton: {
    backgroundColor: "#25D366", // Cor verde para o botão de compartilhar
  },
  closeButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  successButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },

  pdfViewerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pdfViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  pdfCloseButton: {
    padding: 4,
  },
  pdfViewerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.gray800,
  },
  pdfViewer: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  pdfErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  pdfErrorText: {
    fontSize: 16,
    color: COLORS.gray600,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
})