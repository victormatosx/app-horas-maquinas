import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 30,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  label: {
    fontSize: 16, // Aumentado de 14 para 16
    marginBottom: 4,
    color: '#333',
  },
  input: {
    height: 36,
    borderColor: '#ccc', 
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    elevation: 1,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    height: 36,
    elevation: 1,
  },
  dropdownTitle: {
    fontSize: 20, // Aumentado de 14 para 16
    color: '#333',
    textAlign: 'left',
    paddingHorizontal: 8,
    lineHeight: 36,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#2a9d8f',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  modalButton: {
    marginTop: 8,
    backgroundColor: '#2a9d8f',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16, // Mantido em 14 para os botões
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  picker: {
    height: 36,
    width: '100%',
  },
  datePickerText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 36,
  },
  summaryContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    padding: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 20, // Aumentado de 16 para 18
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2a9d8f',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 16, // Aumentado de 12 para 14
    color: '#555',
  },
  summaryValue: {
    fontSize: 16, // Aumentado de 12 para 14
    fontWeight: 'bold',
    color: '#333',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  summaryTotalLabel: {
    fontSize: 18, // Aumentado de 14 para 16
    fontWeight: 'bold',
    color: '#2a9d8f',
  },
  summaryTotalValue: {
    fontSize: 18, // Aumentado de 14 para 16
    fontWeight: 'bold',
    color: '#2a9d8f',
  },
});

export default styles;
