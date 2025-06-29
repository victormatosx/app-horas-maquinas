"use client"

import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"

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

// Função para formatar números para o padrão brasileiro (R$ X.XXX,XX)
const formatCurrencyBRL = (value, hideValues = false) => {
  if (hideValues) return "***"
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
  // Gerar relatório de uma única venda
  static async generateSalesReport(vendaData, propriedadeNome, logoUri, hideValues = false) {
    try {
      const htmlContent = this.generateSingleSaleHTMLContent(vendaData, propriedadeNome, logoUri, hideValues)

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

  // Gerar relatório consolidado de múltiplas vendas
  static async generateConsolidatedReport(vendasData, propriedadeNome, logoUri, reportTitle = "Relatório Consolidado de Vendas", hideValues = false) {
    try {
      const htmlContent = this.generateConsolidatedHTMLContent(vendasData, propriedadeNome, logoUri, reportTitle, hideValues)

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      })
      return uri
    } catch (error) {
      console.error("Erro ao gerar PDF consolidado:", error)
      throw new Error("Falha ao gerar relatório consolidado PDF")
    }
  }

  // HTML para uma única venda
  static generateSingleSaleHTMLContent(vendaData, propriedadeNome, logoUri, hideValues = false) {
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
        <td class="numeric">${formatCurrencyBRL(item.preco, hideValues)}</td>
        <td class="numeric">${formatCurrencyBRL(item.valorTotal, hideValues)}</td>
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
          ${this.getCommonStyles()}
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
          <span class="total-value">${formatCurrencyBRL(vendaData.valorTotal, hideValues)}</span>
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

  // HTML para relatório consolidado com detalhes completos
  static generateConsolidatedHTMLContent(vendasData, propriedadeNome, logoUri, reportTitle, hideValues = false) {
    const totalGeral = vendasData.reduce((sum, venda) => sum + (venda.valorTotal || 0), 0)
    const totalVendas = vendasData.length

    // Gerar HTML detalhado para cada venda
    const vendasDetalhesHTML = vendasData
      .map((venda, vendaIndex) => {
        const itensHTML = venda.itens
          .map(
            (item, itemIndex) => `
          <tr>
            <td>${itemIndex + 1}</td>
            <td>${item.tipoProduto || "-"}</td>
            <td>${item.variedade || "-"}</td>
            <td>${item.talhao || "-"}</td>
            <td>${item.classificacao || "-"}</td>
            <td>${item.embalagem || "-"}</td>
            <td class="numeric">${item.quantidade}</td>
            <td class="numeric">${formatCurrencyBRL(item.preco, hideValues)}</td>
            <td class="numeric">${formatCurrencyBRL(item.valorTotal, hideValues)}</td>
          </tr>
        `,
          )
          .join("")

        return `
          <div class="venda-section">
            <div class="venda-header">
              <h3 class="venda-title">Venda ${vendaIndex + 1} - ${venda.cliente || "Cliente Desconhecido"}</h3>
            </div>
            
            <div class="info-section">
              <div class="info-title">Informações da Venda</div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Cliente:</span>
                  <span class="info-value">${venda.cliente || "N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Data do Pedido:</span>
                  <span class="info-value">${venda.dataPedido || "N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Forma de Pagamento:</span>
                  <span class="info-value">${venda.formaPagamento || "N/A"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Data Carregamento:</span>
                  <span class="info-value">${venda.dataCarregamento || "N/A"}</span>
                </div>
                ${
                  venda.formaPagamentoId === "prazo" && venda.prazoDias
                    ? `
                  <div class="info-item">
                    <span class="info-label">Prazo:</span>
                    <span class="info-value">${venda.prazoDias} dias</span>
                  </div>
                `
                    : ""
                }
                ${
                  venda.observacaoPagamento
                    ? `
                  <div class="info-item" style="width: 100%;">
                    <span class="info-label">Observação Pagamento:</span>
                    <span class="info-value">${venda.observacaoPagamento}</span>
                  </div>
                `
                    : ""
                }
              </div>
              ${
                venda.observacao
                  ? `
                <div class="info-item" style="width: 100%;">
                  <span class="info-label">Observações Gerais:</span>
                  <span class="info-value">${venda.observacao}</span>
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

            <div class="venda-total-section">
              <span class="venda-total-label">Total desta Venda:</span>
              <span class="venda-total-value">${formatCurrencyBRL(venda.valorTotal, hideValues)}</span>
            </div>
          </div>
        `
      })
      .join("")

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <style>
          ${this.getCommonStyles()}
          .summary-section { margin-bottom: 25px; }
          .summary-grid { display: flex; gap: 20px; margin-bottom: 15px; }
          .summary-card { flex: 1; background-color: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-number { font-size: 24px; font-weight: bold; color: #8b5cf6; }
          .summary-label { font-size: 12px; color: #64748b; margin-top: 5px; }
          
          .venda-section { 
            margin-bottom: 40px; 
            padding-bottom: 30px; 
            border-bottom: 2px solid #e2e8f0; 
          }
          .venda-section:last-child { 
            border-bottom: none; 
          }
          .venda-header { 
            margin-bottom: 20px; 
          }
          .venda-title { 
            font-size: 18px; 
            font-weight: bold; 
            color: #8b5cf6; 
            margin: 0; 
            padding: 10px 0; 
            border-bottom: 1px solid #8b5cf6; 
          }
          .venda-total-section { 
            margin-top: 15px; 
            text-align: right; 
            padding-top: 10px; 
            border-top: 1px solid #ddd; 
            background-color: #f8fafc;
            padding: 15px;
            border-radius: 8px;
          }
          .venda-total-label { 
            font-size: 14px; 
            font-weight: bold; 
            color: #333; 
            margin-right: 10px; 
          }
          .venda-total-value { 
            font-size: 16px; 
            font-weight: bold; 
            color: #8b5cf6; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${logoUri ? `<img src="${logoUri}" class="logo" alt="Logo da Fazenda" />` : ""}
          </div>
          <div class="header-right">
            <div class="report-title">${reportTitle}</div>
            <div class="app-name">Sistema de Gestão Agrícola</div>
          </div>
        </div>

        ${vendasDetalhesHTML}

        <div class="total-section">
          <span class="total-label">Total Geral do Relatório:</span>
          <span class="total-value">${formatCurrencyBRL(totalGeral, hideValues)}</span>
        </div>

        <div class="footer">
          <p>Relatório gerado em ${new Date().toLocaleString("pt-BR")}</p>
          <p>Propriedade: ${propriedadeNome}</p>
          <p>Período: ${vendasData.length > 0 ? `${vendasData[vendasData.length - 1]?.dataPedido || "N/A"} a ${vendasData[0]?.dataPedido || "N/A"}` : "N/A"}</p>
          ${hideValues ? '<p style="color: #ef4444; font-weight: bold;">* Valores monetários ocultos</p>' : ''}
          <div class="company-footer">J. R. AgSolutions</div>
        </div>
      </body>
      </html>
    `
  }

  // Estilos CSS comuns
  static getCommonStyles() {
    return `
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

      .numeric { text-align: right; }

      .total-section { margin-top: 20px; text-align: right; padding-top: 10px; border-top: 2px solid #8b5cf6; }
      .total-label { font-size: 16px; font-weight: bold; color: #333; margin-right: 10px; }
      .total-value { font-size: 20px; font-weight: bold; color: #8b5cf6; }

      .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
      .company-footer { font-size: 12px; font-weight: bold; color: #8b5cf6; margin-top: 5px; }
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
        dialogTitle: "Compartilhar Relatório",
        UTI: "com.adobe.pdf",
      })
      return true
    } catch (error) {
      console.error("Erro ao compartilhar PDF:", error)
      Alert.alert("Erro", "Falha ao compartilhar o relatório PDF.")
      return false
    }
  }
}

// Componente principal do gerador de relatórios
const ReportGenerator = ({ visible, onClose, salesData, propriedadeNome, logoUri }) => {
  const [selectedSales, setSelectedSales] = useState([])
  const [reportTitle, setReportTitle] = useState("Relatório Consolidado de Vendas")
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectAll, setSelectAll] = useState(false)
  const [hideValues, setHideValues] = useState(false)

  const handleSelectSale = (saleId) => {
    setSelectedSales(prev => {
      if (prev.includes(saleId)) {
        return prev.filter(id => id !== saleId)
      } else {
        return [...prev, saleId]
      }
    })
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedSales([])
    } else {
      setSelectedSales(salesData.map(sale => sale.id))
    }
    setSelectAll(!selectAll)
  }

  const handleGenerateReport = async () => {
    if (selectedSales.length === 0) {
      Alert.alert("Atenção", "Selecione pelo menos uma venda para gerar o relatório.")
      return
    }

    setIsGenerating(true)
    try {
      const selectedSalesData = salesData.filter(sale => selectedSales.includes(sale.id))
      
      let pdfUri
      if (selectedSales.length === 1) {
        // Relatório de venda única
        pdfUri = await PDFManager.generateSalesReport(selectedSalesData[0], propriedadeNome, logoUri, hideValues)
      } else {
        // Relatório consolidado
        pdfUri = await PDFManager.generateConsolidatedReport(selectedSalesData, propriedadeNome, logoUri, reportTitle, hideValues)
      }

      if (pdfUri) {
        await PDFManager.sharePDF(pdfUri)
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível gerar o relatório. Tente novamente.")
    } finally {
      setIsGenerating(false)
    }
  }

  const renderSaleItem = ({ item }) => {
    const isSelected = selectedSales.includes(item.id)
    
    return (
      <TouchableOpacity
        style={[styles.saleItem, isSelected && styles.saleItemSelected]}
        onPress={() => handleSelectSale(item.id)}
      >
        <View style={styles.saleItemContent}>
          <View style={styles.saleItemHeader}>
            <Text style={styles.saleItemTitle}>{item.cliente || "Cliente Desconhecido"}</Text>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <MaterialIcons name="check" size={16} color={COLORS.white} />}
            </View>
          </View>
          <Text style={styles.saleItemDate}>Data: {item.dataPedido || "N/A"}</Text>
          <Text style={styles.saleItemValue}>
            Valor: {hideValues ? "***" : `R$ ${item.valorTotal ? item.valorTotal.toFixed(2) : "0.00"}`}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gerar Relatório</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={COLORS.gray600} />
            </TouchableOpacity>
          </View>

          {/* Título do Relatório */}
          <View style={styles.titleSection}>
            <Text style={styles.sectionLabel}>Título do Relatório:</Text>
            <TextInput
              style={styles.titleInput}
              value={reportTitle}
              onChangeText={setReportTitle}
              placeholder="Digite o título do relatório"
              placeholderTextColor={COLORS.gray400}
            />
          </View>

          {/* Opção para ocultar valores */}
          <View style={styles.optionSection}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Ocultar valores monetários (R$)</Text>
              <Switch
                value={hideValues}
                onValueChange={setHideValues}
                trackColor={{ false: COLORS.gray300, true: COLORS.primary }}
                thumbColor={hideValues ? COLORS.white : COLORS.gray400}
              />
            </View>
            <Text style={styles.switchDescription}>
              Quando ativado, todos os valores em reais serão substituídos por "***"
            </Text>
          </View>

          {/* Controles de Seleção */}
          <View style={styles.selectionControls}>
            <TouchableOpacity style={styles.selectAllButton} onPress={handleSelectAll}>
              <MaterialIcons 
                name={selectAll ? "check-box" : "check-box-outline-blank"} 
                size={20} 
                color={COLORS.primary} 
              />
              <Text style={styles.selectAllText}>
                {selectAll ? "Desmarcar Todas" : "Selecionar Todas"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectedCount}>
              {selectedSales.length} de {salesData.length} selecionadas
            </Text>
          </View>

          {/* Lista de Vendas */}
          <View style={styles.salesList}>
            <FlatList
              data={salesData}
              renderItem={renderSaleItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              maxHeight={300}
            />
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isGenerating}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.generateButton]}
              onPress={handleGenerateReport}
              disabled={isGenerating || selectedSales.length === 0}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="picture-as-pdf" size={20} color={COLORS.white} />
                  <Text style={styles.generateButtonText}>Gerar Relatório</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: "90%",
    maxHeight: "85%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.gray800,
  },
  closeButton: {
    padding: 4,
  },
  titleSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray700,
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.gray800,
    backgroundColor: COLORS.white,
  },
  optionSection: {
    marginBottom: 0,
    paddingTop: 0,
    padding: 16,
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray700,
    flex: 1,
  },
  switchDescription: {
    fontSize: 12,
    color: COLORS.gray600,
    fontStyle: "italic",
  },
  selectionControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  selectedCount: {
    fontSize: 12,
    color: COLORS.gray600,
  },
  salesList: {
    marginBottom: 12,
  },
  saleItem: {
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  saleItemSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  saleItemContent: {
    flex: 1,
  },
  saleItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  saleItemTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.gray800,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  saleItemDate: {
    fontSize: 12,
    color: COLORS.gray600,
    marginBottom: 2,
  },
  saleItemValue: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
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
  cancelButton: {
    backgroundColor: COLORS.gray200,
  },
  generateButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    color: COLORS.gray700,
    fontSize: 14,
    fontWeight: "600",
  },
  generateButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
})

export { ReportGenerator, PDFManager }