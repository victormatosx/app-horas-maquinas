import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2a9d8f',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 1,
  },
  dropdownContainer: {
    borderWidth: 1, // Mesma borda dos inputs
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    justifyContent: 'center',
    height: 50, // Altura igual aos inputs
    elevation: 1,
  },
  button: {
    marginTop:10 ,
    backgroundColor: '#2a9d8f',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default styles;
