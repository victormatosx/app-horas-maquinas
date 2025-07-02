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
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import DateTimePicker from "@react-native-community/datetimepicker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ChevronDown } from "lucide-react-native"

import * as FileSystem from "expo-file-system"

// Importações compatíveis com Expo
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"
import { Asset } from "expo-asset" // Importar Asset

// Importar Firebase
import { database } from "../config/firebaseConfig"
import { ref, push, set, onValue, update } from "firebase/database"

// Importar a logo
import matriceLogo from "../../assets/matriceLogo.png"

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
  if (value === null || value === undefined) return "R$ 0,00"
  const number = Number.parseFloat(value)
  if (isNaN(number)) return "R$ 0,00"

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

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
        Alert.alert(
          "Compartilhamento não disponível",
          "A funcionalidade de compartilhamento não está disponível neste dispositivo.",
        )
        return
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Compartilhar Relatório de Venda",
        UTI: "com.adobe.pdf", // Para iOS
      })

      return uri // Retorna a URI caso precise ser usada para algo mais
    } catch (error) {
      console.error("Erro ao gerar e compartilhar PDF:", error)
      Alert.alert("Erro", "Falha ao gerar ou compartilhar o relatório PDF.")
      throw error // Propaga o erro para quem chamou
    }
  }

  static generateHTMLContent(vendaData, propriedadeNome, logoUri) {
    const itensHTML = vendaData.itens
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.tipoProduto || "-"}</td>
        <td>${item.variedade || "-"}</td>
        <td>${item.talhao || "-"}</td>
        <td>${item.classificacao || "-"}</td>
        <td>${item.embalagem || "-"}</td>
        <td class="numeric">${item.quantidade}</td>
        <td class="numeric">${formatCurrencyBRL(item.preco)}</td>
        <td class="numeric">${formatCurrencyBRL(item.valorTotal)}</td>
      </tr>
    `,
      )
      .join("")

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
            max-width: 200px;
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
            ${logoUri ? `<img src="${logoUri}" class="logo" alt="Logo da Fazenda" />` : ""}
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
             ${vendaData.formaPagamentoId === "prazo" && vendaData.prazoDias
        ? `
              <div class="info-item">
                <span class="info-label">Prazo:</span>
                <span class="info-value">${vendaData.prazoDias} dias</span>
              </div>
            `
        : ""
      }
             ${vendaData.observacaoPagamento
        ? `
              <div class="info-item" style="width: 100%;">
                <span class="info-label">Observação Pagamento:</span>
                <span class="info-value">${vendaData.observacaoPagamento}</span>
              </div>
            `
        : ""
      }
          </div>
           ${vendaData.observacao
        ? `
            <div class="info-item" style="width: 100%;">
              <span class="info-label">Observações Gerais:</span>
              <span class="info-value">${vendaData.observacao}</span>
            </div>
          `
        : ""
      }
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
          <p>Relatório gerado em ${new Date().toLocaleString("pt-BR")}</p>
          <p>Propriedade: ${propriedadeNome}</p>
          <div class="company-footer">J. R. AgSolutions</div>
        </div>
      </body>
      </html>
    `
  }
}

// Componente para Modal de Sucesso
const SuccessModal = ({ visible, onClose, onGenerateAndSharePDF, isGeneratingPDF, isEditMode }) => {
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
            <Text style={styles.successTitle}>
              {isEditMode ? "Venda Atualizada com Sucesso!" : "Venda Registrada com Sucesso!"}
            </Text>

            {/* Mensagem */}
            <Text style={styles.successMessage}>
              {isEditMode
                ? "As alterações da venda foram salvas e estão disponíveis no sistema."
                : "Sua venda foi salva e está disponível no sistema."}
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
              <TouchableOpacity style={[styles.successButton, styles.closeButton]} onPress={onClose}>
                <Text style={[styles.successButtonText, { color: COLORS.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// Componente para Modal de Variedade Não Cadastrada
const VariedadeModal = ({ visible, talhao, onCadastrar, onContinuar, onClose }) => {
  const [novaVariedade, setNovaVariedade] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCadastrar = async () => {
    if (!novaVariedade.trim()) {
      Alert.alert("Erro", "Por favor, digite o nome da variedade")
      return
    }

    setLoading(true)
    try {
      await onCadastrar(novaVariedade.trim())
      setNovaVariedade("")
    } catch (error) {
      Alert.alert("Erro", "Não foi possível cadastrar a variedade")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setNovaVariedade("")
    onClose()
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.varietyModalOverlay}>
        <View style={styles.varietyModalContainer}>
          <View style={styles.varietyModalContent}>
            {/* Ícone de Aviso */}
            <View style={styles.varietyIconContainer}>
              <MaterialIcons name="warning" size={50} color={COLORS.warning} />
            </View>

            {/* Título */}
            <Text style={styles.varietyTitle}>Variedade Não Cadastrada</Text>

            {/* Mensagem */}
            <Text style={styles.varietyMessage}>
              O talhão "{talhao}" não possui variedade cadastrada. O que deseja fazer?
            </Text>

            {/* Campo para nova variedade */}
            <View style={styles.varietyInputContainer}>
              <Text style={styles.varietyInputLabel}>Nome da Variedade:</Text>
              <TextInput
                style={styles.varietyInput}
                placeholder="Digite o nome da variedade"
                placeholderTextColor={COLORS.gray400}
                value={novaVariedade}
                onChangeText={setNovaVariedade}
                editable={!loading}
              />
            </View>

            {/* Botões de Ação */}
            <View style={styles.varietyActions}>
              {/* Botão Cadastrar Variedade */}
              <TouchableOpacity
                style={[styles.varietyButton, styles.varietyCadastrarButton]}
                onPress={handleCadastrar}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <MaterialIcons name="add" size={20} color={COLORS.white} />
                    <Text style={styles.varietyButtonText}>Cadastrar Variedade</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Botão Continuar Sem Variedade */}
              <TouchableOpacity
                style={[styles.varietyButton, styles.varietyContinuarButton]}
                onPress={onContinuar}
                disabled={loading}
              >
                <MaterialIcons name="skip-next" size={20} color={COLORS.white} />
                <Text style={styles.varietyButtonText}>Continuar Sem Variedade</Text>
              </TouchableOpacity>

              {/* Botão Cancelar */}
              <TouchableOpacity
                style={[styles.varietyButton, styles.varietyCancelarButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={[styles.varietyButtonText, { color: COLORS.gray600 }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function SalesScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const scrollViewRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [propriedadeNome, setPropriedadeNome] = useState("")
  const [userId, setUserId] = useState("")
  const [logoUri, setLogoUri] = useState(null) // Estado para armazenar a URI da logo

  // Estados para modo de edição
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingSaleId, setEditingSaleId] = useState(null)

  // Estados para o modal de sucesso e PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [lastSaleData, setLastSaleData] = useState(null)

  // Estados para o modal de variedade não cadastrada
  const [showVariedadeModal, setShowVariedadeModal] = useState(false)
  const [talhaoSemVariedade, setTalhaoSemVariedade] = useState(null)
  const [itemIdPendente, setItemIdPendente] = useState(null)

  // Estado para armazenar os direcionadores do Firebase
  const [direcionadores, setDirecionadores] = useState([])
  // Estado para armazenar as classificações do Firebase
  const [classificacoes, setClassificacoes] = useState([])
  // Estado para armazenar as embalagens do Firebase
  const [embalagens, setEmbalagens] = useState([])
  // Estado para armazenar os tipos de produto do Firebase
  const [tiposProduto, setTiposProduto] = useState([])
  // Estado para armazenar os clientes do Firebase
  const [clientes, setClientes] = useState([])

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

  // Função para verificar se um talhão tem variedade cadastrada
  const verificarVariedadeTalhao = (talhaoNome) => {
    const direcionador = direcionadores.find(d => d.direcionador === talhaoNome)
    return direcionador && direcionador.variedade && direcionador.variedade.trim() !== ""
  }

  // Função para cadastrar nova variedade para um talhão
  const cadastrarVariedadeTalhao = async (talhaoNome, novaVariedade) => {
    try {
      // Encontrar o direcionador correspondente ao talhão
      const direcionador = direcionadores.find(d => d.direcionador === talhaoNome)
      
      if (!direcionador) {
        throw new Error("Talhão não encontrado")
      }

      // Atualizar no Firebase
      const direcionadorRef = ref(database, `propriedades/${propriedadeNome}/direcionadores/${direcionador.id}`)
      await update(direcionadorRef, {
        variedade: novaVariedade
      })

      // Atualizar o estado local
      setDirecionadores(prev => prev.map(d => 
        d.id === direcionador.id 
          ? { ...d, variedade: novaVariedade }
          : d
      ))

      // Atualizar o item que estava pendente
      if (itemIdPendente) {
        updateItem(itemIdPendente, "variedade", novaVariedade)
      }

      Alert.alert("Sucesso", "Variedade cadastrada com sucesso!")
      setShowVariedadeModal(false)
      setTalhaoSemVariedade(null)
      setItemIdPendente(null)

    } catch (error) {
      console.error("Erro ao cadastrar variedade:", error)
      throw error
    }
  }

  // Função para continuar sem variedade
  const continuarSemVariedade = () => {
    if (itemIdPendente) {
      updateItem(itemIdPendente, "variedade", "Variedade não registrada")
    }
    
    setShowVariedadeModal(false)
    setTalhaoSemVariedade(null)
    setItemIdPendente(null)
  }

  // Verificar se está em modo de edição
  useEffect(() => {
    if (route.params?.editMode && route.params?.saleData) {
      setIsEditMode(true)
      setEditingSaleId(route.params.saleId)
      loadSaleDataForEdit(route.params.saleData)
    }
  }, [route.params])

  // Função para carregar dados da venda para edição
  const loadSaleDataForEdit = (saleData) => {
    // Carregar dados do formulário
    setFormData({
      dataPedido: saleData.dataTimestamp ? new Date(saleData.dataTimestamp) : new Date(),
      cliente: saleData.cliente || "",
      clienteId: saleData.clienteId || "",
      formaPagamento: saleData.formaPagamento || "",
      formaPagamentoId: saleData.formaPagamentoId || "",
      prazoDias: saleData.prazoDias || "",
      dataCarregamento: saleData.dataCarregamentoTimestamp ? new Date(saleData.dataCarregamentoTimestamp) : new Date(),
      observacao: saleData.observacao || "",
      observacaoPagamento: saleData.observacaoPagamento || "",
    })

    // Carregar itens da venda
    if (saleData.itens && saleData.itens.length > 0) {
      const loadedItems = saleData.itens.map((item, index) => ({
        id: (index + 1).toString(),
        talhao: item.talhao || "",
        talhaoId: item.talhaoId || "",
        variedade: item.variedade || "",
        variedadeId: item.variedadeId || "",
        classificacao: item.classificacao || "",
        classificacaoId: item.classificacaoId || "",
        quantidade: item.quantidade ? item.quantidade.toString() : "",
        embalagem: item.embalagem || "",
        embalagemId: item.embalagemId || "",
        preco: item.preco ? item.preco.toString() : "",
        valorTotal: item.valorTotal || 0,
        tipoProduto: item.tipoProduto || "",
      }))
      setItems(loadedItems)
    }
  }

  // Carregar informações do usuário atual e a URI da logo
  useEffect(() => {
    const loadUserDataAndLogo = async () => {
      try {
        const storedPropriedade = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROPRIEDADE)
        const storedUserId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID)

        setPropriedadeNome(storedPropriedade || "Matrice")
        setUserId(storedUserId || `user_${Date.now()}`)

        if (!storedUserId) {
          const newUserId = `user_${Date.now()}`
          await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, newUserId)
          setUserId(newUserId)
        }

        if (!storedPropriedade) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_PROPRIEDADE, "Matrice")
          setPropriedadeNome("Matrice")
        }

        // Embutir a logo diretamente como base64
        const base64Uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZ8AAACNCAYAAABoi3ewAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTQ1IDc5LjE2MzQ5OSwgMjAxOC8wOC8xMy0xNjo0MDoyMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjAzNzZFNzUyRDJDRDExRUI4ODlDQjBCRUU4RUFCRDE5IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjAzNzZFNzUzRDJDRDExRUI4ODlDQjBCRUU4RUFCRDE5Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MDM3NkU3NTBEMkNEMTFFQjg4OUNCMEJFRThFQUJEMTkiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MDM3NkU3NTFEMkNEMTFFQjg4OUNCMEJFRThFQUJEMTkiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4rt5/jAADKx0lEQVR42uy9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";
        setLogoUri(base64Uri)
      } catch (error) {
        console.error("Erro ao carregar dados do usuário ou logo:", error)
        setPropriedadeNome("Matrice")
        setUserId(`user_${Date.now()}`)
        setLogoUri(null)
      }
    }

    loadUserDataAndLogo()
  }, [])


  // Efeito para carregar os direcionadores, classificações, embalagens, tipos de produto e clientes do Firebase
  useEffect(() => {
    if (!propriedadeNome) return // Espera o nome da propriedade ser carregado

    // Carregar Direcionadores (Talhões e Variedades)
    const direcionadoresRef = ref(database, `propriedades/${propriedadeNome}/direcionadores`)
    const unsubscribeDirecionadores = onValue(
      direcionadoresRef,
      (snapshot) => {
        const data = snapshot.val()
        const loadedDirecionadores = []
        if (data) {
          Object.keys(data).forEach((key) => {
            loadedDirecionadores.push({
              id: key,
              ...data[key],
            })
          })
        }
        setDirecionadores(loadedDirecionadores)
      },
      (error) => {
        console.error("Erro ao carregar direcionadores do Firebase:", error)
        Alert.alert("Erro", "Não foi possível carregar a lista de talhões e variedades.")
      },
    )

    // Carregar Classificações
    const classificacoesRef = ref(database, `propriedades/${propriedadeNome}/classificacao`)
    const unsubscribeClassificacoes = onValue(
      classificacoesRef,
      (snapshot) => {
        const data = snapshot.val()
        const loadedClassificacoes = []
        if (data) {
          Object.keys(data).forEach((key) => {
            // Usar a chave 'Descrição' como nome e o ID do Firebase como id
            loadedClassificacoes.push({
              id: key,
              name: data[key].Descrição || `Classificação ${key}`, // Usar Descrição ou um fallback
            })
          })
        }
        setClassificacoes(loadedClassificacoes)
      },
      (error) => {
        console.error("Erro ao carregar classificações do Firebase:", error)
        Alert.alert("Erro", "Não foi possível carregar a lista de classificações.")
      },
    )

    // Carregar Embalagens
    const embalagensRef = ref(database, `propriedades/${propriedadeNome}/embalagens`)
    const unsubscribeEmbalagens = onValue(
      embalagensRef,
      (snapshot) => {
        const data = snapshot.val()
        const loadedEmbalagens = []
        if (data) {
          Object.keys(data).forEach((key) => {
            // Usar a chave 'descricao' como nome e o ID do Firebase como id
            loadedEmbalagens.push({
              id: key,
              name: data[key].descricao || `Embalagem ${key}`, // Usar descricao ou um fallback
            })
          })
        }
        setEmbalagens(loadedEmbalagens)
      },
      (error) => {
        console.error("Erro ao carregar embalagens do Firebase:", error)
        Alert.alert("Erro", "Não foi possível carregar a lista de embalagens.")
      },
    )

    // Carregar Tipos de Produto (culturaAssociada)
    const tiposProdutoRef = ref(database, `propriedades/${propriedadeNome}/direcionadores`) // Assumindo que culturaAssociada está dentro de direcionadores
    const unsubscribeTiposProduto = onValue(
      tiposProdutoRef,
      (snapshot) => {
        const data = snapshot.val()
        const loadedTiposProduto = []
        const uniqueCulturas = new Set() // Usar um Set para garantir unicidade
        if (data) {
          Object.keys(data).forEach((key) => {
            if (data[key].culturaAssociada && !uniqueCulturas.has(data[key].culturaAssociada)) {
              uniqueCulturas.add(data[key].culturaAssociada)
              loadedTiposProduto.push({
                id: data[key].culturaAssociada, // Usar a culturaAssociada como ID e nome
                name: data[key].culturaAssociada,
              })
            }
          })
        }
        setTiposProduto(loadedTiposProduto)
      },
      (error) => {
        console.error("Erro ao carregar tipos de produto do Firebase:", error)
        Alert.alert("Erro", "Não foi possível carregar a lista de tipos de produto.")
      },
    )

    // Carregar Clientes
    const clientesRef = ref(database, `propriedades/${propriedadeNome}/clientes`)
    const unsubscribeClientes = onValue(
      clientesRef,
      (snapshot) => {
        const data = snapshot.val()
        const loadedClientes = []
        if (data) {
          Object.keys(data).forEach((key) => {
            // Usar a chave 'Nome' como nome e o ID do Firebase como id
            if (data[key].Nome) {
              // Garantir que o cliente tem um nome
              loadedClientes.push({
                id: key,
                name: data[key].Nome,
              })
            }
          })
        }
        setClientes(loadedClientes)
      },
      (error) => {
        console.error("Erro ao carregar clientes do Firebase:", error)
        Alert.alert("Erro", "Não foi possível carregar a lista de clientes.")
      },
    )

    // Cleanup function para parar de escutar as mudanças quando o componente desmontar
    return () => {
      unsubscribeDirecionadores()
      unsubscribeClassificacoes()
      unsubscribeEmbalagens()
      unsubscribeTiposProduto()
      unsubscribeClientes() // Limpar o listener de clientes
    }
  }, [propriedadeNome]) // Depende de propriedadeNome

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

          // Se o campo atualizado for 'talhao', verificar se tem variedade cadastrada
          if (field === "talhao") {
            const selectedDirecionador = direcionadores.find((d) => d.direcionador === value)
            if (selectedDirecionador) {
              // Verificar se o talhão tem variedade cadastrada
              if (selectedDirecionador.variedade && selectedDirecionador.variedade.trim() !== "") {
                updatedItem.variedade = selectedDirecionador.variedade
              } else {
                // Talhão sem variedade - mostrar modal
                setTalhaoSemVariedade(value)
                setItemIdPendente(id)
                setShowVariedadeModal(true)
                updatedItem.variedade = "" // Limpa temporariamente
              }
            } else {
              updatedItem.variedade = "" // Limpa a variedade se o talhão não for encontrado
            }
          }

          if (field === "quantidade" || field === "preco") {
            const quantidade =
              Number.parseFloat(
                field === "quantidade" ? value.replace(",", ".") : updatedItem.quantidade.replace(",", "."),
              ) || 0
            const preco =
              Number.parseFloat(field === "preco" ? value.replace(",", ".") : updatedItem.preco.replace(",", ".")) || 0
            updatedItem.valorTotal = quantidade * preco
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
  const openListModal = useCallback(
    (type, itemId = null) => {
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
          const uniqueVariedades = Array.from(new Set(direcionadores.map((d) => d.variedade))).map(
            (variedade, index) => ({ id: index.toString(), name: variedade }),
          )
          setListModalData(uniqueVariedades)
          break
        case "talhao":
          // Usar os direcionadores carregados do Firebase para a lista de talhões
          const talhoesFromDirecionadores = direcionadores.map((d) => ({
            id: d.id, // Usar o ID do direcionador como ID do item
            name: d.direcionador, // Usar o valor do direcionador como nome
            variedade: d.variedade, // Incluir a variedade para auto-preenchimento
          }))
          setListModalData(talhoesFromDirecionadores)
          break
        case "classificacao":
          // Usar as classificações carregadas do Firebase
          setListModalData(classificacoes)
          break
        case "embalagem":
          // Usar as embalagens carregadas do Firebase
          setListModalData(embalagens)
          break
        case "tipoProduto":
          // Usar os tipos de produto carregados do Firebase
          setListModalData(tiposProduto)
          break
        default:
          setListModalData([])
      }

      setSearchQuery("")
      setListModalVisible(true)
    },
    [direcionadores, classificacoes, embalagens, tiposProduto, clientes],
  ) // Adicionar clientes como dependência

  // Dados filtrados para busca
  const filteredListData = useMemo(() => {
    if (!searchQuery) return listModalData
    return listModalData.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [listModalData, searchQuery])

  // Função para lidar com seleção de item
  const handleItemSelection = useCallback(
    (selectedItem) => {
      if (currentItemId) {
        // Seleção para item específico
        switch (listModalType) {
          case "variedade":
            updateItem(currentItemId, "variedade", selectedItem.name, "variedadeId", selectedItem.id)
            break
          case "talhao":
            // Ao selecionar um talhão, atualiza o talhão e verifica a variedade
            updateItem(currentItemId, "talhao", selectedItem.name, "talhaoId", selectedItem.id)
            // A verificação de variedade será feita dentro de updateItem
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
            setFormData((prev) => ({ ...prev, cliente: selectedItem.name, clienteId: selectedItem.id }))
            break
          case "formaPagamento":
            setFormData((prev) => ({ ...prev, formaPagamento: selectedItem.name, formaPagamentoId: selectedItem.id }))
            break
        }
      }
      setListModalVisible(false)
    },
    [listModalType, currentItemId, updateItem, tiposProduto, embalagens, classificacoes, direcionadores],
  )

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

  // Nova função para atualizar venda no Firebase
  const updateVendaToFirebase = async (vendaData, saleId) => {
    try {
      // Referência para a venda específica
      const vendaRef = ref(database, `propriedades/${propriedadeNome}/vendas/${saleId}`)

      // Atualizar os dados da venda
      await update(vendaRef, vendaData)

      return saleId
    } catch (error) {
      console.error("Erro ao atualizar no Firebase:", error)
      throw new Error("Erro ao atualizar no banco de dados online")
    }
  }

  // Modal de confirmação para salvar alterações
  const showSaveConfirmation = () => {
    Alert.alert("Confirmar Alterações", "Deseja salvar as alterações feitas nesta venda?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Salvar",
        onPress: handleSubmit,
      },
    ])
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
            quantidade: Number.parseFloat(item.quantidade.replace(",", ".")) || 0,
            embalagem: item.embalagem,
            embalagemId: item.embalagemId,
            preco: Number.parseFloat(item.preco.replace(",", ".")) || 0,
            valorTotal: Number.parseFloat(item.valorTotal) || 0,
            tipoProduto: item.tipoProduto,
          })),
        status: "pendente",
        propriedade: propriedadeNome,
      }

      // Adicionar campos específicos para criação ou edição
      if (isEditMode) {
        vendaData.atualizadoEm = new Date().toISOString()
        vendaData.atualizadoPor = userId
      } else {
        vendaData.criadoEm = new Date().toISOString()
        vendaData.criadoPor = userId
      }

      // Tentar salvar no Firebase primeiro
      let firebaseVendaId = null
      let localVendaId = null

      try {
        if (isEditMode) {
          firebaseVendaId = await updateVendaToFirebase(vendaData, editingSaleId)
          console.log("Venda atualizada no Firebase com ID:", firebaseVendaId)
        } else {
          firebaseVendaId = await saveVendaToFirebase(vendaData)
          console.log("Venda salva no Firebase com ID:", firebaseVendaId)
        }
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
    const tipoProduto = tiposProduto.find((item) => item.id === tipoProdutoId)
    return tipoProduto ? tipoProduto.name : ""
  }

  // Componente para renderizar item da lista
  const renderListItem = useCallback(
    ({ item }) => (
      <TouchableOpacity style={styles.listItem} onPress={() => handleItemSelection(item)}>
        <Text style={styles.listItemText}>{item.name}</Text>
      </TouchableOpacity>
    ),
    [handleItemSelection],
  )

  // Modal de seleção flutuante
  const renderListModal = () => {
    const getModalTitle = () => {
      switch (listModalType) {
        case "cliente":
          return "Selecione o Cliente"
        case "formaPagamento":
          return "Selecione a Forma de Pagamento"
        case "variedade":
          return "Selecione a Variedade"
        case "talhao":
          return "Selecione o Talhão"
        case "classificacao":
          return "Selecione a Classificação"
        case "embalagem":
          return "Selecione a Embalagem"
        case "tipoProduto":
          return "Selecione o Produto"
        default:
          return "Selecione uma opção"
      }
    }

    return (
      <Modal
        visible={isListModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setListModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setListModalVisible(false)}>
          <View style={styles.floatingModalContainer}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
              <View style={styles.floatingModalContent}>
                <View style={styles.floatingModalHeader}>
                  <Text style={styles.floatingModalTitle}>{getModalTitle()}</Text>
                  <TouchableOpacity onPress={() => setListModalVisible(false)} style={styles.floatingCloseButton}>
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
        <Text style={styles.headerTitle}>{isEditMode ? "Editar Venda" : "Nova Venda"}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Info da Propriedade */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Propriedade: {propriedadeNome}</Text>
          {isEditMode && <Text style={styles.editModeText}>Modo de Edição</Text>}
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
            <TouchableOpacity style={styles.selectionInput} onPress={() => openListModal("cliente")}>
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
            <TouchableOpacity style={styles.selectionInput} onPress={() => openListModal("formaPagamento")}>
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
          onPress={isEditMode ? showSaveConfirmation : handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Icon name={isEditMode ? "save" : "checkmark-circle"} size={24} color={COLORS.white} />
              <Text style={styles.saveButtonText}>{isEditMode ? "Salvar Alterações" : "Salvar Venda"}</Text>
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
                      {/* Campo Variedade agora é preenchido automaticamente ou mostra "Variedade não registrada" */}
                      <View style={styles.itemSelectionInput}>
                        <Text style={[
                          styles.itemSelectionText, 
                          !item.variedade && styles.placeholderText,
                          item.variedade === "Variedade não registrada" && { color: COLORS.warning }
                        ]}>
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
        isEditMode={isEditMode}
      />

      {/* Modal de Variedade Não Cadastrada */}
      <VariedadeModal
        visible={showVariedadeModal}
        talhao={talhaoSemVariedade}
        onCadastrar={cadastrarVariedadeTalhao}
        onContinuar={continuarSemVariedade}
        onClose={() => {
          setShowVariedadeModal(false)
          setTalhaoSemVariedade(null)
          setItemIdPendente(null)
        }}
      />
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
  editModeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.warning,
    marginTop: 4,
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
    width: "100%", // Garante que o aviso ocupe a largura total
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

  // Variety Modal Styles
  varietyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  varietyModalContainer: {
    width: "90%",
    maxWidth: 400,
  },
  varietyModalContent: {
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
  varietyIconContainer: {
    marginBottom: 16,
  },
  varietyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.gray800,
    textAlign: "center",
    marginBottom: 8,
  },
  varietyMessage: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  varietyInputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  varietyInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.gray700,
    marginBottom: 8,
  },
  varietyInput: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.white,
    color: COLORS.gray800,
  },
  varietyActions: {
    width: "100%",
  },
  varietyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  varietyCadastrarButton: {
    backgroundColor: COLORS.success,
  },
  varietyContinuarButton: {
    backgroundColor: COLORS.warning,
  },
  varietyCancelarButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.gray400,
  },
  varietyButtonText: {
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