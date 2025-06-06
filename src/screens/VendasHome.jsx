"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, FlatList, ActivityIndicator, Modal, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/Ionicons'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ref, onValue, off } from 'firebase/database'
import { database } from '../config/firebaseConfig'

// Importações compatíveis com Expo
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

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

// Classe para gerenciar PDF com expo-print (copiada e adaptada do SalesScreen)
class PDFManager {
  static async generateSalesReport(vendaData, propriedadeNome) {
    try {
      const htmlContent = this.generateHTMLContent(vendaData, propriedadeNome)
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      })
      return uri
    } catch (error) {
      console.error('Erro ao gerar PDF com expo-print:', error)
      throw new Error('Falha ao gerar relatório PDF')
    }
  }

  static generateHTMLContent(vendaData, propriedadeNome) {
    const itensHTML = vendaData.itens.map((item, index) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${item.tipoProduto || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${item.variedade || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${item.talhao || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${item.classificacao || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px;">${item.embalagem || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px; text-align: right;">${item.quantidade}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px; text-align: right;">R$ ${item.preco.toFixed(2)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 10px; text-align: right;">R$ ${item.valorTotal.toFixed(2)}</td>
      </tr>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Venda</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #8b5cf6; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #8b5cf6; margin-bottom: 5px; }
          .report-title { font-size: 18px; color: #333; }
          .info-section { margin-bottom: 20px; }
          .info-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
          .info-item { display: flex; }
          .info-label { font-weight: bold; margin-right: 10px; min-width: 120px; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .items-table th { background-color: #8b5cf6; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 11px; }
          .items-table td { border: 1px solid #ddd; padding: 6px; font-size: 10px; }
          .total-section { margin-top: 30px; text-align: right; }
          .total-value { font-size: 20px; font-weight: bold; color: #8b5cf6; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">J. R. AgroSolutions</div>
          <div class="report-title">Relatório de Venda</div>
        </div>

        <div class="info-section">
          <div class="info-title">Informações do Cliente</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Cliente:</span>
              <span>${vendaData.cliente}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data do Pedido:</span>
              <span>${vendaData.dataPedido}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Forma de Pagamento:</span>
              <span>${vendaData.formaPagamento}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data de Carregamento:</span>
              <span>${vendaData.dataCarregamento}</span>
            </div>
          </div>
          ${vendaData.prazoDias ? `
            <div class="info-item">
              <span class="info-label">Prazo:</span>
              <span>${vendaData.prazoDias} dias</span>
            </div>
          ` : ''}
          ${vendaData.observacao ? `
            <div class="info-item">
              <span class="info-label">Observações:</span>
              <span>${vendaData.observacao}</span>
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
                <th>Quant.</th>
                <th>Preço Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itensHTML}
            </tbody>
          </table>
        </div>

        <div class="total-section">
          <div class="total-value">Total: R$ ${vendaData.valorTotal.toFixed(2)}</div>
        </div>

        <div class="footer">
          <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
          <p>Sistema de Gestão Agrícola - ${propriedadeNome}</p>
        </div>
      </body>
      </html>
    `
  }

  static async sharePDF(pdfUri) {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Compartilhamento não disponível', 'A funcionalidade de compartilhamento não está disponível neste dispositivo.')
      return false
    }

    try {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar Relatório de Venda',
        UTI: 'com.adobe.pdf', // Para iOS
      })
      return true
    } catch (error) {
      console.error('Erro ao compartilhar PDF com expo-sharing:', error)
      Alert.alert('Erro', 'Falha ao compartilhar o relatório PDF.')
      return false
    }
  }
}


// Componente para o Modal de Ações da Venda
const SaleActionsModal = ({ visible, onClose, saleData, propriedadeNome }) => {
  const [isGeneratingAndSharingPDF, setIsGeneratingAndSharingPDF] = useState(false)

  const handleGenerateAndSharePDF = async () => {
    if (!saleData) return

    setIsGeneratingAndSharingPDF(true)
    try {
      const pdfUri = await PDFManager.generateSalesReport(saleData, propriedadeNome)
      if (pdfUri) {
        await PDFManager.sharePDF(pdfUri)
      }
    } catch (error) {
      // Erro já tratado dentro de PDFManager
    } finally {
      setIsGeneratingAndSharingPDF(false)
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.saleActionsModalContainer}>
          <View style={styles.saleActionsModalContent}>
            <View style={styles.saleActionsModalHeader}>
              <Text style={styles.saleActionsModalTitle}>Ações da Venda</Text>
              <TouchableOpacity onPress={onClose} style={styles.saleActionsCloseButton}>
                <Icon name="close" size={20} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>

            {/* Botão Gerar e Compartilhar PDF */}
            <TouchableOpacity
              style={[styles.saleActionsButton, styles.whatsappButton]}
              onPress={handleGenerateAndSharePDF}
              disabled={isGeneratingAndSharingPDF}
            >
              {isGeneratingAndSharingPDF ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="share" size={20} color={COLORS.white} />
                  <Text style={styles.saleActionsButtonText}>Gerar e Compartilhar PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Adicionar outros botões de ação aqui se necessário */}
            {/* <TouchableOpacity style={[styles.saleActionsButton, styles.secondaryButton]}>
              <MaterialIcons name="edit" size={20} color={COLORS.primary} />
              <Text style={[styles.saleActionsButtonText, { color: COLORS.primary }]}>Editar Venda</Text>
            </TouchableOpacity> */}

          </View>
        </View>
      </View>
    </Modal>
  )
}


export default function VendasHome() {
  const navigation = useNavigation()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [propriedadeNome, setPropriedadeNome] = useState("")

  // Estados para o modal de ações
  const [showSaleActionsModal, setShowSaleActionsModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)

  useEffect(() => {
    const loadPropriedade = async () => {
      try {
        const storedPropriedade = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROPRIEDADE)
        const nome = storedPropriedade || "Matrice" // Padrão se não encontrar
        setPropriedadeNome(nome)
      } catch (error) {
        console.error("Erro ao carregar nome da propriedade:", error)
        setPropriedadeNome("Matrice") // Padrão em caso de erro
      }
    }

    loadPropriedade()
  }, [])

  useEffect(() => {
    if (!propriedadeNome) return // Espera o nome da propriedade carregar

    const salesRef = ref(database, `propriedades/${propriedadeNome}/vendas`)

    // Listener para buscar dados em tempo real
    const unsubscribe = onValue(salesRef, (snapshot) => {
      const data = snapshot.val()
      const loadedSales = []
      if (data) {
        // Converte o objeto de vendas em um array
        Object.keys(data).forEach((key) => {
          loadedSales.push({
            id: key, // O ID da venda do Firebase
            ...data[key],
            // Formata a data para exibição
            dataPedidoFormatada: data[key].dataPedido || 'N/A',
            dataCarregamentoFormatada: data[key].dataCarregamento || 'N/A',
          })
        })
      }
      // Ordena as vendas pela data do pedido (mais recente primeiro)
      loadedSales.sort((a, b) => (b.dataTimestamp || 0) - (a.dataTimestamp || 0));
      setSales(loadedSales)
      setLoading(false)
    }, (error) => {
      console.error("Erro ao buscar vendas do Firebase:", error)
      Alert.alert("Erro", "Não foi possível carregar a lista de vendas.")
      setLoading(false)
    })

    // Limpa o listener quando o componente é desmontado
    return () => off(salesRef, 'value', unsubscribe)
  }, [propriedadeNome]) // Depende do nome da propriedade

  const handleSalePress = (sale) => {
    setSelectedSale(sale)
    setShowSaleActionsModal(true)
  }

  const renderSaleItem = ({ item }) => (
    <TouchableOpacity style={styles.saleItemCard} onPress={() => handleSalePress(item)}>
      <Text style={styles.saleItemTitle}>Venda para: {item.cliente || 'Cliente Desconhecido'}</Text>
      <View style={styles.saleItemDetail}>
        <Text style={styles.saleItemLabel}>Data do Pedido:</Text>
        <Text style={styles.saleItemValue}>{item.dataPedidoFormatada}</Text>
      </View>
       <View style={styles.saleItemDetail}>
        <Text style={styles.saleItemLabel}>Data Carregamento:</Text>
        <Text style={styles.saleItemValue}>{item.dataCarregamentoFormatada}</Text>
      </View>
      <View style={styles.saleItemDetail}>
        <Text style={styles.saleItemLabel}>Forma de Pagamento:</Text>
        <Text style={styles.saleItemValue}>{item.formaPagamento || 'N/A'}</Text>
      </View>
       {item.formaPagamentoId === 'prazo' && item.prazoDias && (
         <View style={styles.saleItemDetail}>
            <Text style={styles.saleItemLabel}>Prazo:</Text>
            <Text style={styles.saleItemValue}>{item.prazoDias} dias</Text>
          </View>
       )}
      <View style={styles.saleItemDetail}>
        <Text style={styles.saleItemLabel}>Total:</Text>
        <Text style={styles.saleItemValue}>R$ {item.valorTotal ? item.valorTotal.toFixed(2) : '0.00'}</Text>
      </View>
       {item.observacao && (
         <View style={styles.saleItemDetail}>
            <Text style={styles.saleItemLabel}>Obs:</Text>
            <Text style={styles.saleItemValue}>{item.observacao}</Text>
          </View>
       )}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Apontamentos de Vendas</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('SalesScreen')} // Navega para a tela de Nova Venda
        >
          <MaterialIcons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loadingIndicator} />
        ) : sales.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="info-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.emptyStateText}>Nenhuma venda registrada ainda.</Text>
            <Text style={styles.emptyStateText}>Toque no '+' para adicionar uma nova venda.</Text>
          </View>
        ) : (
          <FlatList
            data={sales}
            renderItem={renderSaleItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Modal de Ações da Venda */}
      <SaleActionsModal
        visible={showSaleActionsModal}
        onClose={() => setShowSaleActionsModal(false)}
        saleData={selectedSale}
        propriedadeNome={propriedadeNome}
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
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20, // Espaço no final da lista
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
  saleItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    paddingBottom: 8,
  },
  saleItemDetail: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  saleItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray700,
    marginRight: 8,
    minWidth: 120, // Garante alinhamento
  },
  saleItemValue: {
    fontSize: 13,
    color: COLORS.gray600,
    flex: 1, // Permite que o texto quebre linha
  },
   viewDetailsButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
    alignSelf: 'flex-start', // Alinha o botão à esquerda
  },
  viewDetailsButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Modal de Ações da Venda Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  saleActionsModalContainer: {
    width: "85%",
    maxWidth: 350,
  },
  saleActionsModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  saleActionsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    paddingBottom: 12,
  },
  saleActionsModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.gray800,
  },
  saleActionsCloseButton: {
    padding: 4,
  },
  saleActionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  saleActionsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
})