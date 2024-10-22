import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 30,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
    color: '#333',
    fontWeight: 'bold',
  },
  input: {
    height: 48, // Increased from 36 to 48
    borderColor: '#ccc',
    borderWidth: 2, // Increased from 1 to 2
    borderRadius: 8, // Increased from 4 to 8
    marginBottom: 12, // Increased from 8 to 12
    paddingHorizontal: 12, // Increased from 8 to 12
    backgroundColor: '#fff',
    elevation: 2, // Increased from 1 to 2
    fontSize: 16, // Added to increase text size inside input
  },
  dropdownContainer: {
    borderWidth: 2, // Increased from 1 to 2
    borderColor: '#ccc',
    borderRadius: 8, // Increased from 4 to 8
    marginBottom: 12, // Increased from 8 to 12
    backgroundColor: '#fff',
    justifyContent: 'center',
    height: 48, // Increased from 36 to 48
    elevation: 2, // Increased from 1 to 2
  },
  dropdownTitle: {
    fontSize: 20,
    color: '#333',
    textAlign: 'left',
    paddingHorizontal: 12, // Increased from 8 to 12
    lineHeight: 48, // Increased from 36 to 48
  },
  button: {
    marginTop: 12, // Increased from 8 to 12
    backgroundColor: '#2a9d8f',
    paddingVertical: 12, // Increased from 8 to 12
    borderRadius: 8, // Increased from 4 to 8
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3, // Increased from 2 to 3
  },
  buttonEnviar: {
    marginTop: 12, // Increased from 8 to 12
    backgroundColor: '#2a9d8f',
    paddingVertical: 12, // Increased from 8 to 12
    borderRadius: 8, // Increased from 4 to 8
    alignItems: 'center',
    marginBottom: 50,
    elevation: 3, // Increased from 2 to 3
  },

  modalButton: {
    marginTop: 12, // Increased from 8 to 12
    backgroundColor: '#2a9d8f',
    paddingVertical: 12, // Increased from 8 to 12
    borderRadius: 8, // Increased from 4 to 8
    alignItems: 'center',
    marginBottom: 16, // Increased from 12 to 16
    elevation: 3, // Increased from 2 to 3
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18, // Increased from 16 to 18
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
    borderRadius: 12, // Increased from 8 to 12
    padding: 20, // Increased from 16 to 20
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20, // Increased from 18 to 20
    fontWeight: 'bold',
    marginBottom: 16, // Increased from 12 to 16
    textAlign: 'center',
  },
  picker: {
    height: 48, // Increased from 36 to 48
    width: '100%',
  },
  datePickerText: {
    fontSize: 16, // Increased from 14 to 16
    color: '#333',
    lineHeight: 48, // Increased from 36 to 48
  },
  summaryContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8, // Increased from 4 to 8
    padding: 12, // Increased from 8 to 12
    marginTop: 16, // Increased from 12 to 16
    marginBottom: 16, // Increased from 12 to 16
  },
  summaryTitle: {
    fontSize: 22, // Increased from 20 to 22
    fontWeight: 'bold',
    marginBottom: 12, // Increased from 8 to 12
    color: '#2a9d8f',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8, // Increased from 4 to 8
  },
  summaryLabel: {
    fontSize: 16,
    color: '#555',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12, // Increased from 8 to 12
    paddingTop: 12, // Increased from 8 to 12
    borderTopWidth: 2, // Increased from 1 to 2
    borderTopColor: '#ccc',
  },
  summaryTotalLabel: {
    fontSize: 20, // Increased from 18 to 20
    fontWeight: 'bold',
    color: '#2a9d8f',
  },
  summaryTotalValue: {
    fontSize: 20, // Increased from 18 to 20
    fontWeight: 'bold',
    color: '#2a9d8f',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  closeButton: {
    padding: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default styles;