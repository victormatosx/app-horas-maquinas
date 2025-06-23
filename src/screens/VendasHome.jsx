"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  ScrollView,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ref, onValue, off } from "firebase/database"
import { database } from "../config/firebaseConfig"

// Importações compatíveis com Expo
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"
import * as FileSystem from "expo-file-system"
import { Asset } from "expo-asset"

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
  USER_PROPRIEDADE: "@user_propriedade",
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

// Classe para gerenciar PDF com expo-print (MESMA FORMATAÇÃO DO SALESSCREEN)
class PDFManager {
  static async generateSalesReport(vendaData, propriedadeNome, logoUri) {
    try {
      const htmlContent = this.generateHTMLContent(vendaData, propriedadeNome, logoUri)

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      })
      return uri
    } catch (error) {
      console.error("Erro ao gerar PDF com expo-print:", error)
      throw new Error("Falha ao gerar relatório PDF")
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
            max-width: 100px;
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
          .info-grid { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-bottom: 10px; }
          .info-item { display: flex; width: calc(50% - 10px); }
          .info-label { font-weight: bold; margin-right: 5px; min-width: 100px; }
          .info-value { flex: 1; }

          .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
          .items-table th { background-color: #8b5cf6; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; }
          .items-table td { border: 1px solid #ddd; padding: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .items-table td:nth-child(1) { width: 5%; }
          .items-table td:nth-child(2) { width: 10%; }
          .items-table td:nth-child(3) { width: 15%; }
          .items-table td:nth-child(4) { width: 10%; }
          .items-table td:nth-child(5) { width: 10%; }
          .items-table td:nth-child(6) { width: 10%; }
          .items-table td:nth-child(7) { width: 10%; text-align: right; }
          .items-table td:nth-child(8) { width: 10%; text-align: right; }
          .items-table td:nth-child(9) { width: 10%; text-align: right; }

          .numeric { text-align: right; }

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
             ${
               vendaData.formaPagamentoId === "prazo" && vendaData.prazoDias
                 ? `
              <div class="info-item">
                <span class="info-label">Prazo:</span>
                <span class="info-value">${vendaData.prazoDias} dias</span>
              </div>
            `
                 : ""
             }
             ${
               vendaData.observacaoPagamento
                 ? `
              <div class="info-item" style="width: 100%;">
                <span class="info-label">Observação Pagamento:</span>
                <span class="info-value">${vendaData.observacaoPagamento}</span>
              </div>
            `
                 : ""
             }
          </div>
           ${
             vendaData.observacao
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

  static async sharePDF(pdfUri) {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(
        "Compartilhamento não disponível",
        "A funcionalidade de compartilhamento não está disponível neste dispositivo.",
      )
      return false
    }

    try {
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: "Compartilhar Relatório de Venda",
        UTI: "com.adobe.pdf",
      })
      return true
    } catch (error) {
      console.error("Erro ao compartilhar PDF com expo-sharing:", error)
      Alert.alert("Erro", "Falha ao compartilhar o relatório PDF.")
      return false
    }
  }
}

// Componente para o Modal de Detalhes da Venda
const SaleDetailsModal = ({ visible, onClose, saleData, propriedadeNome, onEdit, logoUri }) => {
  const [isGeneratingAndSharingPDF, setIsGeneratingAndSharingPDF] = useState(false)

  const handleGenerateAndSharePDF = async () => {
    if (!saleData) return

    setIsGeneratingAndSharingPDF(true)
    try {
      const pdfUri = await PDFManager.generateSalesReport(saleData, propriedadeNome, logoUri)
      if (pdfUri) {
        await PDFManager.sharePDF(pdfUri)
      }
    } catch (error) {
      // Erro já tratado dentro de PDFManager
    } finally {
      setIsGeneratingAndSharingPDF(false)
    }
  }

  if (!saleData) return null

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.detailsModalContainer}>
          <ScrollView style={styles.detailsModalContent} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.detailsModalHeader}>
              <Text style={styles.detailsModalTitle}>Detalhes da Venda</Text>
              <TouchableOpacity onPress={onClose} style={styles.detailsCloseButton}>
                <Icon name="close" size={24} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>

            {/* Informações do Cliente */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsSectionTitle}>Informações da Venda</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Cliente:</Text>
                  <Text style={styles.detailsValue}>{saleData.cliente || "N/A"}</Text>
                </View>
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Data do Pedido:</Text>
                  <Text style={styles.detailsValue}>{saleData.dataPedido || "N/A"}</Text>
                </View>
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Data Carregamento:</Text>
                  <Text style={styles.detailsValue}>{saleData.dataCarregamento || "N/A"}</Text>
                </View>
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Forma de Pagamento:</Text>
                  <Text style={styles.detailsValue}>{saleData.formaPagamento || "N/A"}</Text>
                </View>
                {saleData.formaPagamentoId === "prazo" && saleData.prazoDias && (
                  <View style={styles.detailsItem}>
                    <Text style={styles.detailsLabel}>Prazo:</Text>
                    <Text style={styles.detailsValue}>{saleData.prazoDias} dias</Text>
                  </View>
                )}
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Status:</Text>
                  <Text style={styles.detailsValue}>{saleData.status || "N/A"}</Text>
                </View>
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Propriedade:</Text>
                  <Text style={styles.detailsValue}>{saleData.propriedade || "N/A"}</Text>
                </View>
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Criado em:</Text>
                  <Text style={styles.detailsValue}>
                    {saleData.criadoEm ? new Date(saleData.criadoEm).toLocaleString("pt-BR") : "N/A"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Itens da Venda */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsSectionTitle}>Itens da Venda</Text>
              {saleData.itens && saleData.itens.length > 0 ? (
                saleData.itens.map((item, index) => (
                  <View key={index} style={styles.itemDetailsCard}>
                    <Text style={styles.itemDetailsTitle}>Item {index + 1}</Text>
                    <View style={styles.itemDetailsGrid}>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Produto:</Text>
                        <Text style={styles.itemDetailsValue}>{item.tipoProduto || "N/A"}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Talhão:</Text>
                        <Text style={styles.itemDetailsValue}>{item.talhao || "N/A"}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Variedade:</Text>
                        <Text style={styles.itemDetailsValue}>{item.variedade || "N/A"}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Classificação:</Text>
                        <Text style={styles.itemDetailsValue}>{item.classificacao || "N/A"}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Embalagem:</Text>
                        <Text style={styles.itemDetailsValue}>{item.embalagem || "N/A"}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Quantidade:</Text>
                        <Text style={styles.itemDetailsValue}>{item.quantidade || 0}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Preço Unitário:</Text>
                        <Text style={styles.itemDetailsValue}>R$ {Number.parseFloat(item.preco || 0).toFixed(2)}</Text>
                      </View>
                      <View style={styles.itemDetailsRow}>
                        <Text style={styles.itemDetailsLabel}>Subtotal:</Text>
                        <Text style={[styles.itemDetailsValue, styles.itemSubtotal]}>
                          R$ {Number.parseFloat(item.valorTotal || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyItemsText}>Nenhum item encontrado</Text>
              )}
            </View>

            {/* Observações */}
            {(saleData.observacao || saleData.observacaoPagamento) && (
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Observações</Text>
                {saleData.observacaoPagamento && (
                  <View style={styles.observationCard}>
                    <Text style={styles.observationTitle}>Pagamento:</Text>
                    <Text style={styles.observationText}>{saleData.observacaoPagamento}</Text>
                  </View>
                )}
                {saleData.observacao && (
                  <View style={styles.observationCard}>
                    <Text style={styles.observationTitle}>Gerais:</Text>
                    <Text style={styles.observationText}>{saleData.observacao}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Total */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total da Venda:</Text>
              <Text style={styles.totalValue}>R$ {saleData.valorTotal ? saleData.valorTotal.toFixed(2) : "0,00"}</Text>
            </View>
          </ScrollView>

          {/* Botões de Ação */}
          <View style={styles.detailsActions}>
            <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => onEdit(saleData)}>
              <MaterialIcons name="edit" size={20} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Editar Venda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton]}
              onPress={handleGenerateAndSharePDF}
              disabled={isGeneratingAndSharingPDF}
            >
              {isGeneratingAndSharingPDF ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="share" size={20} color={COLORS.white} />
                  <Text style={styles.actionButtonText}>Compartilhar PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function VendasHome() {
  const navigation = useNavigation()
  const [sales, setSales] = useState([])
  const [filteredSales, setFilteredSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [propriedadeNome, setPropriedadeNome] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("newest") // newest, oldest
  const [logoUri, setLogoUri] = useState(null)

  // Estados para o modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)

  useEffect(() => {
    const loadUserDataAndLogo = async () => {
      try {
        const storedPropriedade = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROPRIEDADE)
        const nome = storedPropriedade || "Matrice"
        setPropriedadeNome(nome)

        // Carregar a URI da logo e converter para Base64
        const asset = Asset.fromModule(matriceLogo)
        await asset.downloadAsync()
        const base64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const base64Uri = `data:image/png;base64,${base64}`
        setLogoUri(base64Uri)
      } catch (error) {
        console.error("Erro ao carregar dados do usuário ou logo:", error)
        setPropriedadeNome("Matrice")
        setLogoUri(null)
      }
    }

    loadUserDataAndLogo()
  }, [])

  useEffect(() => {
    if (!propriedadeNome) return

    const salesRef = ref(database, `propriedades/${propriedadeNome}/vendas`)

    const unsubscribe = onValue(
      salesRef,
      (snapshot) => {
        const data = snapshot.val()
        const loadedSales = []
        if (data) {
          Object.keys(data).forEach((key) => {
            const venda = data[key]
            loadedSales.push({
              id: key,
              ...venda,
              // Garantir formatação das datas
              dataPedidoFormatada: venda.dataPedido || "N/A",
              dataCarregamentoFormatada: venda.dataCarregamento || "N/A",
              // Garantir que os itens sejam um array
              itens: venda.itens ? Object.values(venda.itens) : [],
              // Garantir que o valor total seja numérico
              valorTotal: Number.parseFloat(venda.valorTotal) || 0,
            })
          })
        }
        setSales(loadedSales)
        setLoading(false)
      },
      (error) => {
        console.error("Erro ao buscar vendas do Firebase:", error)
        Alert.alert("Erro", "Não foi possível carregar a lista de vendas.")
        setLoading(false)
      },
    )

    return () => off(salesRef, "value", unsubscribe)
  }, [propriedadeNome])

  // Filtrar e ordenar vendas
  useEffect(() => {
    let filtered = sales

    // Filtro por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (sale) =>
          (sale.cliente && sale.cliente.toLowerCase().includes(query)) ||
          (sale.dataPedido && sale.dataPedido.toLowerCase().includes(query)) ||
          (sale.formaPagamento && sale.formaPagamento.toLowerCase().includes(query)),
      )
    }

    // Ordenação por data
    filtered.sort((a, b) => {
      if (sortOrder === "newest") {
        return (b.dataTimestamp || 0) - (a.dataTimestamp || 0)
      } else {
        return (a.dataTimestamp || 0) - (b.dataTimestamp || 0)
      }
    })

    setFilteredSales(filtered)
  }, [sales, searchQuery, sortOrder])

  const handleSalePress = (sale) => {
    setSelectedSale(sale)
    setShowDetailsModal(true)
  }

  const handleEditSale = (saleData) => {
    setShowDetailsModal(false)
    // Navegar para a tela de edição (SalesScreen) com os dados da venda
    navigation.navigate("SalesScreen", {
      editMode: true,
      saleData: saleData,
      saleId: saleData.id,
    })
  }

  const renderSortButton = (type, label, icon) => (
    <TouchableOpacity
      style={[styles.sortButton, sortOrder === type && styles.sortButtonActive]}
      onPress={() => setSortOrder(type)}
    >
      <MaterialIcons name={icon} size={16} color={sortOrder === type ? COLORS.white : COLORS.gray600} />
      <Text style={[styles.sortButtonText, sortOrder === type && styles.sortButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  )

  const renderSaleItem = ({ item }) => (
    <TouchableOpacity style={styles.saleItemCard} onPress={() => handleSalePress(item)}>
      <View style={styles.saleItemHeader}>
        <Text style={styles.saleItemTitle}>{item.cliente || "Cliente Desconhecido"}</Text>
        <View
          style={[
            styles.statusBadge,
            item.formaPagamentoId === "vista" && styles.statusVista,
            item.formaPagamentoId === "prazo" && styles.statusPrazo,
            item.formaPagamentoId === "bonificacao" && styles.statusBonificacao,
          ]}
        >
          <Text style={styles.statusText}>{item.formaPagamento || "N/A"}</Text>
        </View>
      </View>

      <View style={styles.saleItemDetail}>
        <Text style={styles.saleItemLabel}>Data do Pedido:</Text>
        <Text style={styles.saleItemValue}>{item.dataPedidoFormatada}</Text>
      </View>

      <View style={styles.saleItemDetail}>
        <Text style={styles.saleItemLabel}>Data Carregamento:</Text>
        <Text style={styles.saleItemValue}>{item.dataCarregamentoFormatada}</Text>
      </View>

      {item.formaPagamentoId === "prazo" && item.prazoDias && (
        <View style={styles.saleItemDetail}>
          <Text style={styles.saleItemLabel}>Prazo:</Text>
          <Text style={styles.saleItemValue}>{item.prazoDias} dias</Text>
        </View>
      )}

      <View style={styles.saleItemFooter}>
        <Text style={styles.saleItemTotal}>R$ {item.valorTotal ? item.valorTotal.toFixed(2) : "0.00"}</Text>
        <Icon name="chevron-forward" size={20} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendas</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("SalesScreen")}>
          <MaterialIcons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Barra de Busca */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={COLORS.gray400} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cliente, data ou forma de pagamento..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.gray400}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
              <Icon name="close" size={20} color={COLORS.gray400} />
            </TouchableOpacity>
          )}
        </View>

        {/* Ordenação */}
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Ordenar por:</Text>
          <View style={styles.sortButtons}>
            {renderSortButton("newest", "Mais Recente", "arrow-downward")}
            {renderSortButton("oldest", "Mais Antigo", "arrow-upward")}
          </View>
        </View>

        {/* Lista de Vendas */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loadingIndicator} />
        ) : filteredSales.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="info-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.emptyStateText}>
              {searchQuery ? "Nenhuma venda encontrada com os filtros aplicados." : "Nenhuma venda registrada ainda."}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.emptyStateButton} onPress={() => navigation.navigate("SalesScreen")}>
                <Text style={styles.emptyStateButtonText}>Registrar Nova Venda</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredSales}
            renderItem={renderSaleItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Modal de Detalhes da Venda */}
      <SaleDetailsModal
        visible={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        saleData={selectedSale}
        propriedadeNome={propriedadeNome}
        onEdit={handleEditSale}
        logoUri={logoUri}
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
  },
  addButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.gray800,
  },
  clearButton: {
    padding: 4,
  },
  sortContainer: {
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray700,
    marginBottom: 8,
  },
  sortButtons: {
    flexDirection: "row",
    gap: 8,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    gap: 4,
  },
  sortButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortButtonText: {
    fontSize: 12,
    color: COLORS.gray600,
    fontWeight: "500",
  },
  sortButtonTextActive: {
    color: COLORS.white,
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.gray600,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 20,
  },
  saleItemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  saleItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  saleItemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.gray800,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.gray200,
  },
  statusVista: {
    backgroundColor: "#dcfce7",
  },
  statusPrazo: {
    backgroundColor: "#fef3c7",
  },
  statusBonificacao: {
    backgroundColor: "#dbeafe",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray700,
  },
  saleItemDetail: {
    flexDirection: "row",
    marginBottom: 6,
  },
  saleItemLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.gray700,
    marginRight: 8,
    minWidth: 120,
  },
  saleItemValue: {
    fontSize: 13,
    color: COLORS.gray600,
    flex: 1,
  },
  saleItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  saleItemTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },

  // Modal de Detalhes Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  detailsModalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "60%",
  },
  detailsModalContent: {
    flex: 1,
    padding: 20,
  },
  detailsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.gray800,
  },
  detailsCloseButton: {
    padding: 4,
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.gray800,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    paddingBottom: 8,
  },
  detailsGrid: {
    gap: 8,
  },
  detailsItem: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray700,
    minWidth: 140,
  },
  detailsValue: {
    fontSize: 14,
    color: COLORS.gray600,
    flex: 1,
  },
  itemDetailsCard: {
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemDetailsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.gray800,
    marginBottom: 8,
  },
  itemDetailsGrid: {
    gap: 4,
  },
  itemDetailsRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  itemDetailsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray700,
    minWidth: 100,
  },
  itemDetailsValue: {
    fontSize: 12,
    color: COLORS.gray600,
    flex: 1,
  },
  itemSubtotal: {
    fontWeight: "bold",
    color: COLORS.primary,
  },
  observationCard: {
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  observationTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.gray800,
    marginBottom: 4,
  },
  observationText: {
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.gray800,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  detailsActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: COLORS.primary,
  },
  shareButton: {
    backgroundColor: "#25D366",
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyItemsText: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: "center",
    fontStyle: "italic",
    padding: 20,
  },
})
